"""Tez sütunlarının ve çıkış kriterlerinin değerlendirilmesi."""
from __future__ import annotations

from common import now_iso

METRIK_ADI = {
    "revenue_yoy": ("Gelir büyümesi (yıllık)", "%"), "revenue_ttm_yoy": ("TTM gelir büyümesi", "%"),
    "gross_margin": ("Brüt marj", "%"), "gross_margin_ttm": ("TTM brüt marj", "%"),
    "operating_margin": ("Faaliyet marjı", "%"), "operating_margin_ttm": ("TTM faaliyet marjı", "%"),
    "ocf_to_ni_ttm": ("İşletme nakit akışı / net kâr (TTM)", "x"),
    "fcf_margin_ttm": ("TTM FCF marjı", "%"), "sbc_to_revenue_ttm": ("TTM SBC / gelir", "%"),
    "diluted_shares_yoy": ("Seyreltilmiş hisse sayısı (yıllık)", "%"), "dso": ("DSO", "gün"),
    "receivables_vs_revenue_gap": ("Alacak − gelir büyümesi", "puan"), "inventory_yoy": ("Stok (yıllık)", "%"),
    "inventory_vs_revenue_gap": ("Stok − gelir büyümesi", "puan"), "dio": ("DIO", "gün"),
    "deferred_revenue_yoy": ("Ertelenmiş gelir (yıllık)", "%"), "rpo_yoy": ("RPO (yıllık)", "%"),
    "capex_to_revenue_ttm": ("TTM capex / gelir", "%"), "cash_runway_months": ("Nakit pisti", "ay"),
}


def _status(val, op, esik, uyari):
    if val is None:
        return "veri_yok"
    if op == ">":
        if val >= esik:
            return "yesil"
        return "sari" if uyari is not None and val >= uyari else "kirmizi"
    if val <= esik:
        return "yesil"
    return "sari" if uyari is not None and val <= uyari else "kirmizi"


def _cond(val, op, esik):
    if val is None:
        return None
    return val < esik if op == "<" else val > esik


def evaluate(ticker: str, th: dict | None, table: dict, analysis: dict | None, weekly: dict | None) -> dict:
    """analysis: son bilanço analizi (Claude); weekly: son Salı raporu (Claude) — yorum sütunları için
    ikisinden daha yeni olanı kullanılır. Haber/radar bağlantıları Salı raporundan gelir."""
    if not th:
        return {"ticker": ticker, "tez_var": False, "genel": "veri_yok", "sutunlar": [], "cikis": [],
                "guncelleme": now_iso()}
    rows = table.get("ceyrekler", []) if table else []
    last = rows[-1] if rows else {}
    yorumlar = {}
    a_date = (analysis or {}).get("guncelleme") or ""
    for y in ((analysis or {}).get("analiz") or {}).get("yorum_sutunlari", []):
        yorumlar[y["id"]] = {**y, "_kaynak": {"tip": "bilanco", "tarih": a_date, **((analysis or {}).get("dosya") or {})}}
    w_date = (weekly or {}).get("rapor_tarihi") or ""
    if w_date and w_date >= a_date[:10]:
        for y in ((weekly or {}).get("tez") or {}).get("yorum_sutunlari", []):
            if y.get("durum") and y["durum"] != "veri_yok":
                yorumlar[y["id"]] = {**y, "kanit_alinti": None, "_kaynak": {"tip": "sali_raporu", "tarih": w_date,
                                                                            "url": y.get("kaynak_url")}}
    gel = (weekly or {}).get("gelismeler", [])
    sig = (weekly or {}).get("radar", [])
    out_p = []
    for p in th.get("sutunlar", []):
        base = {"id": p["id"], "ad": p["ad"], "tip": p.get("tip", "metrik"), "aciklama": p.get("aciklama", "")}
        if p.get("tip") == "yorum":
            y = yorumlar.get(p["id"])
            base.update({"durum": y["durum"] if y else "veri_yok", "soru": p.get("soru", "").strip(),
                         "gerekce": y.get("gerekce") if y else "Henüz değerlendirilmedi (Claude bilanço analizi / Salı raporu çalışmadı).",
                         "kanit_alinti": y.get("kanit_alinti") if y else None,
                         "kanit_dogrulandi": y.get("kanit_alinti_dogrulandi") if y else None,
                         "kaynak": y.get("_kaynak") if y else None, "olgu_mu": False})
        else:
            m = p["metrik"]
            val, lbl, stale = None, None, False
            for i, r in enumerate(reversed(rows[-3:])):
                if r.get(m) is not None:
                    val, lbl, stale = r[m], r.get("etiket"), i > 0
                    break
            ad, birim = METRIK_ADI.get(m, (m, ""))
            hist = [{"etiket": r.get("etiket"), "deger": r.get(m),
                     "durum": _status(r.get(m), p["operator"], p["esik"], p.get("uyari"))} for r in rows[-8:]]
            base.update({"metrik": m, "metrik_adi": ad, "birim": birim, "deger": val, "donem": lbl,
                         "eski_donem": stale, "operator": p["operator"], "esik": p["esik"], "uyari": p.get("uyari"),
                         "durum": _status(val, p["operator"], p["esik"], p.get("uyari")), "gecmis": hist,
                         "kaynak": {"tip": "SEC XBRL companyfacts", "donem": lbl}, "olgu_mu": True})
        base["haberler"] = [g for g in gel if g.get("sutun_id") == p["id"]]
        base["radar"] = [s for s in sig if s.get("sutun_id") == p["id"]]
        out_p.append(base)

    exits = []
    for c in th.get("cikis_kriterleri", []):
        n = int(c.get("ardisik_ceyrek", 1))
        m = c.get("metrik")
        last_n = rows[-n:] if len(rows) >= n else []
        vals = [r.get(m) for r in last_n]
        conds = [_cond(v, c["operator"], c["esik"]) for v in vals]
        if not last_n or any(x is None for x in conds):
            st = "veri_yok"
        else:
            st = "tetiklendi" if all(conds) else "tetiklenmedi"
        exits.append({"id": c["id"], "ad": c["ad"], "metrik": m, "durum": st,
                      "son_degerler": [{"etiket": r.get("etiket"), "deger": r.get(m)} for r in last_n]})

    sts = [p["durum"] for p in out_p]
    known = [s for s in sts if s != "veri_yok"]
    if any(e["durum"] == "tetiklendi" for e in exits) or "kirmizi" in sts:
        genel = "kirmizi"
    elif "sari" in sts:
        genel = "sari"
    elif known:
        genel = "yesil"
    else:
        genel = "veri_yok"
    return {"ticker": ticker, "tez_var": True, "onay": th.get("onay", "taslak"), "ozet": th.get("ozet", ""),
            "genel": genel, "sutunlar": out_p, "cikis": exits, "son_ceyrek": last.get("etiket"),
            "guncelleme": now_iso(),
            "not": "Tez durumu fiyattan bağımsızdır. Fiyat düşüşü tek başına tezin bozulduğu anlamına gelmez."}
