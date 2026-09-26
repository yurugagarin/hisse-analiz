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


def _sec(id_, baslik, durum, manset, paragraflar, rakamlar, rehber, grafik=None):
    return {"id": id_, "baslik": baslik, "durum": durum, "manset": manset,
            "paragraflar": [p for p in paragraflar if p], "rakamlar": [r for r in rakamlar if r],
            "rehber": rehber, "grafik": grafik or []}


def _tile(etiket, deger, alt=None, rehber=None, ton=None):
    return {"etiket": etiket, "deger": deger, "alt": alt, "rehber": rehber, "ton": ton}


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
    out = []
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
        out.append(s)
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
        out.append(s)
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
        out.append(s)
    if r.get("ocf") is not None:
        s = f"Çeyrekte işletme faaliyetlerinden {usd(r['ocf'])} nakit elde edildi"
        if r.get("net_income") and r["net_income"] > 0:
            s += f", net kârın {_n(r['ocf'] / r['net_income'], 2)} katı"
        s += "."
        wc = _wc_story(rows)
        if wc:
            s += " " + wc
        if r.get("fcf_ttm") is not None:
            s += f" Son 12 ayda serbest nakit akışı {usd(r['fcf_ttm'])} (gelirin {pc(r.get('fcf_margin_ttm'))})."
        out.append(s)
    bs = []
    if r.get("liquidity") is not None:
        bs.append(f"Çeyrek sonunda nakit ve kısa vadeli yatırımlar {usd(r['liquidity'])}")
        if r.get("total_debt"):
            bs[-1] += f", finansal borç {usd(r['total_debt'])}, net nakit {usd(r.get('net_cash'))}"
        bs[-1] += "."
    if r.get("diluted_shares_yoy") is not None:
        bs.append(f"Seyreltilmiş hisse sayısı yıllık {spc(r['diluted_shares_yoy'])} değişti"
                  + (f"; son 12 ayda {usd(r.get('buybacks_ttm'))} geri alım yapıldı" if r.get("buybacks_ttm") else "")
                  + (f", hisse bazlı ödeme (SBC) {usd(r.get('sbc_ttm'))}" if r.get("sbc_ttm") else "") + ".")
    if bs:
        out.append(" ".join(bs))
    return out


def _wc_story(rows):
    """Çeyrek içi işletme sermayesi değişimi: nakdi ne bağladı/ne serbest bıraktı."""
    if len(rows) < 2:
        return None
    r, p = rows[-1], rows[-2]
    parts = []
    for k, ad, sign in (("ar", "alacaklar", -1), ("inventory", "stoklar", -1), ("ap", "ticari borçlar", 1),
                        ("deferred_revenue", "ertelenmiş gelir", 1)):
        a, b = r.get(k), p.get(k)
        if a is None or b is None:
            continue
        d = a - b
        if r.get("revenue") and abs(d) >= 0.02 * r["revenue"]:
            etki = "nakit bağladı" if d * sign < 0 else "nakit serbest bıraktı"
            parts.append(f"{ad} {usd(abs(d))} {'arttı' if d > 0 else 'azaldı'} ve {etki}")
    if not parts:
        return None
    return "İşletme sermayesinde: " + "; ".join(parts) + "."


