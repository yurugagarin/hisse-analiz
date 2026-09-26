"""Bilanço yorum motoru (deterministik, Claude'suz).

SEC XBRL'den hesaplanan tablo -> her bölüm için Türkçe analiz metni.
Kurallar: her rakam tablodan gelir; veri yoksa cümle kurulmaz ya da "veri yok" denir.
Yorum cümleleri kural tabanlıdır ve sitede YORUM olarak gösterilir. Her bölüm,
sitedeki Rehber sözlüğüne bağlanan kavram anahtarları (rehber) taşır.
"""
from __future__ import annotations

from common import rnd

# ----------------------------------------------------------------------------
# Biçimlendirme (Türkçe)
# ----------------------------------------------------------------------------


def _n(x: float, d: int = 1) -> str:
    s = f"{abs(x):,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def usd(x) -> str:
    if x is None:
        return "veri yok"
    a, sg = abs(x), ("−" if x < 0 else "")
    if a >= 1e9:
        return f"{sg}{_n(a / 1e9, 2 if a < 1e11 else 1)} milyar $"
    if a >= 1e6:
        return f"{sg}{_n(a / 1e6, 1)} milyon $"
    return f"{sg}{_n(a, 0)} $"


def pc(x, d: int = 1) -> str:
    return "veri yok" if x is None else f"{'−' if x < 0 else ''}%{_n(x, d)}"


def spc(x, d: int = 1) -> str:
    return "veri yok" if x is None else f"{'+' if x > 0 else '−' if x < 0 else ''}%{_n(x, d)}"


def pts(x) -> str:
    return "veri yok" if x is None else f"{'+' if x > 0 else '−' if x < 0 else ''}{_n(x, 1)} puan"


def kat(x) -> str:
    return "veri yok" if x is None else f"{_n(x, 2)}x"


def gun(x) -> str:
    return "veri yok" if x is None else f"{_n(x, 0)} gün"


def _lbl(r):
    return (r.get("etiket") or r.get("donem_sonu") or "").replace("FY", "MY ")


def _trend(vals: list, tol: float = 1.0) -> str | None:
    v = [x for x in vals if x is not None]
    if len(v) < 2:
        return None
    if v[-1] > v[-2] + tol:
        return "hizlaniyor"
    if v[-1] < v[-2] - tol:
        return "yavasliyor"
    return "yatay"


TREND_TR = {"hizlaniyor": "hızlandı", "yavasliyor": "yavaşladı", "yatay": "aşağı yukarı aynı kaldı"}

KALEM_TR = {"interest_income": "faiz geliri", "interest_expense": "faiz gideri",
            "warrant_fv": "warrant gerçeğe uygun değer değişimi", "derivative_gl": "türev araç kazanç/zararı",
            "investment_gl": "yatırım (hisse/menkul kıymet) kazançları", "debt_extinguishment": "borç kapama kazanç/zararı",
            "residual": "ayrıştırılamayan diğer faaliyet dışı kalemler"}


# ----------------------------------------------------------------------------
# Kaynak izleme: her yorum paragrafı hangi tablo satırından, hangi çeyreklerden geliyor?
# Sitede paragrafa tıklanınca tam tablolar açılır ve bu satır/hücreler vurgulanır.
# Dönem kipleri: c = bu çeyrek, y = bu çeyrek + geçen yılın aynı çeyreği,
# q = bu çeyrek + önceki çeyrek, t = son 4 çeyrek (TTM), ty = son 8 çeyrek (TTM'nin yıllık değişimi)
# ----------------------------------------------------------------------------

_K = {
    "revenue_yoy": [("revenue", "y")], "revenue_qoq": [("revenue", "q")],
    "revenue_ttm": [("revenue", "t")], "revenue_ttm_yoy": [("revenue", "ty")],
    "rpo_yoy": [("rpo", "y")], "deferred_revenue_yoy": [("deferred_revenue", "y")],
    "gross_margin": [("gross_profit", "c"), ("revenue", "c")],
    "gross_margin_yoy_pp": [("gross_profit", "y"), ("revenue", "y")],
    "operating_margin": [("operating_income", "c"), ("revenue", "c")],
    "operating_margin_yoy_pp": [("operating_income", "y"), ("revenue", "y")],
    "operating_margin_ttm": [("operating_income", "t"), ("revenue", "t")],
    "net_margin": [("net_income", "c"), ("revenue", "c")],
    "operating_income_yoy": [("operating_income", "y")], "net_income_yoy": [("net_income", "y")],
    "eps_yoy": [("eps_diluted", "y")], "diluted_shares_yoy": [("diluted_shares", "y")],
    "rd_to_revenue": [("rd", "c"), ("revenue", "c")], "sga_to_revenue": [("sga", "c"), ("revenue", "c")],
    "net_income_ttm": [("net_income", "t")], "ocf_ttm": [("ocf", "t")],
    "ocf_to_ni_ttm": [("ocf", "t"), ("net_income", "t")],
    "accruals_ratio": [("net_income", "t"), ("ocf", "t"), ("total_assets", "y")],
    "sbc_ttm": [("sbc", "t")], "sbc_to_revenue_ttm": [("sbc", "t"), ("revenue", "t")],
    "sbc_adj_fcf_ttm": [("ocf", "t"), ("capex", "t"), ("fcf", "t"), ("sbc", "t")],
    "sbc_adj_fcf_margin_ttm": [("ocf", "t"), ("capex", "t"), ("fcf", "t"), ("sbc", "t"), ("revenue", "t")],
    "capex_ttm": [("capex", "t")], "fcf_ttm": [("ocf", "t"), ("capex", "t"), ("fcf", "t")],
    "fcf_margin_ttm": [("ocf", "t"), ("capex", "t"), ("fcf", "t"), ("revenue", "t")],
    "capex_to_revenue_ttm": [("capex", "t"), ("revenue", "t")],
    "capex_to_revenue_ttm_yoy_pp": [("capex", "ty"), ("revenue", "ty")],
    "capex_to_da_ttm": [("capex", "t"), ("da", "t")],
    "buybacks_ttm": [("buybacks", "t")], "dividends_ttm": [("dividends", "t")], "acquisitions_ttm": [("acquisitions", "t")],
    "debt_repaid_ttm": [("debt_repaid", "t")], "debt_issued_ttm": [("debt_issued", "t")], "equity_issued_ttm": [("equity_issued", "t")],
    "shareholder_return_ttm": [("buybacks", "t"), ("dividends", "t")],
    "liquidity": [("cash", "c"), ("st_investments", "c")],
    "net_cash": [("cash", "c"), ("st_investments", "c"), ("total_debt", "c")],
    "cash_runway_months": [("cash", "c"), ("st_investments", "c"), ("ocf", "t"), ("capex", "t"), ("fcf", "t")],
    "current_ratio": [("current_assets", "c"), ("current_liabilities", "c")],
    "equity_ratio": [("equity", "c"), ("total_assets", "c")], "debt_to_equity": [("total_debt", "c"), ("equity", "c")],
    "goodwill_to_assets": [("goodwill", "c"), ("total_assets", "c")],
    "dso": [("ar", "c"), ("revenue", "c")], "dio": [("inventory", "c"), ("cogs", "c")], "dpo": [("ap", "c"), ("cogs", "c")],
    "ccc": [("ar", "c"), ("revenue", "c"), ("inventory", "c"), ("cogs", "c"), ("ap", "c")],
    "dso_yoy_change": [("ar", "y"), ("revenue", "y")],
    "ar_yoy": [("ar", "y")], "inventory_yoy": [("inventory", "y")],
    "receivables_vs_revenue_gap": [("ar", "y"), ("revenue", "y")], "inventory_vs_revenue_gap": [("inventory", "y"), ("revenue", "y")],
    "roe_ttm": [("net_income", "t"), ("equity", "y")],
    "roic_ttm": [("operating_income", "t"), ("equity", "c"), ("total_debt", "c"), ("cash", "c"), ("st_investments", "c")],
    "etr": [("tax", "c"), ("pretax", "c")],
}

