"""SEC EDGAR istemcisi: ticker->CIK, submissions, companyfacts, dosya metinleri.

SEC kuralları: tanımlı User-Agent zorunlu, saniyede en fazla 10 istek.
Biz güvenli tarafta kalıp ~5 istek/sn kullanıyoruz.
"""
from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from common import CACHE, DATA, RateLimitedSession, log, read_json, write_json

_UA = os.environ.get("SEC_USER_AGENT", "").strip()
sess = RateLimitedSession(0.2, headers={"User-Agent": _UA or "unset", "Accept-Encoding": "gzip, deflate"}, name="SEC")
if not _UA:
    # SEC, gerçek iletişim bilgisi içermeyen User-Agent'ları 403 ile reddediyor (test edildi).
    # Secret yoksa SEC'e hiç istek atma.
    log.warning("SEC_USER_AGENT tanımlı değil: SEC EDGAR adımları (XBRL, 10-Q/10-K, Form 4) atlanacak. "
                "'Ad Soyad email@adres' formatında secret ekleyin.")
    sess.disabled = True


def archive_url(cik: int, accn: str, doc: str = "") -> str:
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn.replace('-', '')}/{doc}"


def filing_index_url(cik: int, accn: str) -> str:
    return archive_url(cik, accn, f"{accn}-index.htm")


def cik_map() -> dict[str, int]:
    path = DATA / "cache" / "cik_map.json"
    m = read_json(path, {})
    if m:
        return m
    r = sess.get("https://www.sec.gov/files/company_tickers.json")
    if r is None:
        return {}
    m = {v["ticker"].upper(): int(v["cik_str"]) for v in r.json().values()}
    write_json(path, m)
    return m


def cik_for(ticker: str) -> int | None:
    m = cik_map()
    c = m.get(ticker.upper())
    if c is None:  # liste eski olabilir: yenile
        (DATA / "cache" / "cik_map.json").unlink(missing_ok=True)
        c = cik_map().get(ticker.upper())
    return c


def submissions(cik: int) -> dict | None:
    r = sess.get(f"https://data.sec.gov/submissions/CIK{cik:010d}.json")
    return r.json() if r is not None else None


def recent_filings(sub: dict) -> list[dict]:
    """submissions JSON'daki 'recent' tablosunu satır listesine çevirir."""
    rec = (sub or {}).get("filings", {}).get("recent", {})
    keys = list(rec.keys())
    n = len(rec.get("accessionNumber", []))
    return [{k: rec[k][i] for k in keys} for i in range(n)]


def companyfacts(cik: int) -> dict | None:
    r = sess.get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json")
    return r.json() if r is not None else None


def filing_files(cik: int, accn: str) -> list[dict]:
    r = sess.get(archive_url(cik, accn, "index.json"))
    if r is None:
        return []
    try:
        return r.json().get("directory", {}).get("item", [])
    except ValueError:
        return []


def fetch_text(url: str, cache_dir: str = "docs") -> str | None:
    """Belgeyi indirir, .cache altında saklar (Actions cache ile kalıcı)."""
    h = hashlib.sha1(url.encode()).hexdigest()[:16]
    p: Path = CACHE / cache_dir / h
    if p.exists():
        return p.read_text(encoding="utf-8", errors="replace")
    r = sess.get(url, timeout=120)
    if r is None:
        return None
    p.parent.mkdir(parents=True, exist_ok=True)
    txt = r.text
    p.write_text(txt, encoding="utf-8")
    return txt


def html_to_text(html: str) -> str:
    """Inline XBRL/HTML belgeyi okunabilir düz metne çevirir (tablolar satır satır)."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    for t in soup(["script", "style", "head"]):
        t.decompose()
    # ix:header gizli XBRL bloklarını at
    for t in soup.find_all(lambda tag: tag.name and tag.name.lower() in ("ix:header",)):
        t.decompose()
    for tr in soup.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        cells = [c for c in cells if c and c not in ("$", ")", "%")]
        tr.replace_with(soup.new_string("\n| " + " | ".join(cells) + " |\n" if cells else "\n"))
    for br in soup.find_all(["br", "p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"]):
        br.insert_after(soup.new_string("\n"))
    text = soup.get_text()
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()