def buyume(T, rows):
    r = rows[-1]
    yoys = [(_lbl(x), x.get("revenue_yoy")) for x in rows[-5:] if x.get("revenue_yoy") is not None]
    tr = _trend([x[1] for x in yoys], 1.5)
    ry = r.get("revenue_yoy")
    durum = "notr" if ry is None else ("olumlu" if ry >= 15 else "dikkat" if ry < 5 else "notr")
    manset = (f"Gelir yıllık {spc(ry)} büyüdü; büyüme {TREND_TR.get(tr, 'belirsiz')}." if ry is not None
              else "Yıllık büyüme hesaplanamadı (veri yok).")
    ps = []
    if yoys:
        ps.append("Son çeyreklerde yıllık büyüme: " + " → ".join(f"{l} {pc(v)}" for l, v in yoys) + ".")
    if r.get("revenue_ttm") is not None:
        ps.append(f"Son 12 ay (TTM) gelir {usd(r['revenue_ttm'])}; bir yıl önceki TTM'ye göre {spc(r.get('revenue_ttm_yoy'))}. "
                  "Tek çeyrekteki dalgalanmayı TTM rakamı yumuşatır; eğilimi o gösterir.")
    if r.get("rpo") is not None and r.get("revenue_ttm") and r["rpo"] >= 0.25 * r["revenue_ttm"]:
        ps.append(f"Kalan edim yükümlülüğü (RPO, imzalanmış ama henüz gelire dönüşmemiş sözleşmeler) {usd(r['rpo'])}, "
                  f"yıllık {spc(r.get('rpo_yoy'))}. RPO gelirden hızlı büyüyorsa gelecek dönem gelirleri için görünürlük artıyor demektir.")
        if r.get("rpo_yoy") is not None and ry is not None:
            ps[-1] += (" Şu an RPO gelirden hızlı büyüyor." if r["rpo_yoy"] > ry else " Şu an RPO gelirden yavaş büyüyor; bu izlenmeli.")
            if r["rpo_yoy"] < ry - 5:
                durum = _worst(durum, "dikkat")
    if r.get("deferred_revenue") is not None:
        ps.append(f"Ertelenmiş gelir (müşteriden peşin alınan, henüz hizmeti verilmemiş tutar) {usd(r['deferred_revenue'])}, "
                  f"yıllık {spc(r.get('deferred_revenue_yoy'))}.")
    if r.get("acquisitions_ttm") and r.get("revenue_ttm") and r["acquisitions_ttm"] / r["revenue_ttm"] > 0.03:
        ps.append(f"Son 12 ayda satın almalara {usd(r['acquisitions_ttm'])} ödendi. Büyümenin bir kısmı satın alınan şirketlerden "
                  "gelebilir; organik büyümeyi ayırmak için işletme birleşmeleri dipnotuna bakmak gerekir.")
        durum = _worst(durum, "dikkat")
    tiles = [_tile("Çeyrek gelir", usd(r.get("revenue")), _lbl(r), "gelir"),
             _tile("Yıllık büyüme", spc(ry), f"önceki çeyrek {pc(rows[-2].get('revenue_yoy')) if len(rows) > 1 else '—'}", "yoy"),
             _tile("Çeyrekten çeyreğe", spc(r.get("revenue_qoq")), None, "qoq"),
             _tile("TTM gelir", usd(r.get("revenue_ttm")), spc(r.get("revenue_ttm_yoy")), "ttm")]
    if r.get("rpo") is not None and r.get("revenue_ttm") and r["rpo"] >= 0.25 * r["revenue_ttm"]:
        tiles.append(_tile("RPO", usd(r["rpo"]), spc(r.get("rpo_yoy")) + " yıllık", "rpo"))
    return _sec("buyume", "Büyüme", durum, manset, ps, tiles, ["gelir", "yoy", "qoq", "ttm", "rpo", "ertelenmis_gelir"],
                ["revenue", "revenue_yoy"])