# Türetilmiş oranların formülü (vurgulu tabloda "nasıl hesaplandı" olarak gösterilir)
_F = {
    "revenue_yoy": "Yıllık büyüme = bu çeyrek gelir ÷ geçen yılın aynı çeyreği gelir − 1",
    "revenue_qoq": "Çeyrekten çeyreğe = bu çeyrek gelir ÷ önceki çeyrek gelir − 1",
    "revenue_ttm": "TTM gelir = son 4 çeyreğin gelir toplamı",
    "revenue_ttm_yoy": "TTM büyüme = son 4 çeyrek gelir ÷ ondan önceki 4 çeyrek gelir − 1",
    "gross_margin": "Brüt marj = brüt kâr ÷ gelir",
    "gross_margin_yoy_pp": "Brüt marj değişimi = bu çeyrek brüt marj − geçen yılın aynı çeyreği brüt marj",
    "operating_margin": "Faaliyet marjı = faaliyet kârı ÷ gelir",
    "operating_margin_ttm": "TTM faaliyet marjı = son 4 çeyrek faaliyet kârı ÷ son 4 çeyrek gelir",
    "net_margin": "Net marj = net kâr ÷ gelir",
    "rd_to_revenue": "Ar-Ge / gelir = Ar-Ge gideri ÷ gelir",
    "sga_to_revenue": "SG&A / gelir = satış, genel ve yönetim giderleri ÷ gelir",
    "ocf_to_ni_ttm": "Nakit / kâr = son 4 çeyrek işletme nakit akışı ÷ son 4 çeyrek net kâr",
    "accruals_ratio": "Tahakkuk oranı = (TTM net kâr − TTM işletme nakdi) ÷ ortalama toplam varlık (bu çeyrek ve bir yıl önce)",
    "sbc_to_revenue_ttm": "SBC / gelir = son 4 çeyrek hisse bazlı ödeme ÷ son 4 çeyrek gelir",
    "sbc_adj_fcf_ttm": "SBC sonrası FCF = TTM serbest nakit akışı − TTM hisse bazlı ödeme",
    "fcf_ttm": "Serbest nakit akışı = işletme nakit akışı − capex (son 4 çeyrek)",
    "fcf_margin_ttm": "FCF marjı = TTM serbest nakit akışı ÷ TTM gelir",
    "capex_to_revenue_ttm": "Capex / gelir = TTM capex ÷ TTM gelir",
    "capex_to_da_ttm": "Capex / amortisman = TTM capex ÷ TTM amortisman",
    "shareholder_return_ttm": "Hissedara dönen = TTM geri alım + TTM temettü",
    "liquidity": "Likidite = nakit ve benzerleri + kısa vadeli yatırımlar",
    "net_cash": "Net nakit = nakit + kısa vadeli yatırımlar − finansal borç",
    "cash_runway_months": "Nakit pisti = likidite ÷ (TTM nakit yakma ÷ 12)",
    "current_ratio": "Cari oran = dönen varlıklar ÷ kısa vadeli yükümlülükler",
    "equity_ratio": "Özkaynak oranı = özkaynak ÷ toplam varlıklar",
    "debt_to_equity": "Borç / özkaynak = finansal borç ÷ özkaynak",
    "goodwill_to_assets": "Şerefiye / varlık = şerefiye ÷ toplam varlıklar",
    "dso": "DSO = ticari alacaklar ÷ çeyrek geliri × çeyrekteki gün sayısı",
    "dio": "DIO = stoklar ÷ satışların maliyeti × çeyrekteki gün sayısı",
    "dpo": "DPO = ticari borçlar ÷ satışların maliyeti × çeyrekteki gün sayısı",
    "ccc": "Nakit dönüşüm döngüsü = DSO + DIO − DPO",
    "receivables_vs_revenue_gap": "Fark = alacakların yıllık büyümesi − gelirin yıllık büyümesi",
    "inventory_vs_revenue_gap": "Fark = stokların yıllık büyümesi − gelirin yıllık büyümesi",
    "roe_ttm": "ROE = TTM net kâr ÷ ortalama özkaynak (bu çeyrek ve bir yıl önce)",
    "roic_ttm": "ROIC ≈ TTM faaliyet kârı × 0,79 ÷ (özkaynak + finansal borç − nakit ve kısa vadeli yatırımlar)",
    "etr": "Efektif vergi oranı = vergi gideri ÷ vergi öncesi kâr",
    "kopru": "Köprü: faaliyet kârı + faaliyet dışı kalemler = vergi öncesi kâr",
}


# Bilanço rehberi maddesi -> tablo kaynakları (rehber sayfasında "tabloda gör" için)
REHBER_K = {
    "ttm": ["revenue_ttm"], "yoy": ["revenue_yoy"], "qoq": ["revenue_qoq"], "kopru": ["kopru", "tax", "net_income"],
    "gelir": ["revenue"], "rpo": ["rpo_yoy"], "ertelenmis_gelir": ["deferred_revenue_yoy"],
    "brut_marj": ["gross_margin", "cogs"], "faaliyet_marji": ["operating_margin", "rd", "sga"], "net_marj": ["net_margin"],
    "operasyonel_kaldirac": ["operating_income_yoy", "revenue_yoy"], "eps": ["eps_diluted", "net_income", "diluted_shares"],
    "ocf_ni": ["ocf_to_ni_ttm"], "accruals": ["accruals_ratio"], "faaliyet_disi": ["kopru"],
    "sbc": ["sbc_to_revenue_ttm"], "sbc_fcf": ["sbc_adj_fcf_ttm"], "efektif_vergi": ["etr"],
    "ocf": ["ocf", "net_income", "da", "sbc"], "capex": ["capex"], "fcf": ["fcf_ttm"], "capex_da": ["capex_to_da_ttm"],
    "geri_alim": ["shareholder_return_ttm"], "nakit_pisti": ["cash_runway_months"],
    "net_nakit": ["net_cash"], "cari_oran": ["current_ratio"], "ozkaynak_orani": ["equity_ratio"],
    "serefiye": ["goodwill_to_assets", "intangibles"], "borc_ozkaynak": ["debt_to_equity"],
    "dso": ["dso"], "dio": ["dio"], "dpo": ["dpo"], "ccc": ["ccc"],
    "sulandirma": ["diluted_shares_yoy"], "roe": ["roe_ttm"], "roic": ["roic_ttm"],
}


class _Ps(list):
    """Paragraf listesi: her öğe [metin, [kaynak anahtarları]]."""

    def add(self, text, *keys):
        if text:
            self.append([text, list(keys)])

    def ext(self, text, *keys):
        self[-1][0] += text
        self[-1][1].extend(keys)


