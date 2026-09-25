"""Haber başlıkları (Claude'suz, ücretsiz): Finnhub company-news + Google News RSS.

Başlıklar data/headlines/{T}.json arşivinde birikir (45 gün). Salı raporu ve
hareket açıklayıcı bu arşivi kullanır. Paneldeki "en önemli 3 gelişme" günlük
olarak deterministik seçilir (Salı günü Claude'un seçimiyle değiştirilir).
"""
from __future__ import annotations

import datetime as dt
import email.utils
import re
import xml.etree.ElementTree as ET

from common import DATA, RateLimitedSession, log, now_iso, read_json, today, write_json

gnews = RateLimitedSession(1.0, headers={"User-Agent": "Mozilla/5.0 (compatible; hisse-tez-takibi/1.0)"}, name="GoogleNews")

GUVENILIR = ("reuters", "bloomberg", "cnbc", "wall street journal", "wsj", "financial times", "barron",
             "marketwatch", "business wire", "businesswire", "pr newswire", "globenewswire", "the information",
             "associated press", "ap news", "nikkei", "techcrunch", "the verge", "yahoo finance", "seeking alpha",
             "investor's business daily", "fortune", "axios", "digitimes")


def _norm(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (t or "").lower()).strip()


def google_news(ticker: str, name: str, days: int = 7) -> list[dict]:
    q = f'"{name}" OR {ticker} stock when:{days}d'
    r = gnews.get("https://news.google.com/rss/search", params={"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"},
                  retries=2, timeout=30)
    if r is None:
        return []
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        return []
    out = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        src = it.find("source")
        src_name = (src.text if src is not None else "") or ""
        if src_name and title.endswith(" - " + src_name):
            title = title[: -len(src_name) - 3]
        try:
            d = email.utils.parsedate_to_datetime(it.findtext("pubDate") or "").astimezone(dt.timezone.utc)
        except (TypeError, ValueError):
            continue
        out.append({"zaman": d.replace(microsecond=0).isoformat(), "tarih": d.date().isoformat(), "baslik": title,
                    "ozet": "", "url": (it.findtext("link") or "").strip(), "kaynak": src_name,
                    "saglayici": "Google News RSS"})
    return out


def finnhub_items(rows: list) -> list[dict]:
    out = []
    for n in rows or []:
        ts = n.get("datetime") or 0
        if not ts or not n.get("headline"):
            continue
        d = dt.datetime.fromtimestamp(ts, dt.timezone.utc)
        out.append({"zaman": d.isoformat(), "tarih": d.date().isoformat(), "baslik": n["headline"].strip(),
                    "ozet": (n.get("summary") or "")[:500], "url": n.get("url"), "kaynak": n.get("source") or "",
                    "saglayici": "Finnhub"})
    return out


def update_archive(ticker: str, items: list[dict], keep_days: int = 45) -> list[dict]:
    path = DATA / "headlines" / f"{ticker}.json"
    old = (read_json(path, {}) or {}).get("basliklar", [])
    seen = {}
    for x in old + items:
        k = _norm(x["baslik"])[:120]
        if not k:
            continue
        if k not in seen or (x["saglayici"] == "Finnhub" and seen[k]["saglayici"] != "Finnhub"):
            seen[k] = x
    cutoff = (today() - dt.timedelta(days=keep_days)).isoformat()
    arr = sorted([x for x in seen.values() if x["tarih"] >= cutoff], key=lambda x: x["zaman"], reverse=True)
    write_json(path, {"ticker": ticker, "guncelleme": now_iso(), "basliklar": arr})
    log.info("%s başlık arşivi: %d yeni aday, %d toplam", ticker, len(items), len(arr))
    return arr


def top_developments(ticker: str, name: str, arr: list[dict], n: int = 3, days: int = 7) -> dict:
    cutoff = (today() - dt.timedelta(days=days)).isoformat()
    first = _norm(name).split(" ")[0] if name else ticker.lower()

    def score(x):
        t = _norm(x["baslik"])
        s = 0
        if ticker.lower() in t.split() or first in t:
            s += 2
        if any(g in (x.get("kaynak") or "").lower() for g in GUVENILIR):
            s += 2
        if x["saglayici"] == "Finnhub":
            s += 1
        if re.search(r"\b(stock|shares) (is|are)? ?(up|down|rising|falling|soar|jump|slide)", t):
            s -= 1  # salt fiyat haberleri
        return (s, x["zaman"])

    recent = [x for x in arr if x["tarih"] >= cutoff]
    picked = sorted(recent, key=score, reverse=True)[:n]
    return {"ticker": ticker, "guncelleme": now_iso(), "yontem":
            "Otomatik seçim (Claude yok): son 7 gün, şirket adı geçen + güvenilir kaynak öncelikli. Salı raporunda Claude seçimi gösterilir.",
            "gelismeler": [{"tarih": x["tarih"], "baslik": x["baslik"], "olgu": x.get("ozet") or None, "yorum": None,
                            "sutun_id": None, "etki": None, "kaynak_url": x["url"], "kaynak_adi": x["kaynak"]} for x in picked],
            "son7_sayisi": len(recent)}
