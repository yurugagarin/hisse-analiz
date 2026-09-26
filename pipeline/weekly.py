"""Haftalık özet.

- rolling(): her gün Python ile son 7 günün derlemesi -> data/weekly/latest.json (Claude yok)
- context(): Salı raporu için hisse başına veri paketi (claude_tasks.py kullanır)
"""
from __future__ import annotations

import datetime as dt

from common import DATA, now_iso, read_json, read_jsonl, today, write_json


def _window(days=7):
    end = today()
    return (end - dt.timedelta(days=days - 1)).isoformat(), end.isoformat()


def stock_snapshot(T: str, s: dict, summary: dict, days: int = 7) -> dict:
    ws, we = _window(days)
    h = summary.get("hisseler", {}).get(T, {})
    ins = read_json(DATA / "insider" / f"{T}.json", {}) or {}
    tx = [r for r in ins.get("son_islemler", []) if ws <= r["tarih"] <= we and not r["turev"]]
    codes = {}
    for r in tx:
        codes[r["kod"]] = codes.get(r["kod"], 0) + 1
    mv = read_json(DATA / "moves" / f"{T}.json", {}) or {}
    fil = read_json(DATA / "filings" / f"{T}.json", {}) or {}
    heads = (read_json(DATA / "headlines" / f"{T}.json", {}) or {}).get("basliklar", [])
    fiyat = h.get("fiyat") or {}
    return {
        "ticker": T, "ad": s.get("name"), "donem": [ws, we],
        "fiyat": {"son": fiyat.get("fiyat"), "tarih": fiyat.get("tarih"), "haftalik": fiyat.get("degisim_1h"),
                  "aylik": fiyat.get("degisim_1a"), "zirveden": fiyat.get("zirveden_uzaklik"),
                  "zirve_52h": fiyat.get("zirve_52h"), "zirve_tarih": fiyat.get("zirve_52h_tarih"), "kaynak": fiyat.get("kaynak")},
        "benchmark_haftalik": {b: (summary.get("benchmarklar", {}).get(b) or {}).get("degisim_1h") for b in s.get("benchmarks", [])},
        "tez": h.get("tez"), "kural": h.get("kural"),
        "insider": {"hafta_islemleri": [{k: r.get(k) for k in ("tarih", "kisi", "unvan", "kod", "adet", "fiyat", "tutar",
                                                              "plan_10b5_1", "sonrasi", "sahiplik", "url")} for r in tx],
                    "hafta_kodlari": codes, "uyarilar": ins.get("uyarilar", []),
                    "kumelenmis_satislar": ins.get("kumelenmis_satislar", []),
                    "ozet_90g": (ins.get("pencereler") or {}).get("90", {}).get("kodlar")},
        "buyuk_hareketler": [m for m in mv.get("hareketler", []) if ws <= m["tarih"] <= we],
        "sec_bildirimleri": [f for f in fil.get("bildirimler", []) if ws <= f["tarih"] <= we and f["form"] not in ("4", "4/A")],
        "basliklar": [{k: x.get(k) for k in ("tarih", "kaynak", "baslik", "url")} for x in heads if ws <= x["tarih"] <= we],
        "bilanco": h.get("bilanco"),
    }


def rolling(stocks: list[dict], summary: dict) -> dict:
    """Son 7 günün derlemesi — haber başlığı YOK; fiyat, tez, kural, insider, büyük hareket, SEC bildirimleri."""
    from anlati import pc, spc, usd
    ws, we = _window(7)
    sigs = [x for x in read_jsonl(DATA / "signals.jsonl") if ws <= x["tarih"] <= we]
    per = []
    for s in stocks:
        T = s["ticker"]
        snap = stock_snapshot(T, s, summary)
        snap.pop("basliklar", None)
        snap["sinyaller"] = [x for x in sigs if x["ticker"] == T]
        h = summary.get("hisseler", {}).get(T, {})
        ins = snap["insider"]
        tx = ins["hafta_islemleri"]
        sat = sum((r.get("tutar") or 0) for r in tx if r["kod"] == "S")
        al = sum((r.get("tutar") or 0) for r in tx if r["kod"] == "P")
        cumle = []
        f = snap["fiyat"]
        bh = {b: v for b, v in snap["benchmark_haftalik"].items() if v is not None}
        if f.get("haftalik") is not None:
            c = f"Hisse bu hafta {spc(f['haftalik'])}"
            if bh:
                c += " (" + ", ".join(f"{b} {spc(v)}" for b, v in bh.items()) + ")"
            c += f"; 52 haftalık zirveden {pc(f.get('zirveden'))} uzakta."
            cumle.append(c)
        tz = h.get("tez") or {}
        changes = [x for x in snap["sinyaller"] if x["tur"] in ("tez_bozulma", "tez_iyilesme", "sutun_kirmizi", "cikis_kriteri")]
        if changes:
            cumle.append("Tezde değişiklik: " + "; ".join(f"{x['tur_adi']} ({x['aciklama']})" for x in changes) + ".")
        else:
            cumle.append("Tez sütunlarında bu hafta değişiklik yok.")
        k = h.get("kural") or {}
        if (k.get("durum") or "").startswith("tetiklendi"):
            cumle.append(k.get("mesaj", ""))
        if tx:
            cumle.append(f"Insider: {len(tx)} Form 4 işlemi" + (f", satış {usd(sat)}" if sat else "") + (f", açık piyasa alımı {usd(al)}" if al else "") + ".")
        for m in snap["buyuk_hareketler"]:
            cumle.append(f"{m['tarih']} günü {spc(m['hareket'])} büyük hareket ({m.get('on_siniflama_aciklama', '')})")
        for fl in snap["sec_bildirimleri"]:
            if fl["form"] in ("10-Q", "10-K"):
                cumle.append(f"Yeni {fl['form']} dosyalandı ({fl['tarih']}); bilanço analizi güncellendi.")
        snap["cumleler"] = cumle
        snap["insider_ozet"] = {"islem": len(tx), "satis_tutar": sat, "alim_tutar": al, "kodlar": ins["hafta_kodlari"]}
        snap["sonraki_bilanco"] = h.get("sonraki_bilanco")
        per.append(snap)
    out = {"tur": "son7gun", "baslangic": ws, "bitis": we, "guncelleme": now_iso(), "hisseler": per, "sinyaller": sigs,
           "not": "Günlük Python derlemesi (Claude yok). Derin analiz Salı raporundadır."}
    write_json(DATA / "weekly" / "latest.json", out)
    return out