def _kaynak(rows, keys, bridge=None):
    """Anahtarlar -> [{"k": tablo satırı, "d": [dönem sonları]}] + formüller.

    Anahtar biçimi: "metrik" (bu çeyrek), "metrik@y" (metriğin bir yıl önceki değeri),
    "metrik@p" (önceki çeyrekteki değeri), "metrik@s5" (son 5 çeyreğin serisi), "kopru" (faaliyet dışı köprü).
    """
    if not rows:
        return {"satirlar": [], "formuller": []}
    ends = [r["donem_sonu"] for r in rows]
    pos = {e: i for i, e in enumerate(ends)}

    def yago(i):
        return pos.get(rows[i].get("onceki_yil_donem"))

    def periods(i, mode):
        if i is None or i < 0:
            return set()
        if mode == "c":
            return {i}
        if mode == "y":
            j = yago(i)
            return {i} | ({j} if j is not None else set())
        if mode == "q":
            return {i, i - 1} if i > 0 else {i}
        if mode == "t":
            return set(range(max(0, i - 3), i + 1))
        if mode == "ty":
            return set(range(max(0, i - 7), i + 1))
        return {i}

    last = len(rows) - 1
    out: dict[str, set] = {}
    formuller = []
    for key in keys:
        m, _, at = key.partition("@")
        if m == "kopru":
            lines = [("operating_income", "c"), ("pretax", "c")] + [
                (k["key"], "c") for k in (bridge or {}).get("kalemler", []) if k.get("key") != "residual"]
        else:
            lines = _K.get(m, [(m, "c")])
        if at == "y":
            idx = [yago(last)]
        elif at == "p":
            idx = [last - 1]
        elif at.startswith("s"):
            idx = list(range(max(0, last - int(at[1:]) + 1), last + 1))
        else:
            idx = [last]
        for line, mode in lines:
            for i in idx:
                ps = periods(i, mode)
                if ps:
                    out.setdefault(line, set()).update(ps)
        if m in _F and _F[m] not in formuller:
            formuller.append(_F[m])
    satirlar = [{"k": k, "d": [ends[i] for i in sorted(v) if 0 <= i < len(ends)]}
                for k, v in out.items() if any(rows[i].get(k) is not None for i in v if 0 <= i < len(rows))]
    return {"satirlar": satirlar, "formuller": formuller}


def _sec(id_, baslik, durum, manset, paragraflar, rakamlar, rehber, grafik=None):
    return {"id": id_, "baslik": baslik, "durum": durum, "manset": manset,
            "paragraflar": [p for p in paragraflar if p], "rakamlar": [r for r in rakamlar if r],
            "rehber": rehber, "grafik": grafik or []}


def _tile(etiket, deger, alt=None, rehber=None, ton=None, kaynak=None):
    return {"etiket": etiket, "deger": deger, "alt": alt, "rehber": rehber, "ton": ton, "_k": kaynak or []}


def _worst(*st):
    order = {"kirmizi": 3, "dikkat": 2, "notr": 1, "olumlu": 0}
    st = [s for s in st if s]
    return max(st, key=lambda s: order[s]) if st else "notr"


# ----------------------------------------------------------------------------
# Bölümler
# ----------------------------------------------------------------------------

def hikaye(T, name, rows, bridge):
    r = rows[-1]
    p = rows[-2] if len(rows) > 1 else {}
    L = _lbl(r)
    out = _Ps()
    if r.get("revenue") is not None:
        s = f"{name}, {L} döneminde {usd(r['revenue'])} gelir açıkladı"
        if r.get("revenue_yoy") is not None:
            s += f"; bu, geçen yılın aynı çeyreğine göre {spc(r['revenue_yoy'])} değişim demek"
        s += "."
        tr = _trend([p.get("revenue_yoy"), r.get("revenue_yoy")], 1.5)
        if tr and p.get("revenue_yoy") is not None:
            s += f" Yıllık büyüme bir önceki çeyrekteki {pc(p['revenue_yoy'])} seviyesine göre {TREND_TR[tr]}."
        if r.get("revenue_qoq") is not None:
            s += f" Bir önceki çeyreğe göre gelir {spc(r['revenue_qoq'])} değişti."
        out.add(s, "revenue_yoy", "revenue_yoy@p", "revenue_qoq")
    if r.get("gross_margin") is not None and r.get("operating_margin") is not None:
        s = (f"Brüt marj {pc(r['gross_margin'])} ({pts(r.get('gross_margin_yoy_pp'))} yıllık), "
             f"faaliyet marjı {pc(r['operating_margin'])} ({pts(r.get('operating_margin_yoy_pp'))}).")
        oy, ry = r.get("operating_income_yoy"), r.get("revenue_yoy")
        if oy is not None and ry is not None and r.get("operating_income", 0) > 0:
            if oy > ry + 3:
                s += (f" Faaliyet kârı {spc(oy)} ile gelirden hızlı büyüdü: giderler gelirden yavaş arttı, "
                      "yani operasyonel kaldıraç çalışıyor.")
            elif oy < ry - 3:
                s += (f" Faaliyet kârı {spc(oy)} ile gelirden yavaş büyüdü: giderler gelirden hızlı arttı; "
                      "marj baskısı var.")
            else:
                s += f" Faaliyet kârı gelirle aynı hızda ({spc(oy)}) büyüdü."
        elif (r.get("operating_income") or 0) <= 0:
            s += f" Şirket faaliyet düzeyinde {usd(r.get('operating_income'))} zarar etti."
        out.add(s, "gross_margin_yoy_pp", "operating_margin_yoy_pp", "revenue_yoy", "operating_income_yoy")
    if r.get("net_income") is not None and r.get("operating_income") is not None and bridge:
        items = sorted(bridge.get("kalemler", []), key=lambda k: -abs(k["tutar"]))
        nonop = bridge.get("faaliyet_disi_toplam")
        s = f"Net kâr {usd(r['net_income'])}."
        if nonop is not None and r.get("pretax") and r["pretax"] > 0:
            share = abs(nonop) / abs(r["pretax"]) * 100 if r["pretax"] else 0
            if items and share >= 5:
                big = items[0]
                s += (f" Faaliyet dışı kalemler vergi öncesi kârı {usd(nonop)} etkiledi (vergi öncesi kârın {pc(share, 0)}); "
                      f"en büyük kalem {KALEM_TR.get(big['key'], big['kalem'])}: {usd(big['tutar'])}.")
                if big["key"] in ("investment_gl", "warrant_fv", "derivative_gl", "debt_extinguishment"):
                    s += " Bu tür kalemler tekrarlayan faaliyet kârı değildir; net kârı olduğundan güçlü (veya zayıf) gösterebilir."
            else:
                s += " Faaliyet dışı kalemlerin etkisi küçük; net kâr büyük ölçüde esas faaliyetten geliyor."
        out.add(s, "net_income", "kopru")
    if r.get("ocf") is not None:
        s = f"Çeyrekte işletme faaliyetlerinden {usd(r['ocf'])} nakit elde edildi"
        if r.get("net_income") and r["net_income"] > 0:
            s += f", net kârın {_n(r['ocf'] / r['net_income'], 2)} katı"
        s += "."
        wc, wck = _wc_story(rows)
        if wc:
            s += " " + wc
        if r.get("fcf_ttm") is not None:
            s += f" Son 12 ayda serbest nakit akışı {usd(r['fcf_ttm'])} (gelirin {pc(r.get('fcf_margin_ttm'))})."
        out.add(s, "ocf", "net_income", *wck, *(["fcf_margin_ttm"] if r.get("fcf_ttm") is not None else []))
    bs, bsk = [], []
    if r.get("liquidity") is not None:
        bsk += ["net_cash"]
        bs.append(f"Çeyrek sonunda nakit ve kısa vadeli yatırımlar {usd(r['liquidity'])}")
        if r.get("total_debt"):
            bs[-1] += f", finansal borç {usd(r['total_debt'])}, net nakit {usd(r.get('net_cash'))}"
        bs[-1] += "."
    if r.get("diluted_shares_yoy") is not None:
        bsk += ["diluted_shares_yoy", "buybacks_ttm", "sbc_ttm"]
        bs.append(f"Seyreltilmiş hisse sayısı yıllık {spc(r['diluted_shares_yoy'])} değişti"
                  + (f"; son 12 ayda {usd(r.get('buybacks_ttm'))} geri alım yapıldı" if r.get("buybacks_ttm") else "")
                  + (f", hisse bazlı ödeme (SBC) {usd(r.get('sbc_ttm'))}" if r.get("sbc_ttm") else "") + ".")
    if bs:
        out.add(" ".join(bs), *bsk)
    return out