def karlilik(T, rows):
    r = rows[-1]
    gm = [(_lbl(x), x.get("gross_margin")) for x in rows[-5:] if x.get("gross_margin") is not None]
    om = [(_lbl(x), x.get("operating_margin")) for x in rows[-5:] if x.get("operating_margin") is not None]
    ps = []
    durum = "notr"
    if gm:
        ps.append("Brüt marj (her 100 $ gelirden üretim maliyeti düşüldükten sonra kalan): "
                  + " → ".join(f"{l} {pc(v)}" for l, v in gm) + ".")
        d = r.get("gross_margin_yoy_pp")
        if d is not None:
            if d <= -3:
                ps[-1] += f" Yıllık {pts(d)} gerileme fiyatlama gücünde zayıflama, ürün karması değişimi veya maliyet artışına işaret edebilir."
                durum = "dikkat"
            elif d >= 3:
                ps[-1] += f" Yıllık {pts(d)} iyileşme fiyatlama gücü veya ölçek etkisine işaret ediyor."
                durum = "olumlu"
    if om:
        ps.append("Faaliyet marjı (Ar-Ge, satış ve genel giderler de düşüldükten sonra): "
                  + " → ".join(f"{l} {pc(v)}" for l, v in om) + ".")
    opex = []
    if r.get("rd_to_revenue") is not None:
        opex.append(f"Ar-Ge gideri gelirin {pc(r['rd_to_revenue'])}")
    if r.get("sga_to_revenue") is not None:
        opex.append(f"satış/genel yönetim giderleri gelirin {pc(r['sga_to_revenue'])}")
    if opex:
        ps.append(("; ".join(opex)).capitalize() + ". Bu oranların zamanla düşmesi, şirketin büyürken giderlerini daha verimli kullandığını gösterir.")
    oy, ry = r.get("operating_income_yoy"), r.get("revenue_yoy")
    if oy is not None and ry is not None and (r.get("operating_income") or 0) > 0:
        lev = oy - ry
        ps.append(f"Operasyonel kaldıraç: faaliyet kârı yıllık {spc(oy)}, gelir {spc(ry)}. "
                  + ("Kâr gelirden hızlı büyüyor; ölçek ekonomisi çalışıyor." if lev > 3 else
                     "Kâr gelirden yavaş büyüyor; giderler (çoğu zaman yatırım/Ar-Ge veya satın alma maliyetleri) marjı sıkıştırıyor." if lev < -3
                     else "Kâr ve gelir benzer hızda büyüyor."))
        if lev < -10:
            durum = _worst(durum, "dikkat")
    if (r.get("operating_income") or 0) < 0:
        durum = "kirmizi" if (r.get("operating_margin_ttm") or 0) < -10 else _worst(durum, "dikkat")
        ps.append(f"Şirket faaliyet düzeyinde zararda: son 12 ayda faaliyet marjı {pc(r.get('operating_margin_ttm'))}.")
    if r.get("eps_diluted") is not None:
        s = f"Seyreltilmiş hisse başına kâr (EPS) {_n(r['eps_diluted'], 2)} $"
        if r.get("eps_yoy") is not None and r.get("net_income_yoy") is not None:
            s += f", yıllık {spc(r['eps_yoy'])} (net kâr {spc(r['net_income_yoy'])})."
            if r["eps_yoy"] > r["net_income_yoy"] + 2:
                s += " EPS net kârdan hızlı büyüyor: hisse geri alımları hisse başına kârı destekliyor."
            elif r["eps_yoy"] < r["net_income_yoy"] - 2:
                s += " EPS net kârdan yavaş büyüyor: hisse sayısı arttığı için (sulandırma) kârın hissedara düşen payı azalıyor."
        else:
            s += "."
        ps.append(s)
    manset = (f"Brüt marj {pc(r.get('gross_margin'))}, faaliyet marjı {pc(r.get('operating_margin'))}, net marj {pc(r.get('net_margin'))}.")
    tiles = [_tile("Brüt marj", pc(r.get("gross_margin")), pts(r.get("gross_margin_yoy_pp")) + " yıllık", "brut_marj"),
             _tile("Faaliyet marjı", pc(r.get("operating_margin")), pts(r.get("operating_margin_yoy_pp")) + " yıllık", "faaliyet_marji"),
             _tile("Net marj", pc(r.get("net_margin")), None, "net_marj"),
             _tile("EPS (seyreltilmiş)", f"{_n(r['eps_diluted'], 2)} $" if r.get("eps_diluted") is not None else "veri yok",
                   spc(r.get("eps_yoy")) + " yıllık" if r.get("eps_yoy") is not None else None, "eps")]
    return _sec("karlilik", "Kârlılık", durum, manset, ps, tiles,
                ["brut_marj", "faaliyet_marji", "net_marj", "operasyonel_kaldirac", "eps"],
                ["gross_margin", "operating_margin", "net_margin"])


