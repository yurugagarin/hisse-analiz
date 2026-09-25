"""Kazanç kalitesi analizi (deterministik).

Tüm sayılar xbrl.build_table çıktısından gelir. Buradaki 'yorum' metinleri
kural tabanlı şablonlardır ve sitede YORUM olarak işaretlenir.
"""
from __future__ import annotations

from common import rnd, safe_div
from xbrl import CONCEPTS

KIRMIZI, DIKKAT, OLUMLU = "kirmizi_bayrak", "dikkat", "olumlu"

BRIDGE_ITEMS = [
    # key, Türkçe ad, işaret (köprüde), kategori
    ("interest_income", "Faiz geliri", 1, "faiz"),
    ("interest_expense", "Faiz gideri", -1, "faiz"),
    ("warrant_fv", "Warrant gerçeğe uygun değer değişimi", 1, "turev"),  # warrant_fv zaten ters işaretli
    ("derivative_gl", "Türev araç kazanç/zararı", 1, "turev"),
    ("investment_gl", "Yatırım (menkul kıymet) kazanç/zararı", 1, "tek_seferlik"),
    ("debt_extinguishment", "Borç kapama kazanç/zararı", 1, "tek_seferlik"),
]


def _fmt_usd(x):
    if x is None:
        return "veri yok"
    a = abs(x)
    s = "-" if x < 0 else ""
    if a >= 1e9:
        return f"{s}{a/1e9:,.2f} milyar $"
    if a >= 1e6:
        return f"{s}{a/1e6:,.1f} milyon $"
    return f"{s}{a:,.0f} $"