def _wc_story(rows):
    """Çeyrek içi işletme sermayesi değişimi: nakdi ne bağladı/ne serbest bıraktı."""
    if len(rows) < 2:
        return None, []
    r, p = rows[-1], rows[-2]
    parts, keys = [], []
    for k, ad, sign in (("ar", "alacaklar", -1), ("inventory", "stoklar", -1), ("ap", "ticari borçlar", 1),
                        ("deferred_revenue", "ertelenmiş gelir", 1)):
        a, b = r.get(k), p.get(k)
        if a is None or b is None:
            continue
        d = a - b
        if r.get("revenue") and abs(d) >= 0.02 * r["revenue"]:
            etki = "nakit bağladı" if d * sign < 0 else "nakit serbest bıraktı"
            parts.append(f"{ad} {usd(abs(d))} {'arttı' if d > 0 else 'azaldı'} ve {etki}")
            keys += [k, k + "@p"]
    if not parts:
        return None, []
    return "İşletme sermayesinde: " + "; ".join(parts) + ".", keys


def buyume(T, rows):
    r = rows[-1]
    yoys = [(_lbl(x), x.get("revenue_yoy")) for x in rows[-5:] if x.get("revenue_yoy") is not None]
    tr = _trend([x[1] for x in yoys], 1.5)
    ry = r.get("revenue_yoy")
    durum = "notr" if ry is None else ("olumlu" if ry >= 15 else "dikkat" if ry < 5 else "notr")
    manset = (f"Gelir yıllık {spc(ry)} büyüdü; büyüme {TREND_TR.get(tr, 'belirsiz')}." if ry is not None
              else "Yıllık büyüme hesaplanamadı (veri yok).")
    ps = _Ps()
    if yoys:
        ps.add("Son çeyreklerde yıllık büyüme: " + " → ".join(f"{l} {pc(v)}" for l, v in yoys) + ".", "revenue_yoy@s5")
    if r.get("revenue_ttm") is not None:
        ps.add(f"Son 12 ay (TTM) gelir {usd(r['revenue_ttm'])}; bir yıl önceki TTM'ye göre {spc(r.get('revenue_ttm_yoy'))}. "
                  "Tek çeyrekteki dalgalanmayı TTM rakamı yumuşatır; eğilimi o gösterir.", "revenue_ttm", "revenue_ttm_yoy")
    if r.get("rpo") is not None and r.get("revenue_ttm") and r["rpo"] >= 0.25 * r["revenue_ttm"]:
        ps.add(f"Kalan edim yükümlülüğü (RPO, imzalanmış ama henüz gelire dönüşmemiş sözleşmeler) {usd(r['rpo'])}, "
                  f"yıllık {spc(r.get('rpo_yoy'))}. RPO gelirden hızlı büyüyorsa gelecek dönem gelirleri için görünürlük artıyor demektir.", "rpo_yoy")
        if r.get("rpo_yoy") is not None and ry is not None:
            ps.ext(" Şu an RPO gelirden hızlı büyüyor." if r["rpo_yoy"] > ry else " Şu an RPO gelirden yavaş büyüyor; bu izlenmeli.", "revenue_yoy")
            if r["rpo_yoy"] < ry - 5:
                durum = _worst(durum, "dikkat")
    if r.get("deferred_revenue") is not None:
        ps.add(f"Ertelenmiş gelir (müşteriden peşin alınan, henüz hizmeti verilmemiş tutar) {usd(r['deferred_revenue'])}, "
               f"yıllık {spc(r.get('deferred_revenue_yoy'))}.", "deferred_revenue_yoy")
    if r.get("acquisitions_ttm") and r.get("revenue_ttm") and r["acquisitions_ttm"] / r["revenue_ttm"] > 0.03:
        ps.add(f"Son 12 ayda satın almalara {usd(r['acquisitions_ttm'])} ödendi. Büyümenin bir kısmı satın alınan şirketlerden "
               "gelebilir; organik büyümeyi ayırmak için işletme birleşmeleri dipnotuna bakmak gerekir.", "acquisitions_ttm", "revenue_ttm")
        durum = _worst(durum, "dikkat")
    tiles = [_tile("Çeyrek gelir", usd(r.get("revenue")), _lbl(r), "gelir", kaynak=["revenue"]),
             _tile("Yıllık büyüme", spc(ry), f"önceki çeyrek {pc(rows[-2].get('revenue_yoy')) if len(rows) > 1 else '—'}", "yoy",
                   kaynak=["revenue_yoy", "revenue_yoy@p"]),
             _tile("Çeyrekten çeyreğe", spc(r.get("revenue_qoq")), None, "qoq", kaynak=["revenue_qoq"]),
             _tile("TTM gelir", usd(r.get("revenue_ttm")), spc(r.get("revenue_ttm_yoy")), "ttm", kaynak=["revenue_ttm_yoy"])]
    if r.get("rpo") is not None and r.get("revenue_ttm") and r["rpo"] >= 0.25 * r["revenue_ttm"]:
        tiles.append(_tile("RPO", usd(r["rpo"]), spc(r.get("rpo_yoy")) + " yıllık", "rpo", kaynak=["rpo_yoy"]))
    return _sec("buyume", "Büyüme", durum, manset, ps, tiles, ["gelir", "yoy", "qoq", "ttm", "rpo", "ertelenmis_gelir"],
                ["revenue", "revenue_yoy"])