def kazanc_kalitesi(T, rows, q):
    r = rows[-1]
    ps = []
    durum = "notr"
    on = r.get("ocf_to_ni_ttm")
    if on is not None:
        ps.append(f"Son 12 ayda işletme nakit akışı net kârın {_n(on, 2)} katı. "
                  + ("1'in üzerinde olması, muhasebe kârının nakitle desteklendiğini gösterir (amortisman ve SBC gibi nakit dışı giderler de bunu yükseltir)."
                     if on >= 1 else
                     "1'in altında olması, kârın bir kısmının henüz nakde dönmediğini gösterir: genelde alacak veya stok artışı, bazen de nakit dışı kazançlar (ör. yatırım değerlemeleri) nedeniyle."))
        durum = "olumlu" if on >= 1 else ("dikkat" if on >= 0.7 else "kirmizi")
    elif (r.get("net_income_ttm") or 0) <= 0 and r.get("net_income_ttm") is not None:
        ps.append(f"Son 12 ayda net zarar var ({usd(r['net_income_ttm'])}); nakit/kâr oranı anlamlı değil. "
                  f"İşletme nakit akışı {usd(r.get('ocf_ttm'))}.")
        durum = "kirmizi" if (r.get("ocf_ttm") or 0) < 0 else "dikkat"
    ac = r.get("accruals_ratio")
    if ac is not None:
        ps.append(f"Tahakkuk oranı {pc(ac)} (net kâr − işletme nakit akışı, ortalama varlıklara bölünmüş). "
                  + ("Negatif veya sıfıra yakın olması iyidir: kâr büyük ölçüde nakit." if ac <= 2 else
                     "Pozitif ve yüksek olması, kârın tahakkuklara (henüz tahsil edilmemiş gelirler, değerlemeler) dayandığını gösterir; akademik çalışmalarda yüksek tahakkuk sonraki dönem zayıf getiriyle ilişkilendirilir."))
        if ac > 5:
            durum = _worst(durum, "dikkat")
    b = (q or {}).get("kopru_ceyrek") or {}
    nonop = b.get("faaliyet_disi_toplam")
    if nonop is not None and r.get("pretax"):
        share = abs(nonop) / abs(r["pretax"]) * 100
        if r["pretax"] < 0:
            ps.append(f"Bu çeyrek faaliyet dışı kalemlerin toplamı {usd(nonop)}; şirket vergi öncesi zararda "
                      f"({usd(r['pretax'])}), yani zarar esas faaliyetten kaynaklanıyor.")
        else:
            ps.append(f"Bu çeyrek faaliyet dışı kalemlerin toplamı {usd(nonop)}; vergi öncesi kârın {pc(share, 0)}. "
                      + ("Oran düşük: kâr esas faaliyetten geliyor." if share < 10 else
                         "Oran yüksek: kârın önemli bir kısmı faiz, yatırım kazancı veya değerleme gibi tekrarlanması belirsiz kalemlerden geliyor. Aşağıdaki köprü tablosu kalemleri tek tek gösteriyor."))
        if share >= 20 and r["pretax"] > 0:
            durum = _worst(durum, "dikkat")
    if r.get("sbc_to_revenue_ttm") is not None:
        s = f"Hisse bazlı ödeme (SBC) gelirin {pc(r['sbc_to_revenue_ttm'])}."
        if r.get("sbc_adj_fcf_ttm") is not None:
            s += (f" SBC gerçek bir maliyettir: serbest nakit akışından SBC düşülünce son 12 ayda {usd(r['sbc_adj_fcf_ttm'])} kalıyor "
                  f"(gelirin {pc(r.get('sbc_adj_fcf_margin_ttm'))}).")
        ps.append(s)
        if r["sbc_to_revenue_ttm"] > 15:
            durum = _worst(durum, "dikkat")
    if r.get("pretax") and r["pretax"] > 0 and r.get("tax") is not None:
        etr = r["tax"] / r["pretax"] * 100
        ps.append(f"Çeyreğin efektif vergi oranı {pc(etr)}. "
                  + ("Olağan aralıkta." if 10 <= etr <= 25 else
                     "Olağan dışı: tek seferlik vergi etkileri (ertelenmiş vergi ayarlamaları, vergi indirimleri) net kârı geçici olarak etkileyebilir."))
    flags = [f for f in (q or {}).get("bulgular", []) if f["etiket"] != "olumlu"]
    durum = _worst(durum, *("kirmizi" if f["etiket"] == "kirmizi_bayrak" else "dikkat" for f in flags))
    manset = ("Kâr nakitle destekleniyor." if durum == "olumlu" else
              "Kâr kalitesinde dikkat edilecek noktalar var." if durum == "dikkat" else
              "Kâr kalitesi zayıf ya da şirket zararda." if durum == "kirmizi" else "Kâr kalitesi göstergeleri karışık.")
    tiles = [_tile("İşletme nakdi / net kâr", kat(on), "TTM", "ocf_ni"),
             _tile("Tahakkuk oranı", pc(ac), "düşük iyi", "accruals"),
             _tile("SBC / gelir", pc(r.get("sbc_to_revenue_ttm")), "TTM", "sbc"),
             _tile("SBC sonrası FCF", usd(r.get("sbc_adj_fcf_ttm")), "TTM", "sbc_fcf")]
    return _sec("kazanc_kalitesi", "Kazanç kalitesi", durum, manset, ps, tiles,
                ["ocf_ni", "accruals", "faaliyet_disi", "sbc", "sbc_fcf", "efektif_vergi"], ["ocf", "net_income"])


