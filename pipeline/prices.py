"""Fiyat verisi: Yahoo Finance chart API (anahtarsız) -> yedek Stooq -> Finnhub quote.

Kapanış fiyatları data/prices/{SYM}.json içinde birikir (sinyal karnesi için).
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import os

from common import DATA, RateLimitedSession, log, now_iso, read_json, rnd, write_json

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"}
yahoo = RateLimitedSession(0.5, headers=UA, name="Yahoo")
stooq = RateLimitedSession(0.5, headers=UA, name="Stooq")
nasdaq = RateLimitedSession(0.6, headers={**UA, "Accept": "application/json, text/plain, */*",
                                          "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"},
                            name="Nasdaq")
ETF = {"QQQ", "SMH", "XLC", "IGV", "SPY", "SOXX", "XLK", "VGT", "IWM", "DIA", "VOO", "ARKK"}


def _yahoo(sym: str) -> list[tuple[str, float]] | None:
    for host in ("query1", "query2"):
        r = yahoo.get(f"https://{host}.finance.yahoo.com/v8/finance/chart/{sym}",
                      params={"range": "2y", "interval": "1d", "includePrePost": "false"}, retries=2)
        if r is None:
            continue
        try:
            res = r.json()["chart"]["result"][0]
            ts = res["timestamp"]
            closes = res["indicators"]["quote"][0]["close"]
            tz_off = res.get("meta", {}).get("gmtoffset", 0)
        except (KeyError, IndexError, TypeError, ValueError):
            continue
        out = []
        for t, c in zip(ts, closes):
            if c is None:
                continue
            d = dt.datetime.fromtimestamp(t + tz_off, dt.timezone.utc).date().isoformat()
            out.append((d, round(float(c), 4)))
        if out:
            return out
    return None


def _nasdaq(sym: str) -> list[tuple[str, float]] | None:
    to = dt.date.today()
    fr = to - dt.timedelta(days=740)
    classes = ["etf", "stocks"] if sym in ETF else ["stocks", "etf"]
    for ac in classes:
        r = nasdaq.get(f"https://api.nasdaq.com/api/quote/{sym}/historical",
                       params={"assetclass": ac, "fromdate": fr.isoformat(), "todate": to.isoformat(), "limit": 9999},
                       retries=2, timeout=30)
        if r is None:
            continue
        try:
            rows = ((r.json().get("data") or {}).get("tradesTable") or {}).get("rows") or []
        except ValueError:
            continue
        out = []
        for row in rows:
            try:
                m, d, y = row["date"].split("/")
                out.append((f"{y}-{m}-{d}", round(float(str(row["close"]).replace("$", "").replace(",", "")), 4)))
            except (KeyError, ValueError):
                continue
        if out:
            return sorted(out)
    return None


def _stooq(sym: str) -> list[tuple[str, float]] | None:
    r = stooq.get("https://stooq.com/q/d/l/", params={"s": f"{sym.lower()}.us", "i": "d"}, retries=2)
    if r is None or not r.text.startswith("Date"):
        return None
    out = []
    cutoff = (dt.date.today() - dt.timedelta(days=740)).isoformat()
    for row in csv.DictReader(io.StringIO(r.text)):
        if row.get("Date", "") >= cutoff and row.get("Close"):
            out.append((row["Date"], round(float(row["Close"]), 4)))
    return out or None


def update(sym: str, finnhub=None) -> dict:
    path = DATA / "prices" / f"{sym}.json"
    old = read_json(path, {}) or {}
    hist = {d: c for d, c in old.get("kapanislar", [])}
    src = None
    # Nasdaq birincil (GitHub runner'larından Yahoo sık sık 429 veriyor), Yahoo yedek
    fresh = _nasdaq(sym)
    if fresh:
        src = "Nasdaq.com (historical API)"
    else:
        fresh = _yahoo(sym)
        if fresh:
            src = "Yahoo Finance (chart API)"
        else:
            fresh = _stooq(sym)
            if fresh:
                src = "Stooq"
    if fresh:
        # taze seri (bölünme düzeltmeli) çakışan tarihlerin üzerine yazar
        for d, c in fresh:
            hist[d] = c
    quote = None
    if finnhub is not None and finnhub.available:
        quote = finnhub.quote(sym)
        if quote and quote.get("c"):
            d = dt.datetime.fromtimestamp(quote["t"], dt.timezone.utc).date().isoformat() if quote.get("t") else None
            if d and (not fresh or d > max(hist)):
                hist[d] = float(quote["c"])
                src = (src + " + " if src else "") + "Finnhub quote"
    if not hist:
        log.warning("%s için fiyat alınamadı", sym)
        return old or {"sembol": sym, "hata": "fiyat verisi yok"}
    kap = sorted(hist.items())
    obj = {"sembol": sym, "kaynak": src or old.get("kaynak"), "guncelleme": now_iso() if src else old.get("guncelleme"),
           "taze": bool(src), "kapanislar": kap}
    if finnhub is not None and finnhub.available:
        m = finnhub.metric(sym)
        if m:
            obj["finnhub_52h_zirve"] = m.get("52WeekHigh")
            obj["finnhub_52h_zirve_tarih"] = m.get("52WeekHighDate")
    write_json(path, obj)
    return obj


def stats(p: dict) -> dict:
    kap = p.get("kapanislar") or []
    if not kap:
        return {"veri_yok": True}
    last_d, last = kap[-1]
    D = dt.date.fromisoformat
    ld = D(last_d)

    def back(days):
        target = (ld - dt.timedelta(days=days)).isoformat()
        cand = [c for d, c in kap if d <= target]
        return cand[-1] if cand else None

    year = [(d, c) for d, c in kap if d > (ld - dt.timedelta(days=365)).isoformat()]
    hi_d, hi = max(year, key=lambda x: x[1]) if year else (None, None)
    lo_d, lo = min(year, key=lambda x: x[1]) if year else (None, None)

    note = "52 haftalık zirve kapanış fiyatları üzerinden hesaplandı (gün içi zirve değil)."
    covered = (ld - D(kap[0][0])).days
    fh_hi = p.get("finnhub_52h_zirve")
    if covered < 300 and fh_hi:
        hi, hi_d = float(fh_hi), p.get("finnhub_52h_zirve_tarih")
        note = f"Fiyat geçmişi {covered} gün; 52 haftalık zirve Finnhub'dan (gün içi) alındı."

    def ch(x):
        return rnd((last / x - 1) * 100) if x else None

    ytd_base = [c for d, c in kap if d < f"{ld.year}-01-01"]
    return {
        "fiyat": last, "tarih": last_d,
        "degisim_1g": ch(kap[-2][1]) if len(kap) > 1 else None,
        "degisim_1h": ch(back(7)), "degisim_1a": ch(back(30)), "degisim_3a": ch(back(91)),
        "degisim_6a": ch(back(182)), "degisim_1y": ch(back(365)),
        "degisim_ytd": ch(ytd_base[-1]) if ytd_base else None,
        "zirve_52h": hi, "zirve_52h_tarih": hi_d, "dip_52h": lo, "dip_52h_tarih": lo_d,
        "zirveden_uzaklik": rnd((last / hi - 1) * 100) if hi else None,
        "zirve_notu": note,
        "kaynak": p.get("kaynak"), "guncelleme": p.get("guncelleme"), "taze": p.get("taze", False),
        "finnhub_52h_zirve_gun_ici": p.get("finnhub_52h_zirve"),
    }


def close_on_or_after(p: dict, date: str) -> tuple[str, float] | None:
    for d, c in p.get("kapanislar", []):
        if d >= date:
            return d, c
    return None


def close_on_or_before(p: dict, date: str) -> tuple[str, float] | None:
    best = None
    for d, c in p.get("kapanislar", []):
        if d <= date:
            best = (d, c)
        else:
            break
    return best


def spark(p: dict, days: int = 365) -> list:
    kap = p.get("kapanislar") or []
    if not kap:
        return []
    cutoff = (dt.date.fromisoformat(kap[-1][0]) - dt.timedelta(days=days)).isoformat()
    return [[d, c] for d, c in kap if d >= cutoff]