def karlilik(T, rows):
    r = rows[-1]
    gm = [(_lbl(x), x.get("gross_margin")) for x in rows[-5:] if x.get("gross_margin") is not None]
    om = [(_lbl(x), x.get("operating_margin")) for x in rows[-5:] if x.get("operating_margin") is not None]
    ps = _Ps()
    durum = "notr"
    if gm:
        ps.add("Brüt marj (her 100 $ gelirden üretim maliyeti düşüldükten sonra kalan): "
               + " → ".join(f"{l} {pc(v)}" for l, v in gm) + ".", "gross_margin@s5", "cogs@s5")
        d = r.get("gross_margin_yoy_pp")
        if d is not None:
            if d <= -3:
                ps.ext(f" Yıllık {pts(d)} gerileme fiyatlama gücünde zayıflama, ürün karması değişimi veya maliyet artışına işaret edebilir.", "gross_margin_yoy_pp")
                durum = "dikkat"
            elif d >= 3:
                ps.ext(f" Yıllık {pts(d)} iyileşme fiyatlama gücü veya ölçek etkisine işaret ediyor.", "gross_margin_yoy_pp")
                durum = "olumlu"
    if om:
        ps.add("Faaliyet marjı (Ar-Ge, satış ve genel giderler de düşüldükten sonra): "
               + " → ".join(f"{l} {pc(v)}" for l, v in om) + ".", "operating_margin@s5", "rd@s5", "sga@s5")
    opex, opk = [], []
    if r.get("rd_to_revenue") is not None:
        opex.append(f"Ar-Ge gideri gelirin {pc(r['rd_to_revenue'])}")
        opk.append("rd_to_revenue")
    if r.get("sga_to_revenue") is not None:
        opex.append(f"satış/genel yönetim giderleri gelirin {pc(r['sga_to_revenue'])}")
        opk.append("sga_to_revenue")
    if opex:
        ps.add(("; ".join(opex)).capitalize() + ". Bu oranların zamanla düşmesi, şirketin büyürken giderlerini daha verimli kullandığını gösterir.", *opk)
    oy, ry = r.get("operating_income_yoy"), r.get("revenue_yoy")
    if oy is not None and ry is not None and (r.get("operating_income") or 0) > 0:
        lev = oy - ry
        ps.add(f"Operasyonel kaldıraç: faaliyet kârı yıllık {spc(oy)}, gelir {spc(ry)}. "
                  + ("Kâr gelirden hızlı büyüyor; ölçek ekonomisi çalışıyor." if lev > 3 else
                     "Kâr gelirden yavaş büyüyor; giderler (çoğu zaman yatırım/Ar-Ge veya satın alma maliyetleri) marjı sıkıştırıyor." if lev < -3
                     else "Kâr ve gelir benzer hızda büyüyor."), "operating_income_yoy", "revenue_yoy")
        if lev < -10:
            durum = _worst(durum, "dikkat")
    if (r.get("operating_income") or 0) < 0:
        durum = "kirmizi" if (r.get("operating_margin_ttm") or 0) < -10 else _worst(durum, "dikkat")
        ps.add(f"Şirket faaliyet düzeyinde zararda: son 12 ayda faaliyet marjı {pc(r.get('operating_margin_ttm'))}.", "operating_margin_ttm")
    if r.get("eps_diluted") is not None:
        ek = ["eps_diluted"]
        s = f"Seyreltilmiş hisse başına kâr (EPS) {_n(r['eps_diluted'], 2)} $"
        if r.get("eps_yoy") is not None and r.get("net_income_yoy") is not None:
            s += f", yıllık {spc(r['eps_yoy'])} (net kâr {spc(r['net_income_yoy'])})."
            ek += ["eps_yoy", "net_income_yoy", "diluted_shares_yoy"]
            if r["eps_yoy"] > r["net_income_yoy"] + 2:
                s += " EPS net kârdan hızlı büyüyor: hisse geri alımları hisse başına kârı destekliyor."
            elif r["eps_yoy"] < r["net_income_yoy"] - 2:
                s += " EPS net kârdan yavaş büyüyor: hisse sayısı arttığı için (sulandırma) kârın hissedara düşen payı azalıyor."
        else:
            s += "."
        ps.add(s, *ek)
    manset = (f"Brüt marj {pc(r.get('gross_margin'))}, faaliyet marjı {pc(r.get('operating_margin'))}, net marj {pc(r.get('net_margin'))}.")
    tiles = [_tile("Brüt marj", pc(r.get("gross_margin")), pts(r.get("gross_margin_yoy_pp")) + " yıllık", "brut_marj",
                   kaynak=["gross_margin", "gross_margin_yoy_pp", "cogs"]),
             _tile("Faaliyet marjı", pc(r.get("operating_margin")), pts(r.get("operating_margin_yoy_pp")) + " yıllık", "faaliyet_marji",
                   kaynak=["operating_margin", "operating_margin_yoy_pp"]),
             _tile("Net marj", pc(r.get("net_margin")), None, "net_marj", kaynak=["net_margin"]),
             _tile("EPS (seyreltilmiş)", f"{_n(r['eps_diluted'], 2)} $" if r.get("eps_diluted") is not None else "veri yok",
                   spc(r.get("eps_yoy")) + " yıllık" if r.get("eps_yoy") is not None else None, "eps", kaynak=["eps_yoy"])]
    return _sec("karlilik", "Kârlılık", durum, manset, ps, tiles,
                ["brut_marj", "faaliyet_marji", "net_marj", "operasyonel_kaldirac", "eps"],
                ["gross_margin", "operating_margin", "net_margin"])


def kazanc_kalitesi(T, rows, q):
    r = rows[-1]
    ps = _Ps()
    durum = "notr"
    on = r.get("ocf_to_ni_ttm")
    if on is not None:
        ps.add(f"Son 12 ayda işletme nakit akışı net kârın {_n(on, 2)} katı. "
                  + ("1'in üzerinde olması, muhasebe kârının nakitle desteklendiğini gösterir (amortisman ve SBC gibi nakit dışı giderler de bunu yükseltir)."
                     if on >= 1 else
                     "1'in altında olması, kârın bir kısmının henüz nakde dönmediğini gösterir: genelde alacak veya stok artışı, bazen de nakit dışı kazançlar (ör. yatırım değerlemeleri) nedeniyle."), "ocf_to_ni_ttm")
        durum = "olumlu" if on >= 1 else ("dikkat" if on >= 0.7 else "kirmizi")
    elif (r.get("net_income_ttm") or 0) <= 0 and r.get("net_income_ttm") is not None:
        ps.add(f"Son 12 ayda net zarar var ({usd(r['net_income_ttm'])}); nakit/kâr oranı anlamlı değil. "
               f"İşletme nakit akışı {usd(r.get('ocf_ttm'))}.", "net_income_ttm", "ocf_ttm")
        durum = "kirmizi" if (r.get("ocf_ttm") or 0) < 0 else "dikkat"
    ei = r.get("equity_investments")
    if ei and r.get("total_assets") and ei / r["total_assets"] >= 0.05:
        ps.add(f"Şirketin bilançosunda {usd(ei)} tutarında hisse yatırımı var (halka açık şirket hisseleri ve özel şirket payları; "
                  f"toplam varlıkların {pc(ei / r['total_assets'] * 100, 0)}). Bu yatırımların değer değişimleri faaliyet dışı kazanç/zarar "
                  "olarak net kâra yansır ve nakit değildir; kârdaki bu kısım tekrarlanmayabilir.",
               "equity_investments", "total_assets", "investment_gl")
        durum = _worst(durum, "dikkat")
    ac = r.get("accruals_ratio")
    if ac is not None:
        ps.add(f"Tahakkuk oranı {pc(ac)} (net kâr − işletme nakit akışı, ortalama varlıklara bölünmüş). "
                  + ("Negatif veya sıfıra yakın olması iyidir: kâr büyük ölçüde nakit." if ac <= 2 else
                     "Pozitif ve yüksek olması, kârın tahakkuklara (henüz tahsil edilmemiş gelirler, değerlemeler) dayandığını gösterir; akademik çalışmalarda yüksek tahakkuk sonraki dönem zayıf getiriyle ilişkilendirilir."), "accruals_ratio")
        if ac > 5:
            durum = _worst(durum, "dikkat")
    b = (q or {}).get("kopru_ceyrek") or {}
    nonop = b.get("faaliyet_disi_toplam")
    if nonop is not None and r.get("pretax"):
        share = abs(nonop) / abs(r["pretax"]) * 100
        if r["pretax"] < 0:
            ps.add(f"Bu çeyrek faaliyet dışı kalemlerin toplamı {usd(nonop)}; şirket vergi öncesi zararda "
                   f"({usd(r['pretax'])}), yani zarar esas faaliyetten kaynaklanıyor.", "kopru")
        else:
            ps.add(f"Bu çeyrek faaliyet dışı kalemlerin toplamı {usd(nonop)}; vergi öncesi kârın {pc(share, 0)}. "
                      + ("Oran düşük: kâr esas faaliyetten geliyor." if share < 5 else
                         "Kârın küçük ama göz ardı edilmemesi gereken bir kısmı faiz, yatırım kazancı veya değerleme gibi tekrarlanması belirsiz kalemlerden geliyor; köprü grafiği kalemleri tek tek gösteriyor." if share < 20 else
                         "Oran yüksek: kârın önemli bir kısmı tekrarlanması belirsiz kalemlerden geliyor; köprü grafiği kalemleri tek tek gösteriyor."), "kopru")
        if share >= 20 and r["pretax"] > 0:
            durum = _worst(durum, "dikkat")
    if r.get("sbc_to_revenue_ttm") is not None:
        s = f"Hisse bazlı ödeme (SBC) gelirin {pc(r['sbc_to_revenue_ttm'])}."
        sk = ["sbc_to_revenue_ttm"]
        if r.get("sbc_adj_fcf_ttm") is not None:
            sk += ["sbc_adj_fcf_ttm", "sbc_adj_fcf_margin_ttm"]
            s += (f" SBC gerçek bir maliyettir: serbest nakit akışından SBC düşülünce son 12 ayda {usd(r['sbc_adj_fcf_ttm'])} kalıyor "
                  f"(gelirin {pc(r.get('sbc_adj_fcf_margin_ttm'))}).")
        ps.add(s, *sk)
        if r["sbc_to_revenue_ttm"] > 15:
            durum = _worst(durum, "dikkat")
    if r.get("pretax") and r["pretax"] > 0 and r.get("tax") is not None:
        etr = r["tax"] / r["pretax"] * 100
        ps.add(f"Çeyreğin efektif vergi oranı {pc(etr)}. "
                  + ("Olağan aralıkta." if 10 <= etr <= 25 else
                     "Olağan dışı: tek seferlik vergi etkileri (ertelenmiş vergi ayarlamaları, vergi indirimleri) net kârı geçici olarak etkileyebilir."), "etr")
    flags = [f for f in (q or {}).get("bulgular", []) if f["etiket"] != "olumlu"]
    durum = _worst(durum, *("kirmizi" if f["etiket"] == "kirmizi_bayrak" else "dikkat" for f in flags))
    manset = ("Kâr nakitle destekleniyor." if durum == "olumlu" else
              "Kâr kalitesinde dikkat edilecek noktalar var." if durum == "dikkat" else
              "Kâr kalitesi zayıf ya da şirket zararda." if durum == "kirmizi" else "Kâr kalitesi göstergeleri karışık.")
    tiles = [_tile("İşletme nakdi / net kâr", kat(on), "TTM", "ocf_ni", kaynak=["ocf_to_ni_ttm"]),
             _tile("Tahakkuk oranı", pc(ac), "düşük iyi", "accruals", kaynak=["accruals_ratio"]),
             _tile("SBC / gelir", pc(r.get("sbc_to_revenue_ttm")), "TTM", "sbc", kaynak=["sbc_to_revenue_ttm"]),
             _tile("SBC sonrası FCF", usd(r.get("sbc_adj_fcf_ttm")), "TTM", "sbc_fcf", kaynak=["sbc_adj_fcf_ttm"])]
    return _sec("kazanc_kalitesi", "Kazanç kalitesi", durum, manset, ps, tiles,
                ["ocf_ni", "accruals", "faaliyet_disi", "sbc", "sbc_fcf", "efektif_vergi"], ["ocf", "net_income"])