def nakit_akisi(T, rows):
    r = rows[-1]
    ps = []
    durum = "notr"
    if r.get("ocf_ttm") is not None:
        ps.append(f"Son 12 ayda işletme faaliyetlerinden {usd(r['ocf_ttm'])} nakit girdi, yatırım harcaması (capex) {usd(r.get('capex_ttm'))} "
                  f"oldu; geriye {usd(r.get('fcf_ttm'))} serbest nakit akışı (FCF) kaldı. FCF marjı {pc(r.get('fcf_margin_ttm'))}.")
        fm = r.get("fcf_margin_ttm")
        durum = "olumlu" if fm is not None and fm >= 15 else "kirmizi" if fm is not None and fm < 0 else "notr"
    if r.get("capex_to_revenue_ttm") is not None:
        s = f"Capex gelirin {pc(r['capex_to_revenue_ttm'])}"
        if r.get("capex_to_revenue_ttm_yoy_pp") is not None:
            s += f" (bir yıl önceye göre {pts(r['capex_to_revenue_ttm_yoy_pp'])})"
        s += "."
        if r.get("capex_to_da_ttm") is not None:
            s += (f" Capex amortismanın {_n(r['capex_to_da_ttm'], 1)} katı: "
                  + ("şirket yıpranan varlıklarını yenilemenin çok ötesinde, büyüme için yatırım yapıyor." if r["capex_to_da_ttm"] > 1.5 else
                     "yatırım aşağı yukarı yıpranmayı karşılayacak düzeyde." if r["capex_to_da_ttm"] >= 0.8 else
                     "yatırım amortismanın altında; varlık tabanı küçülüyor olabilir."))
        ps.append(s)
    uses = []
    for k, ad in (("buybacks_ttm", "hisse geri alımı"), ("dividends_ttm", "temettü"), ("acquisitions_ttm", "satın almalar"),
                  ("debt_repaid_ttm", "borç geri ödemesi")):
        if r.get(k):
            uses.append(f"{ad} {usd(r[k])}")
    srcs = []
    for k, ad in (("equity_issued_ttm", "hisse ihracı / opsiyon"), ("debt_issued_ttm", "borçlanma")):
        if r.get(k):
            srcs.append(f"{ad} {usd(r[k])}")
    if uses or srcs:
        s = "Son 12 ayda nakdin kullanımı: " + (", ".join(uses) if uses else "kayda değer dağıtım yok") + "."
        if srcs:
            s += " Dışarıdan sağlanan kaynak: " + ", ".join(srcs) + "."
        if r.get("fcf_ttm") and r["fcf_ttm"] > 0 and r.get("shareholder_return_ttm"):
            s += f" Hissedara dönen tutar (geri alım + temettü) FCF'nin {pc(r['shareholder_return_ttm'] / r['fcf_ttm'] * 100, 0)}."
        ps.append(s)
    if r.get("fcf_ttm") is not None and r["fcf_ttm"] < 0:
        ps.append(f"Şirket nakit yakıyor. Nakit ve kısa vadeli yatırımlar {usd(r.get('liquidity'))}; bu hızla yaklaşık "
                  f"{_n(r['cash_runway_months'], 1) + ' ay' if r.get('cash_runway_months') is not None else 'hesaplanamayan bir süre'} yeter. "
                  "Pist kısaldıkça hisse ihracı (sulandırma) veya borçlanma olasılığı artar.")
        durum = "kirmizi" if (r.get("cash_runway_months") or 99) < 12 else "dikkat"
    manset = (f"Son 12 ayda {usd(r.get('fcf_ttm'))} serbest nakit akışı üretildi." if (r.get("fcf_ttm") or 0) >= 0
              else f"Son 12 ayda {usd(r.get('fcf_ttm'))} nakit yakıldı.") if r.get("fcf_ttm") is not None else "Serbest nakit akışı hesaplanamadı (veri yok)."
    tiles = [_tile("İşletme nakit akışı", usd(r.get("ocf_ttm")), "TTM", "ocf"),
             _tile("Capex", usd(r.get("capex_ttm")), pc(r.get("capex_to_revenue_ttm")) + " gelir", "capex"),
             _tile("Serbest nakit akışı", usd(r.get("fcf_ttm")), pc(r.get("fcf_margin_ttm")) + " marj", "fcf"),
             _tile("Geri alım + temettü", usd(r.get("shareholder_return_ttm")), "TTM", "geri_alim")]
    if r.get("cash_runway_months") is not None:
        tiles.append(_tile("Nakit pisti", f"{_n(r['cash_runway_months'], 1)} ay", None, "nakit_pisti", "kirmizi" if r["cash_runway_months"] < 12 else "dikkat"))
    return _sec("nakit_akisi", "Nakit akışı ve sermaye tahsisi", durum, manset, ps, tiles,
                ["ocf", "capex", "fcf", "capex_da", "geri_alim", "nakit_pisti"], ["ocf", "capex", "fcf"])


