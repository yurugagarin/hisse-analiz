"""Hareket açıklayıcı (Python): günlük ±%X üzeri hareketleri kaydeder.

Her hareket için: tarih, hareket, aynı gün benchmark'lar (sektör ETF'leri + QQQ),
o gün ve önceki işlem gününün haber başlıkları, o günlerde dosyalanan SEC
bildirimleri (8-K, Form 4 …) ve deterministik ön sınıflama. Claude açıklaması
Salı raporunda eklenir.
"""
from __future__ import annotations

import datetime as dt

from common import DATA, log, now_iso, read_json, rnd, today, write_json

SEC_FORMS = ("8-K", "8-K/A", "4", "4/A", "10-Q", "10-K", "SC 13D", "SC 13G", "SC 13D/A", "SC 13G/A", "144", "S-3", "424B5", "DEF 14A")


def _returns(p: dict) -> dict[str, tuple[str, float]]:
    kap = p.get("kapanislar") or []
    out = {}
    for i in range(1, len(kap)):
        d, c = kap[i]
        pd, pc = kap[i - 1]
        if pc:
            out[d] = (pd, (c / pc - 1) * 100)
    return out


def classify(r: float, sector: list[float], q: float | None) -> tuple[str, str]:
    sec = sum(sector) / len(sector) if sector else None
    ref = sec if sec is not None else q
    if ref is None:
        return "belirsiz", "Benchmark verisi yok."
    excess = r - ref
    if abs(excess) >= 0.6 * abs(r):
        return "sirkete_ozel", f"Hisse {r:+.1f}%, sektör/piyasa {ref:+.1f}%: hareketin çoğu şirkete özel görünüyor."
    if q is not None and abs(q) >= 0.5 * abs(r) and (q * r) > 0:
        return "piyasa", f"QQQ {q:+.1f}% ile aynı yönde: piyasa geneli etkisi belirgin."
    if sec is not None and (sec * r) > 0 and abs(sec) >= 0.4 * abs(r):
        return "sektor", f"Sektör ETF ortalaması {sec:+.1f}%: sektör hareketi belirgin."
    return "karma", f"Hisse {r:+.1f}%, sektör {ref:+.1f}%: karma."


def update(ticker: str, benchmarks: list[str], threshold: float, recent_filings: list[dict],
           headlines: list[dict], finnhub=None, lookback_days: int = 30) -> dict:
    path = DATA / "moves" / f"{ticker}.json"
    old = read_json(path, {}) or {}
    events = {e["tarih"]: e for e in old.get("hareketler", [])}
    P = lambda s: read_json(DATA / "prices" / f"{s}.json", {}) or {}  # noqa: E731
    rets = _returns(P(ticker))
    brets = {b: _returns(P(b)) for b in sorted(set(benchmarks) | {"QQQ"})}
    cutoff = (today() - dt.timedelta(days=lookback_days)).isoformat()
    for d, (pd, r) in rets.items():
        if d < cutoff or abs(r) < threshold:
            continue
        e = events.get(d, {"tarih": d, "claude": None})
        bench = {b: rnd(brets[b][d][1]) if d in brets[b] else None for b in brets}
        sector = [v for b, v in bench.items() if b != "QQQ" and v is not None]
        sinif, acik = classify(r, sector, bench.get("QQQ"))
        hs = [h for h in headlines if pd <= h["tarih"] <= d]
        if not hs and finnhub is not None and finnhub.available and not e.get("basliklar"):
            import news
            hs = [h for h in news.finnhub_items(finnhub.news_range(ticker, pd, d)) if pd <= h["tarih"] <= d]
        fil = [{"form": f["form"], "tarih": f["filingDate"], "items": f.get("items") or "",
                "url": f.get("_url"), "aciklama": f.get("primaryDocDescription") or ""}
               for f in recent_filings if pd <= f.get("filingDate", "") <= d and f.get("form") in SEC_FORMS]
        e.update({"onceki_gun": pd, "hareket": rnd(r), "yon": "yukari" if r > 0 else "asagi",
                  "benchmark": bench, "on_siniflama": sinif, "on_siniflama_aciklama": acik,
                  "basliklar": hs[:40] if hs else e.get("basliklar", []), "sec_bildirimleri": fil or e.get("sec_bildirimleri", [])})
        events[d] = e
    arr = sorted(events.values(), key=lambda e: e["tarih"], reverse=True)
    arr = [e for e in arr if e["tarih"] >= (today() - dt.timedelta(days=365)).isoformat()]
    obj = {"ticker": ticker, "esik_yuzde": threshold, "guncelleme": now_iso(), "hareketler": arr,
           "not": "Ön sınıflama Python ile benchmark karşılaştırmasından yapılır; nedensellik iddiası değildir. "
                  "Claude açıklaması Salı raporunda eklenir."}
    write_json(path, obj)
    log.info("%s: %d büyük hareket kaydı (eşik ±%%%s)", ticker, len(arr), threshold)
    return obj