def nakit_akisi(T, rows):
    r = rows[-1]
    ps = _Ps()
    durum = "notr"
    if r.get("ocf_ttm") is not None:
        ps.add(f"Son 12 ayda işletme faaliyetlerinden {usd(r['ocf_ttm'])} nakit girdi, yatırım harcaması (capex) {usd(r.get('capex_ttm'))} "
                  f"oldu; geriye {usd(r.get('fcf_ttm'))} serbest nakit akışı (FCF) kaldı. FCF marjı {pc(r.get('fcf_margin_ttm'))}.",
               "fcf_ttm", "fcf_margin_ttm")
        fm = r.get("fcf_margin_ttm")
        durum = "olumlu" if fm is not None and fm >= 15 else "kirmizi" if fm is not None and fm < 0 else "notr"
    if r.get("capex_to_revenue_ttm") is not None:
        s = f"Capex gelirin {pc(r['capex_to_revenue_ttm'])}"
        ck = ["capex_to_revenue_ttm"]
        if r.get("capex_to_revenue_ttm_yoy_pp") is not None:
            ck.append("capex_to_revenue_ttm_yoy_pp")
            s += f" (bir yıl önceye göre {pts(r['capex_to_revenue_ttm_yoy_pp'])})"
        s += "."
        if r.get("capex_to_da_ttm") is not None:
            ck.append("capex_to_da_ttm")
            s += (f" Capex amortismanın {_n(r['capex_to_da_ttm'], 1)} katı: "
                  + ("şirket yıpranan varlıklarını yenilemenin çok ötesinde, büyüme için yatırım yapıyor." if r["capex_to_da_ttm"] > 1.5 else
                     "yatırım aşağı yukarı yıpranmayı karşılayacak düzeyde." if r["capex_to_da_ttm"] >= 0.8 else
                     "yatırım amortismanın altında; varlık tabanı küçülüyor olabilir."))
        ps.add(s, *ck)
    uses, uk = [], []
    for k, ad in (("buybacks_ttm", "hisse geri alımı"), ("dividends_ttm", "temettü"), ("acquisitions_ttm", "satın almalar"),
                  ("debt_repaid_ttm", "borç geri ödemesi")):
        if r.get(k):
            uses.append(f"{ad} {usd(r[k])}")
            uk.append(k)
    srcs = []
    for k, ad in (("equity_issued_ttm", "hisse ihracı / opsiyon"), ("debt_issued_ttm", "borçlanma")):
        if r.get(k):
            srcs.append(f"{ad} {usd(r[k])}")
            uk.append(k)
    if uses or srcs:
        s = "Son 12 ayda nakdin kullanımı: " + (", ".join(uses) if uses else "kayda değer dağıtım yok") + "."
        if srcs:
            s += " Dışarıdan sağlanan kaynak: " + ", ".join(srcs) + "."
        if r.get("fcf_ttm") and r["fcf_ttm"] > 0 and r.get("shareholder_return_ttm"):
            s += f" Hissedara dönen tutar (geri alım + temettü) FCF'nin {pc(r['shareholder_return_ttm'] / r['fcf_ttm'] * 100, 0)}."
            uk += ["shareholder_return_ttm", "fcf_ttm"]
        ps.add(s, *uk)
    if r.get("fcf_ttm") is not None and r["fcf_ttm"] < 0:
        ps.add(f"Şirket nakit yakıyor. Nakit ve kısa vadeli yatırımlar {usd(r.get('liquidity'))}; bu hızla yaklaşık "
                  f"{_n(r['cash_runway_months'], 1) + ' ay' if r.get('cash_runway_months') is not None else 'hesaplanamayan bir süre'} yeter. "
                  "Pist kısaldıkça hisse ihracı (sulandırma) veya borçlanma olasılığı artar.", "cash_runway_months")
        durum = "kirmizi" if (r.get("cash_runway_months") or 99) < 12 else "dikkat"
    manset = (f"Son 12 ayda {usd(r.get('fcf_ttm'))} serbest nakit akışı üretildi." if (r.get("fcf_ttm") or 0) >= 0
              else f"Son 12 ayda {usd(r.get('fcf_ttm'))} nakit yakıldı.") if r.get("fcf_ttm") is not None else "Serbest nakit akışı hesaplanamadı (veri yok)."
    tiles = [_tile("İşletme nakit akışı", usd(r.get("ocf_ttm")), "TTM", "ocf", kaynak=["ocf_ttm"]),
             _tile("Capex", usd(r.get("capex_ttm")), pc(r.get("capex_to_revenue_ttm")) + " gelir", "capex", kaynak=["capex_to_revenue_ttm"]),
             _tile("Serbest nakit akışı", usd(r.get("fcf_ttm")), pc(r.get("fcf_margin_ttm")) + " marj", "fcf", kaynak=["fcf_margin_ttm"]),
             _tile("Geri alım + temettü", usd(r.get("shareholder_return_ttm")), "TTM", "geri_alim", kaynak=["shareholder_return_ttm"])]
    if r.get("cash_runway_months") is not None:
        tiles.append(_tile("Nakit pisti", f"{_n(r['cash_runway_months'], 1)} ay", None, "nakit_pisti",
                           "kirmizi" if r["cash_runway_months"] < 12 else "dikkat", kaynak=["cash_runway_months"]))
    return _sec("nakit_akisi", "Nakit akışı ve sermaye tahsisi", durum, manset, ps, tiles,
                ["ocf", "capex", "fcf", "capex_da", "geri_alim", "nakit_pisti"], ["ocf", "capex", "fcf"])