def bilanco_saglamligi(T, rows):
    r = rows[-1]
    py = next((x for x in rows if x["donem_sonu"] == r.get("onceki_yil_donem")), None)
    ps = []
    durum = "notr"
    if r.get("total_assets") is not None:
        s = f"Toplam varlıklar {usd(r['total_assets'])}"
        if r.get("total_liabilities") is not None:
            s += f", toplam yükümlülükler {usd(r['total_liabilities'])}"
        if r.get("equity") is not None:
            s += f", özkaynak {usd(r['equity'])}"
        s += "."
        if py and py.get("total_assets"):
            s += f" Varlıklar bir yılda {spc((r['total_assets'] / py['total_assets'] - 1) * 100)} büyüdü."
        ps.append(s)
    comp = []
    for k, ad in (("liquidity", "nakit ve kısa vadeli yatırımlar"), ("ar", "alacaklar"), ("inventory", "stoklar"),
                  ("ppe", "maddi duran varlıklar"), ("goodwill", "şerefiye"), ("intangibles", "maddi olmayan varlıklar"),
                  ("lt_investments", "uzun vadeli yatırımlar")):
        if r.get(k) and r.get("total_assets"):
            comp.append((r[k] / r["total_assets"] * 100, ad, r[k]))
    if comp:
        comp.sort(reverse=True)
        ps.append("Varlıkların dağılımı: " + ", ".join(f"{ad} {pc(v, 0)}" for v, ad, _ in comp[:5]) + ". "
                  "Nakit ağırlıklı bir bilanço esneklik sağlar; şerefiye ağırlığı yüksekse geçmiş satın almalar için ödenen primin büyüklüğünü ve değer düşüklüğü riskini gösterir.")
    liq, debt = r.get("liquidity"), r.get("total_debt")
    if liq is not None:
        s = f"Nakit ve kısa vadeli yatırımlar {usd(liq)}, finansal borç {usd(debt) if debt else 'yok veya raporlanmamış'}"
        if r.get("net_cash") is not None:
            s += f"; net {'nakit' if r['net_cash'] >= 0 else 'borç'} pozisyonu {usd(abs(r['net_cash']))}."
            durum = "olumlu" if r["net_cash"] >= 0 else "notr"
        ps.append(s)
    if r.get("current_ratio") is not None:
        cr = r["current_ratio"]
        ps.append(f"Cari oran {_n(cr, 2)} (dönen varlıklar / kısa vadeli yükümlülükler). "
                  + ("1,5'in üzerinde: kısa vadeli yükümlülükleri rahat karşılıyor." if cr >= 1.5 else
                     "1 ile 1,5 arası: yeterli ama bol değil." if cr >= 1 else
                     "1'in altında: kısa vadeli yükümlülükler dönen varlıklardan fazla; nakit akışına bağımlılık yüksek."))
        if cr < 1:
            durum = _worst(durum, "dikkat")
    if r.get("equity_ratio") is not None:
        ps.append(f"Varlıkların {pc(r['equity_ratio'], 0)} özkaynakla finanse ediliyor"
                  + (f"; borç/özkaynak {_n(r['debt_to_equity'], 2)}." if r.get("debt_to_equity") is not None else "."))
    if r.get("goodwill_to_assets") is not None and r["goodwill_to_assets"] >= 15:
        ps.append(f"Şerefiye toplam varlıkların {pc(r['goodwill_to_assets'], 0)}; satın almaların beklenen getiriyi sağlamaması halinde değer düşüklüğü riski taşır.")
        durum = _worst(durum, "dikkat")
    if r.get("lease_liab"):
        ps.append(f"Kira yükümlülükleri (operasyonel kiralama) {usd(r['lease_liab'])}; finansal borca benzer sabit bir yükümlülüktür.")
    if r.get("cash_runway_months") is not None and r["cash_runway_months"] < 18:
        durum = "kirmizi" if r["cash_runway_months"] < 12 else _worst(durum, "dikkat")
    manset = (f"Net nakit {usd(r['net_cash'])}; cari oran {_n(r['current_ratio'], 2) if r.get('current_ratio') is not None else 'veri yok'}."
              if r.get("net_cash") is not None else "Bilanço özeti.")
    tiles = [_tile("Nakit + kısa vadeli yatırım", usd(liq), None, "net_nakit"),
             _tile("Finansal borç", usd(debt) if debt else "yok/raporlanmamış", None, "net_nakit"),
             _tile("Cari oran", _n(r["current_ratio"], 2) if r.get("current_ratio") is not None else "veri yok", None, "cari_oran"),
             _tile("Özkaynak oranı", pc(r.get("equity_ratio"), 0), None, "ozkaynak_orani")]
    return _sec("bilanco", "Bilanço sağlamlığı", durum, manset, ps, tiles,
                ["net_nakit", "cari_oran", "ozkaynak_orani", "serefiye", "borc_ozkaynak"], ["liquidity", "total_debt"])