def _ref(row: dict, key: str, filings: dict, cik: int) -> dict | None:
    src = row.get("_kaynak", {}).get(key)
    if not src:
        return None
    accn = src.get("accn")
    f = filings.get(accn, {})
    return {
        "satir": f"us-gaap:{src['concept']}",
        "tablo": CONCEPTS[key]["tablo"],
        "turetilmis": src.get("turetilmis"),
        "not": src.get("not") or "",
        "belge": f.get("form"),
        "tarih": f.get("filingDate"),
        "url": f.get("url") or (f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=10-&dateb=&owner=include&count=40" if accn else None),
        "xbrl_url": f"https://data.sec.gov/api/xbrl/companyconcept/CIK{cik:010d}/us-gaap/{src['concept']}.json",
    }


def _bridge(row: dict, suffix: str = "") -> dict:
    """Faaliyet kârı -> vergi öncesi -> net kâr köprüsü."""
    g = lambda k: row.get(k + suffix) if suffix else row.get(k)  # noqa: E731
    op = g("operating_income")
    pretax = g("pretax")
    ni = g("net_income")
    tax = g("tax")
    items = []
    identified = 0.0
    if not suffix:
        for key, ad, sign, cat in BRIDGE_ITEMS:
            val = row.get(key)
            if val is None:
                continue
            if key == "warrant_fv":
                val = -val  # pozitif concept değeri = gider
            else:
                val = sign * val
            items.append({"kalem": ad, "key": key, "tutar": val, "kategori": cat})
            identified += val
    residual = None
    if op is not None and pretax is not None:
        residual = pretax - op - identified
        if abs(residual) > 1:
            items.append({"kalem": "Diğer faaliyet dışı (ayrıştırılamayan kalan)", "key": "residual",
                          "tutar": residual, "kategori": "diger"})
    after_tax_gap = None
    if pretax is not None and ni is not None and tax is not None:
        after_tax_gap = ni - (pretax - tax)  # azınlık payı, durdurulan faaliyet vb.
    return {
        "faaliyet_kari": op,
        "kalemler": items,
        "vergi_oncesi_kar": pretax,
        "vergi": -tax if tax is not None else None,
        "diger_vergi_sonrasi": after_tax_gap if after_tax_gap and abs(after_tax_gap) > 1 else None,
        "net_kar": ni,
        "faaliyet_disi_toplam": (pretax - op) if (pretax is not None and op is not None) else None,
    }


def _adjusted(row: dict) -> dict:
    """Düzeltilmiş kâr: faaliyet dışı ve tek seferlik kalemler hariç, efektif vergiyle."""
    op = row.get("operating_income")
    pretax = row.get("pretax")
    tax = row.get("tax")
    one_time_in_op = (row.get("restructuring") or 0) + (row.get("impairment") or 0)
    if op is None:
        return {"hesaplanabilir": False, "neden": "Faaliyet kârı verisi yok"}
    adj_op = op + one_time_in_op
    eff = safe_div(tax, pretax) if (pretax and pretax > 0 and tax is not None) else None
    tax_rate = eff if eff is not None and 0 <= eff <= 0.4 else 0.21
    tax_note = ("efektif vergi oranı" if eff is not None and 0 <= eff <= 0.4
                else "efektif oran anlamsız/yok -> ABD federal oranı %21 varsayıldı (VARSAYIM)")
    core = adj_op * (1 - tax_rate) if adj_op > 0 else adj_op
    ni = row.get("net_income")
    return {
        "hesaplanabilir": True,
        "gaap_faaliyet_kari": op,
        "faaliyet_ici_tek_seferlik": one_time_in_op or 0,
        "duzeltilmis_faaliyet_kari": adj_op,
        "vergi_orani": rnd(tax_rate * 100, 1),
        "vergi_notu": tax_note,
        "cekirdek_kar_vergi_sonrasi": core,
        "gaap_net_kar": ni,
        "fark_net_kar_eksi_cekirdek": (ni - core) if ni is not None else None,
        "gercekten_kar_ediyor_mu": adj_op > 0,
        "formul": "Düzeltilmiş faaliyet kârı = GAAP faaliyet kârı + yeniden yapılanma + değer düşüklüğü; "
                  "çekirdek kâr = düzeltilmiş faaliyet kârı × (1 − vergi oranı). Faaliyet dışı kalemler "
                  "(faiz, warrant/türev, yatırım kazançları) tamamen hariç.",
    }


def analyze(table: dict, filings: dict, cik: int, ticker: str) -> dict:
    rows = table.get("ceyrekler", [])
    if not rows:
        return {"hata": table.get("hata", "veri yok"), "bulgular": []}
    r = rows[-1]
    F: list[dict] = []

    def add(etiket, baslik, olgu, yorum, keys):
        refs = [x for x in (_ref(r, k, filings, cik) for k in keys) if x]
        F.append({"etiket": etiket, "baslik": baslik, "olgu": olgu, "yorum": yorum, "kaynaklar": refs})

    br = _bridge(r)
    adj = _adjusted(r)

    # 1) Faaliyet dışı kalemlerin ağırlığı
    nonop = br["faaliyet_disi_toplam"]
    pretax = r.get("pretax")
    op = r.get("operating_income")
    if nonop is not None and pretax:
        share = abs(nonop) / abs(pretax) * 100
        if op is not None and op <= 0 < (r.get("net_income") or 0):
            add(KIRMIZI, "Net kâr faaliyet dışı kalemlerden geliyor",
                f"Faaliyet kârı {_fmt_usd(op)}, net kâr {_fmt_usd(r.get('net_income'))}; faaliyet dışı toplam {_fmt_usd(nonop)}.",
                "Şirket esas faaliyetinden zarar ederken net kâr gösteriyor; kâr kalitesi düşük.",
                ["operating_income", "net_income", "pretax"])
        elif share > 50:
            add(KIRMIZI, "Vergi öncesi kârın yarıdan fazlası faaliyet dışı",
                f"Faaliyet dışı toplam {_fmt_usd(nonop)} = vergi öncesi kârın %{share:.0f}'i.",
                "Kâr, tekrarlanması belirsiz kalemlere dayanıyor.", ["pretax", "operating_income"])
        elif share > 20:
            add(DIKKAT, "Faaliyet dışı kalemler kârı belirgin etkiliyor",
                f"Faaliyet dışı toplam {_fmt_usd(nonop)} = vergi öncesi kârın %{share:.0f}'i.",
                "Köprü tablosunda hangi kalemin etkili olduğuna bak.", ["pretax", "operating_income"])
    for it in br["kalemler"]:
        if it["kategori"] == "turev" and pretax and abs(it["tutar"]) / abs(pretax) > 0.1:
            add(DIKKAT, f"{it['kalem']} kârı etkiliyor",
                f"{it['kalem']}: {_fmt_usd(it['tutar'])} (vergi öncesi kârın %{abs(it['tutar'])/abs(pretax)*100:.0f}'i).",
                "Nakit dışı ve hisse fiyatına bağlı bir kalem; düzeltilmiş kârda hariç tutuldu.", [it["key"]])

    # 2) Nakit dönüşümü
    ratio = r.get("ocf_to_ni_ttm")
    if ratio is not None:
        olgu = f"TTM işletme nakit akışı {_fmt_usd(r.get('ocf_ttm'))}, TTM net kâr {_fmt_usd(r.get('net_income_ttm'))} (oran {ratio:.2f}x)."
        if ratio < 0.5:
            add(KIRMIZI, "Kâr nakde dönüşmüyor", olgu, "Tahakkuk bazlı kâr nakitle desteklenmiyor; alacak/stok artışına bak.", ["ocf", "net_income"])
        elif ratio < 0.8:
            add(DIKKAT, "Nakit dönüşümü zayıf", olgu, "İşletme sermayesi kârın bir kısmını emiyor.", ["ocf", "net_income"])
        elif ratio >= 1.0:
            add(OLUMLU, "Kâr nakitle destekleniyor", olgu, "İşletme nakit akışı net kârın üzerinde.", ["ocf", "net_income"])
    elif (r.get("net_income_ttm") or 0) <= 0 and r.get("ocf_ttm") is not None:
        add(DIKKAT if r["ocf_ttm"] > 0 else KIRMIZI, "TTM net zarar",
            f"TTM net kâr {_fmt_usd(r.get('net_income_ttm'))}, TTM işletme nakit akışı {_fmt_usd(r.get('ocf_ttm'))}.",
            "Zarar eden şirkette nakit akışı ve nakit pisti kritik.", ["net_income", "ocf"])

    # 3) FCF & pist
    if r.get("fcf_ttm") is not None:
        if r["fcf_ttm"] < 0:
            rw = r.get("cash_runway_months")
            et = KIRMIZI if (rw is not None and rw < 12) else DIKKAT
            add(et, "Şirket nakit yakıyor",
                f"TTM serbest nakit akışı {_fmt_usd(r['fcf_ttm'])}; nakit+kısa vadeli yatırım {_fmt_usd(r.get('liquidity'))}; "
                f"pist ≈ {rw if rw is not None else 'hesaplanamadı'} ay.",
                "Pist kısaldıkça hisse ihracı (sulandırma) veya borçlanma olasılığı artar.", ["ocf", "capex", "cash"])
        elif (r.get("fcf_margin_ttm") or 0) >= 20:
            add(OLUMLU, "Güçlü serbest nakit akışı",
                f"TTM FCF {_fmt_usd(r['fcf_ttm'])}, FCF marjı %{r['fcf_margin_ttm']}.", "", ["ocf", "capex"])

    # 4) SBC & sulandırma
    sbc = r.get("sbc_to_revenue_ttm")
    if sbc is not None:
        if sbc > 25:
            add(KIRMIZI, "SBC gelire oranla çok yüksek", f"TTM SBC/gelir %{sbc}.", "SBC gerçek bir maliyettir; non-GAAP kârı şişirir.", ["sbc", "revenue"])
        elif sbc > 12:
            add(DIKKAT, "SBC yüksek", f"TTM SBC/gelir %{sbc}.", "SBC hariç tutulan non-GAAP metrikleri temkinli oku.", ["sbc", "revenue"])
        elif sbc < 5:
            add(OLUMLU, "SBC düşük", f"TTM SBC/gelir %{sbc}.", "", ["sbc", "revenue"])
    dil = r.get("diluted_shares_yoy")
    if dil is not None:
        if dil > 10:
            add(KIRMIZI, "Ciddi sulandırma", f"Seyreltilmiş hisse sayısı yıllık %{dil} arttı.", "Hisse başına değer eriyor.", ["diluted_shares"])
        elif dil > 3:
            add(DIKKAT, "Sulandırma", f"Seyreltilmiş hisse sayısı yıllık %{dil} arttı.", "", ["diluted_shares"])
        elif dil < -1:
            add(OLUMLU, "Hisse sayısı azalıyor", f"Seyreltilmiş hisse sayısı yıllık %{dil} değişti.", "Geri alımlar SBC'yi aşıyor.", ["diluted_shares", "buybacks"])

    # 5) Alacaklar / DSO
    gap = r.get("receivables_vs_revenue_gap")
    if gap is not None:
        olgu = (f"Alacaklar yıllık %{r.get('ar_yoy')}, gelir %{r.get('revenue_yoy')}; fark {gap} puan. "
                f"DSO {r.get('dso')} gün (yıllık değişim {r.get('dso_yoy_change')} gün).")
        if gap > 30:
            add(KIRMIZI, "Alacaklar gelirden çok daha hızlı büyüyor", olgu, "Agresif gelir tanıma veya tahsilat sorunu riski; dipnotta müşteri bazlı alacaklara bak.", ["ar", "revenue"])
        elif gap > 15 or (r.get("dso_yoy_change") or 0) > 10:
            add(DIKKAT, "Alacak artışı gelirin önünde", olgu, "", ["ar", "revenue"])
        elif gap < -10:
            add(OLUMLU, "Tahsilat hızlanıyor", olgu, "", ["ar", "revenue"])

    # 6) Stok
    ig = r.get("inventory_vs_revenue_gap")
    if ig is not None:
        olgu = f"Stok yıllık %{r.get('inventory_yoy')}, gelir %{r.get('revenue_yoy')}; fark {ig} puan. DIO {r.get('dio')} gün."
        if ig > 50:
            add(KIRMIZI, "Stok gelirden çok daha hızlı büyüyor", olgu, "Talep yavaşlaması, ürün geçişi veya stok değer düşüklüğü riski.", ["inventory", "revenue"])
        elif ig > 20:
            add(DIKKAT, "Stok birikiyor", olgu, "Yeni ürün rampası için bilinçli stoklama da olabilir; MD&A'yı oku.", ["inventory", "revenue"])
        elif ig < -20:
            add(OLUMLU, "Stok gelire göre eriyor", olgu, "", ["inventory", "revenue"])

    # 7) Ertelenmiş gelir / RPO
    dry, ry = r.get("deferred_revenue_yoy"), r.get("revenue_yoy")
    if dry is not None and ry is not None:
        if dry < ry - 10:
            add(DIKKAT, "Ertelenmiş gelir gelirden yavaş büyüyor",
                f"Ertelenmiş gelir yıllık %{dry}, gelir %{ry}.", "Gelecek dönem gelir görünürlüğü zayıflıyor olabilir.", ["deferred_rev_current", "revenue"])
    rpo = r.get("rpo_yoy")
    if rpo is not None and ry is not None:
        if rpo >= ry:
            add(OLUMLU, "RPO gelirden hızlı büyüyor", f"RPO yıllık %{rpo}, gelir %{ry}.", "Sözleşmeli iş birikimi güçlü.", ["rpo", "revenue"])
        elif rpo < ry - 5:
            add(DIKKAT, "RPO büyümesi geriliyor", f"RPO yıllık %{rpo}, gelir %{ry}.", "", ["rpo", "revenue"])

    # 8) Satın almalar (organik vs inorganik)
    acq, rev_ttm = r.get("acquisitions_ttm"), r.get("revenue_ttm")
    if acq and rev_ttm and acq / rev_ttm > 0.05:
        extra = ""
        if r.get("acquiree_revenue"):
            extra = f" Satın alınan şirket(ler)in dönem geliri (dipnot): {_fmt_usd(r['acquiree_revenue'])}."
        add(DIKKAT, "Büyümede satın alma etkisi olabilir",
            f"TTM satın alma ödemeleri {_fmt_usd(acq)} (TTM gelirin %{acq/rev_ttm*100:.1f}'i).{extra}",
            "Organik büyümeyi ayırmak için işletme birleşmeleri dipnotuna bak (aşağıdaki Claude dipnot analizi).",
            ["acquisitions", "acquiree_revenue"])

    # 9) Brüt marj trendi
    gm = r.get("gross_margin_yoy_pp")
    if gm is not None:
        if gm <= -3:
            add(DIKKAT, "Brüt marj geriliyor", f"Brüt marj %{r.get('gross_margin')} (yıllık {gm} puan).", "", ["gross_profit", "revenue"])
        elif gm >= 3:
            add(OLUMLU, "Brüt marj genişliyor", f"Brüt marj %{r.get('gross_margin')} (yıllık +{gm} puan).", "", ["gross_profit", "revenue"])

    # 10) Capex yoğunluğu
    cx = r.get("capex_to_revenue_ttm_yoy_pp")
    if cx is not None and cx >= 8:
        add(DIKKAT, "Yatırım harcaması yoğunluğu hızla artıyor",
            f"TTM capex/gelir %{r.get('capex_to_revenue_ttm')} (yıllık +{cx} puan).",
            "Yüksek capex FCF'yi baskılar; getirisi gelir büyümesinde görülmeli.", ["capex", "revenue"])

    # 11) Vergi oranı
    if pretax and pretax > 0 and r.get("tax") is not None:
        etr = r["tax"] / pretax * 100
        if etr < 5 or etr > 35:
            add(DIKKAT, "Olağan dışı efektif vergi oranı",
                f"Çeyrek efektif vergi oranı %{etr:.1f}.",
                "Vergi indirimi/ertelenmiş vergi varlığı değerleme ayarlaması kârı geçici olarak etkileyebilir; vergi dipnotuna bak.",
                ["tax", "pretax"])

    order = {KIRMIZI: 0, DIKKAT: 1, OLUMLU: 2}
    F.sort(key=lambda x: order[x["etiket"]])

    trend_keys = ["revenue", "revenue_yoy", "gross_margin", "operating_margin", "net_margin", "ocf", "fcf",
                  "fcf_ttm", "fcf_margin_ttm", "ocf_to_ni_ttm", "sbc_to_revenue_ttm", "diluted_shares",
                  "diluted_shares_yoy", "ar", "dso", "inventory", "dio", "inventory_yoy", "deferred_revenue",
                  "deferred_revenue_yoy", "rpo", "rpo_yoy", "capex_to_revenue_ttm", "liquidity",
                  "cash_runway_months", "operating_income", "net_income"]
    trend = [{"etiket": x.get("etiket"), "donem_sonu": x["donem_sonu"], **{k: x.get(k) for k in trend_keys}}
             for x in rows[-8:]]
    return {
        "son_ceyrek": {"etiket": r.get("etiket"), "donem_sonu": r["donem_sonu"],
                       "rapor": filings.get(r.get("ilk_rapor_accn"), {})},
        "kopru_ceyrek": br,
        "kopru_ttm": _bridge(r, "_ttm"),
        "duzeltilmis_kar": adj,
        "bulgular": F,
        "trend": trend,
        "referanslar": {k: _ref(r, k, filings, cik) for k in CONCEPTS if r.get(k) is not None},
    }