def bilanco_saglamligi(T, rows):
    r = rows[-1]
    py = next((x for x in rows if x["donem_sonu"] == r.get("onceki_yil_donem")), None)
    ps = _Ps()
    durum = "notr"
    if r.get("total_assets") is not None:
        bk = ["total_assets", "total_liabilities", "equity"]
        s = f"Toplam varlıklar {usd(r['total_assets'])}"
        if r.get("total_liabilities") is not None:
            s += f", toplam yükümlülükler {usd(r['total_liabilities'])}"
        if r.get("equity") is not None:
            s += f", özkaynak {usd(r['equity'])}"
        s += "."
        if py and py.get("total_assets"):
            s += f" Varlıklar bir yılda {spc((r['total_assets'] / py['total_assets'] - 1) * 100)} büyüdü."
            bk.append("total_assets@y")
        ps.add(s, *bk)
    comp = []
    for k, ad in (("liquidity", "nakit ve kısa vadeli yatırımlar"), ("equity_investments", "hisse yatırımları"), ("ar", "alacaklar"), ("inventory", "stoklar"),
                  ("ppe", "maddi duran varlıklar"), ("goodwill", "şerefiye"), ("intangibles", "maddi olmayan varlıklar"),
                  ("lt_investments", "uzun vadeli yatırımlar")):
        if r.get(k) and r.get("total_assets"):
            comp.append((r[k] / r["total_assets"] * 100, ad, k))
    if comp:
        comp.sort(reverse=True)
        s = "Varlıkların dağılımı: " + ", ".join(f"{ad} {pc(v, 0)}" for v, ad, _ in comp[:5]) + "."
        ck = ["total_assets"] + [k for _, _, k in comp[:5]]
        top = comp[0][1]
        if top == "nakit ve kısa vadeli yatırımlar":
            s += " Bilançonun en büyük kalemi nakit: kriz dönemlerinde esneklik ve fırsat alımı imkânı verir."
        elif top == "alacaklar":
            s += " En büyük kalem alacaklar: satışların önemli bir kısmı henüz tahsil edilmemiş; tahsilat hızı (DSO) bu yüzden kritik."
        elif top == "stoklar":
            s += " En büyük kalem stoklar: talep yavaşlarsa stok değer düşüklüğü riski doğar."
        elif top == "maddi duran varlıklar":
            s += " En büyük kalem maddi duran varlıklar: sermaye yoğun bir iş modeli; amortisman gelecekteki kârları baskılar."
        elif top == "hisse yatırımları":
            s += " En büyük kalem hisse yatırımları: bu varlıkların değeri piyasaya bağlı ve kârı oynatabilir."
        if r.get("goodwill_to_assets") is not None and r["goodwill_to_assets"] >= 15:
            s += " Şerefiye ağırlığı yüksek: geçmiş satın almalar için ödenen prim büyük ve değer düşüklüğü riski taşıyor."
            ck.append("goodwill_to_assets")
        ps.add(s, *ck)
    liq, debt = r.get("liquidity"), r.get("total_debt")
    if liq is not None:
        s = f"Nakit ve kısa vadeli yatırımlar {usd(liq)}, finansal borç {usd(debt) if debt else 'yok veya raporlanmamış'}"
        if r.get("net_cash") is not None:
            s += f"; net {'nakit' if r['net_cash'] >= 0 else 'borç'} pozisyonu {usd(abs(r['net_cash']))}."
            durum = "olumlu" if r["net_cash"] >= 0 else "notr"
        ps.add(s, "net_cash")
    if r.get("current_ratio") is not None:
        cr = r["current_ratio"]
        ps.add(f"Cari oran {_n(cr, 2)} (dönen varlıklar / kısa vadeli yükümlülükler). "
                  + ("1,5'in üzerinde: kısa vadeli yükümlülükleri rahat karşılıyor." if cr >= 1.5 else
                     "1 ile 1,5 arası: yeterli ama bol değil." if cr >= 1 else
                     "1'in altında: kısa vadeli yükümlülükler dönen varlıklardan fazla; nakit akışına bağımlılık yüksek."), "current_ratio")
        if cr < 1:
            durum = _worst(durum, "dikkat")
    if r.get("equity_ratio") is not None:
        ps.add(f"Varlıkların {pc(r['equity_ratio'], 0)} özkaynakla finanse ediliyor"
               + (f"; borç/özkaynak {_n(r['debt_to_equity'], 2)}." if r.get("debt_to_equity") is not None else "."),
               "equity_ratio", *(["debt_to_equity"] if r.get("debt_to_equity") is not None else []))
    if r.get("goodwill_to_assets") is not None and r["goodwill_to_assets"] >= 15:
        ps.add(f"Şerefiye toplam varlıkların {pc(r['goodwill_to_assets'], 0)}; satın almaların beklenen getiriyi sağlamaması halinde değer düşüklüğü riski taşır.",
               "goodwill_to_assets")
        durum = _worst(durum, "dikkat")
    if r.get("lease_liab"):
        ps.add(f"Kira yükümlülükleri (operasyonel kiralama) {usd(r['lease_liab'])}; finansal borca benzer sabit bir yükümlülüktür.", "lease_liab")
    if r.get("cash_runway_months") is not None and r["cash_runway_months"] < 18:
        durum = "kirmizi" if r["cash_runway_months"] < 12 else _worst(durum, "dikkat")
    manset = (f"Net nakit {usd(r['net_cash'])}; cari oran {_n(r['current_ratio'], 2) if r.get('current_ratio') is not None else 'veri yok'}."
              if r.get("net_cash") is not None else "Bilanço özeti.")
    tiles = [_tile("Nakit + kısa vadeli yatırım", usd(liq), None, "net_nakit", kaynak=["liquidity"]),
             _tile("Finansal borç", usd(debt) if debt else "yok/raporlanmamış", None, "net_nakit", kaynak=["total_debt"]),
             _tile("Cari oran", _n(r["current_ratio"], 2) if r.get("current_ratio") is not None else "veri yok", None, "cari_oran",
                   kaynak=["current_ratio"]),
             _tile("Özkaynak oranı", pc(r.get("equity_ratio"), 0), None, "ozkaynak_orani", kaynak=["equity_ratio"])]
    return _sec("bilanco", "Bilanço sağlamlığı", durum, manset, ps, tiles,
                ["net_nakit", "cari_oran", "ozkaynak_orani", "serefiye", "borc_ozkaynak"], ["liquidity", "total_debt"])