def isletme_sermayesi(T, rows):
    r = rows[-1]
    py = next((x for x in rows if x["donem_sonu"] == r.get("onceki_yil_donem")), None) or {}
    ps = []
    durum = "notr"
    if r.get("dso") is not None:
        ps.append(f"Alacak tahsil süresi (DSO) {gun(r['dso'])}; bir yıl önce {gun(py.get('dso'))}. "
                  "Müşteriler faturayı ortalama bu kadar günde ödüyor. Sürenin uzaması tahsilat zorluğu veya agresif satış koşullarına işaret edebilir.")
        if (r.get("dso_yoy_change") or 0) > 10:
            durum = "dikkat"
    if r.get("dio") is not None:
        ps.append(f"Stok devir süresi (DIO) {gun(r['dio'])}; bir yıl önce {gun(py.get('dio'))}. "
                  "Stoğun satılana kadar depoda ortalama kaç gün kaldığını gösterir. Donanım şirketlerinde hızlı artış, talep yavaşlaması veya ürün geçişi riskidir.")
    if r.get("dpo") is not None:
        ps.append(f"Ticari borç ödeme süresi (DPO) {gun(r['dpo'])}; tedarikçilere ortalama bu kadar günde ödeme yapılıyor.")
    if r.get("ccc") is not None:
        ps.append(f"Nakit dönüşüm döngüsü (DSO + DIO − DPO) {gun(r['ccc'])}; bir yıl önce {gun(py.get('ccc'))}. "
                  "Şirketin bir doları üretime koyup müşteriden tahsil etmesi bu kadar sürüyor; kısalması nakit verimliliğinin arttığını gösterir.")
    g1, g2 = r.get("receivables_vs_revenue_gap"), r.get("inventory_vs_revenue_gap")
    if g1 is not None:
        ps.append(f"Alacaklar yıllık {spc(r.get('ar_yoy'))}, gelir {spc(r.get('revenue_yoy'))} büyüdü (fark {pts(g1)}).")
        if g1 > 15:
            durum = _worst(durum, "dikkat" if g1 <= 30 else "kirmizi")
    if g2 is not None:
        ps.append(f"Stoklar yıllık {spc(r.get('inventory_yoy'))}, gelir {spc(r.get('revenue_yoy'))} büyüdü (fark {pts(g2)}).")
        if g2 > 20:
            durum = _worst(durum, "dikkat" if g2 <= 50 else "kirmizi")
    manset = (f"Nakit dönüşüm döngüsü {gun(r.get('ccc'))}; DSO {gun(r.get('dso'))}." if r.get("dso") is not None else "İşletme sermayesi verisi sınırlı.")
    tiles = [_tile("DSO", gun(r.get("dso")), f"{'+' if (r.get('dso_yoy_change') or 0) > 0 else ''}{_n(r['dso_yoy_change'], 0) + ' gün yıllık' if r.get('dso_yoy_change') is not None else ''}", "dso"),
             _tile("DIO", gun(r.get("dio")), None, "dio"), _tile("DPO", gun(r.get("dpo")), None, "dpo"),
             _tile("Nakit dönüşüm döngüsü", gun(r.get("ccc")), None, "ccc")]
    return _sec("isletme_sermayesi", "İşletme sermayesi", durum, manset, ps, tiles, ["dso", "dio", "dpo", "ccc"], ["dso", "dio"])