def isletme_sermayesi(T, rows):
    r = rows[-1]
    py = next((x for x in rows if x["donem_sonu"] == r.get("onceki_yil_donem")), None) or {}
    ps = _Ps()
    durum = "notr"
    if r.get("dso") is not None:
        ps.add(f"Alacak tahsil süresi (DSO) {gun(r['dso'])}; bir yıl önce {gun(py.get('dso'))}. "
               "Müşteriler faturayı ortalama bu kadar günde ödüyor. Sürenin uzaması tahsilat zorluğu veya agresif satış koşullarına işaret edebilir.",
               "dso", "dso@y")
        if (r.get("dso_yoy_change") or 0) > 10:
            durum = "dikkat"
    if r.get("dio") is not None:
        ps.add(f"Stok devir süresi (DIO) {gun(r['dio'])}; bir yıl önce {gun(py.get('dio'))}. "
               "Stoğun satılana kadar depoda ortalama kaç gün kaldığını gösterir. Donanım şirketlerinde hızlı artış, talep yavaşlaması veya ürün geçişi riskidir.",
               "dio", "dio@y")
    if r.get("dpo") is not None:
        ps.add(f"Ticari borç ödeme süresi (DPO) {gun(r['dpo'])}; tedarikçilere ortalama bu kadar günde ödeme yapılıyor.", "dpo")
    if r.get("ccc") is not None:
        ps.add(f"Nakit dönüşüm döngüsü (DSO + DIO − DPO) {gun(r['ccc'])}; bir yıl önce {gun(py.get('ccc'))}. "
               "Şirketin bir doları üretime koyup müşteriden tahsil etmesi bu kadar sürüyor; kısalması nakit verimliliğinin arttığını gösterir.",
               "ccc", "ccc@y")
    g1, g2 = r.get("receivables_vs_revenue_gap"), r.get("inventory_vs_revenue_gap")
    if g1 is not None:
        ps.add(f"Alacaklar yıllık {spc(r.get('ar_yoy'))}, gelir {spc(r.get('revenue_yoy'))} büyüdü (fark {pts(g1)}).", "receivables_vs_revenue_gap")
        if g1 > 15:
            durum = _worst(durum, "dikkat" if g1 <= 30 else "kirmizi")
    if g2 is not None:
        ps.add(f"Stoklar yıllık {spc(r.get('inventory_yoy'))}, gelir {spc(r.get('revenue_yoy'))} büyüdü (fark {pts(g2)}).", "inventory_vs_revenue_gap")
        if g2 > 20:
            durum = _worst(durum, "dikkat" if g2 <= 50 else "kirmizi")
    manset = (f"Nakit dönüşüm döngüsü {gun(r.get('ccc'))}; DSO {gun(r.get('dso'))}." if r.get("dso") is not None else "İşletme sermayesi verisi sınırlı.")
    tiles = [_tile("DSO", gun(r.get("dso")), f"{'+' if (r.get('dso_yoy_change') or 0) > 0 else ''}{_n(r['dso_yoy_change'], 0) + ' gün yıllık' if r.get('dso_yoy_change') is not None else ''}", "dso",
                   kaynak=["dso", "dso_yoy_change"]),
             _tile("DIO", gun(r.get("dio")), None, "dio", kaynak=["dio"]), _tile("DPO", gun(r.get("dpo")), None, "dpo", kaynak=["dpo"]),
             _tile("Nakit dönüşüm döngüsü", gun(r.get("ccc")), None, "ccc", kaynak=["ccc"])]
    return _sec("isletme_sermayesi", "İşletme sermayesi", durum, manset, ps, tiles, ["dso", "dio", "dpo", "ccc"], ["dso", "dio"])


def hissedar(T, rows):
    r = rows[-1]
    ps = _Ps()
    durum = "notr"
    d = r.get("diluted_shares_yoy")
    if d is not None:
        ps.add(f"Seyreltilmiş hisse sayısı bir yılda {spc(d)} değişti. "
                  + ("Hisse sayısı azalıyor: geri alımlar, çalışanlara verilen hisselerin yarattığı sulandırmayı aşıyor. Her hisse şirketin daha büyük bir parçasını temsil ediyor." if d < -0.5 else
                     "Hisse sayısı yatay." if d <= 1 else
                     "Hisse sayısı artıyor (sulandırma): mevcut hissedarın şirketteki payı küçülüyor. Kaynağı SBC, hisse ihracı (ATM) veya dönüştürülebilir tahviller olabilir."), "diluted_shares_yoy")
        durum = "olumlu" if d < -0.5 else "notr" if d <= 3 else "dikkat" if d <= 10 else "kirmizi"
    if r.get("sbc_ttm") and r.get("buybacks_ttm"):
        ratio = r["buybacks_ttm"] / r["sbc_ttm"]
        ps.add(f"Son 12 ayda geri alım {usd(r['buybacks_ttm'])}, SBC {usd(r['sbc_ttm'])}: geri alım SBC'nin {_n(ratio, 1)} katı. "
               + ("Geri alım bütçesinin önemli kısmı yalnızca SBC'nin etkisini nötrlemeye gidiyor." if ratio < 1.5 else "Geri alım SBC'yi rahatça aşıyor."),
               "buybacks_ttm", "sbc_ttm")
    if r.get("roe_ttm") is not None:
        ps.add(f"Özkaynak kârlılığı (ROE, TTM) {pc(r['roe_ttm'])}. "
               + ("Çok yüksek ROE; yoğun geri alımların özkaynağı küçültmesi oranı şişirebilir, ROIC ile birlikte oku." if r["roe_ttm"] > 60 else ""),
               "roe_ttm")
    if r.get("roic_ttm") is not None:
        ps.add(f"Yatırılan sermaye getirisi (ROIC, yaklaşık) {pc(r['roic_ttm'])}. Hesap: faaliyet kârı × (1 − %21 varsayımsal vergi) / (özkaynak + borç − nakit). "
               "Sermaye maliyetinin (genelde %8-10) belirgin üzerinde olması değer yaratıldığını gösterir.", "roic_ttm")
    manset = f"Hisse sayısı yıllık {spc(d)}; ROE {pc(r.get('roe_ttm'))}." if d is not None else "Hissedar göstergeleri."
    tiles = [_tile("Hisse sayısı (yıllık)", spc(d), None, "sulandirma", kaynak=["diluted_shares_yoy"]),
             _tile("ROE (TTM)", pc(r.get("roe_ttm")), None, "roe", kaynak=["roe_ttm"]),
             _tile("ROIC (yaklaşık)", pc(r.get("roic_ttm")), None, "roic", kaynak=["roic_ttm"]),
             _tile("SBC (TTM)", usd(r.get("sbc_ttm")), None, "sbc", kaynak=["sbc_ttm"])]
    return _sec("hissedar", "Hissedar açısından", durum, manset, ps, tiles, ["sulandirma", "geri_alim", "roe", "roic", "sbc"],
                ["diluted_shares"])


def build(T: str, name: str, table: dict, quality: dict) -> dict:
    rows = (table or {}).get("ceyrekler") or []
    if not rows:
        return {"hata": "veri yok"}
    bridge = (quality or {}).get("kopru_ceyrek")
    secs = [buyume(T, rows), karlilik(T, rows), kazanc_kalitesi(T, rows, quality), nakit_akisi(T, rows),
            bilanco_saglamligi(T, rows), isletme_sermayesi(T, rows), hissedar(T, rows)]
    src = lambda keys: _kaynak(rows, keys, bridge)  # noqa: E731
    for s in secs:
        raw = s["paragraflar"]
        s["paragraflar"] = [t for t, _ in raw]
        s["paragraf_kaynak"] = [src(k) for _, k in raw]
        for t in s["rakamlar"]:
            t["kaynak"] = src(t.pop("_k")) if t.get("_k") else None
    hk = hikaye(T, name, rows, bridge)
    return {"donem": rows[-1].get("etiket"), "donem_sonu": rows[-1]["donem_sonu"],
            "hikaye": [t for t, _ in hk], "hikaye_kaynak": [src(k) for _, k in hk], "bolumler": secs,
            "rehber_kaynak": {k: v for k, v in ((k, src(t)) for k, t in REHBER_K.items()) if v["satirlar"]},
            "not": "Bu yorumlar SEC XBRL verisinden kural tabanlı olarak üretilir (Claude değil). Rakamlar tablodan gelir; "
                   "yorum cümleleri genel finansal analiz ilkelerini uygular. Şirkete özel bağlam için Claude dipnot analizine bak."}