def hissedar(T, rows):
    r = rows[-1]
    ps = []
    durum = "notr"
    d = r.get("diluted_shares_yoy")
    if d is not None:
        ps.append(f"Seyreltilmiş hisse sayısı bir yılda {spc(d)} değişti. "
                  + ("Hisse sayısı azalıyor: geri alımlar, çalışanlara verilen hisselerin yarattığı sulandırmayı aşıyor. Her hisse şirketin daha büyük bir parçasını temsil ediyor." if d < -0.5 else
                     "Hisse sayısı yatay." if d <= 1 else
                     "Hisse sayısı artıyor (sulandırma): mevcut hissedarın şirketteki payı küçülüyor. Kaynağı SBC, hisse ihracı (ATM) veya dönüştürülebilir tahviller olabilir."))
        durum = "olumlu" if d < -0.5 else "notr" if d <= 3 else "dikkat" if d <= 10 else "kirmizi"
    if r.get("sbc_ttm") and r.get("buybacks_ttm"):
        ratio = r["buybacks_ttm"] / r["sbc_ttm"]
        ps.append(f"Son 12 ayda geri alım {usd(r['buybacks_ttm'])}, SBC {usd(r['sbc_ttm'])}: geri alım SBC'nin {_n(ratio, 1)} katı. "
                  + ("Geri alım bütçesinin önemli kısmı yalnızca SBC'nin etkisini nötrlemeye gidiyor." if ratio < 1.5 else "Geri alım SBC'yi rahatça aşıyor."))
    if r.get("roe_ttm") is not None:
        ps.append(f"Özkaynak kârlılığı (ROE, TTM) {pc(r['roe_ttm'])}. "
                  + ("Çok yüksek ROE; yoğun geri alımların özkaynağı küçültmesi oranı şişirebilir, ROIC ile birlikte oku." if r["roe_ttm"] > 60 else ""))
    if r.get("roic_ttm") is not None:
        ps.append(f"Yatırılan sermaye getirisi (ROIC, yaklaşık) {pc(r['roic_ttm'])}. Hesap: faaliyet kârı × (1 − %21 varsayımsal vergi) / (özkaynak + borç − nakit). "
                  "Sermaye maliyetinin (genelde %8-10) belirgin üzerinde olması değer yaratıldığını gösterir.")
    manset = f"Hisse sayısı yıllık {spc(d)}; ROE {pc(r.get('roe_ttm'))}." if d is not None else "Hissedar göstergeleri."
    tiles = [_tile("Hisse sayısı (yıllık)", spc(d), None, "sulandirma"),
             _tile("ROE (TTM)", pc(r.get("roe_ttm")), None, "roe"),
             _tile("ROIC (yaklaşık)", pc(r.get("roic_ttm")), None, "roic"),
             _tile("SBC (TTM)", usd(r.get("sbc_ttm")), None, "sbc")]
    return _sec("hissedar", "Hissedar açısından", durum, manset, ps, tiles, ["sulandirma", "geri_alim", "roe", "roic", "sbc"],
                ["diluted_shares"])


def build(T: str, name: str, table: dict, quality: dict) -> dict:
    rows = (table or {}).get("ceyrekler") or []
    if not rows:
        return {"hata": "veri yok"}
    bridge = (quality or {}).get("kopru_ceyrek")
    secs = [buyume(T, rows), karlilik(T, rows), kazanc_kalitesi(T, rows, quality), nakit_akisi(T, rows),
            bilanco_saglamligi(T, rows), isletme_sermayesi(T, rows), hissedar(T, rows)]
    return {"donem": rows[-1].get("etiket"), "donem_sonu": rows[-1]["donem_sonu"],
            "hikaye": hikaye(T, name, rows, bridge), "bolumler": secs,
            "not": "Bu yorumlar SEC XBRL verisinden kural tabanlı olarak üretilir (Claude değil). Rakamlar tablodan gelir; "
                   "yorum cümleleri genel finansal analiz ilkelerini uygular. Şirkete özel bağlam için Claude dipnot analizine bak."}
