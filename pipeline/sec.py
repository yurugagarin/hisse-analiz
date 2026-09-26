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


def nice_name(title: str) -> str:
    """SEC unvanını okunur hale getirir: 'ORACLE CORP' -> 'Oracle', 'IonQ, Inc.' -> 'IonQ'."""
    keep = {"AI", "US", "USA", "AG", "SA", "NV", "SE", "PLC", "LP", "ASML", "AMD", "IBM", "AT&T", "3M"}
    drop = {"INC", "INC.", "CORP", "CORP.", "CORPORATION", "CO", "CO.", "LTD", "LTD.", "HOLDINGS", "/DE/", "/DE",
            "CLASS", "A", "/MD/", "/NV/", "/NEW/", "NEW", "L.P.", "LLC", "PLC.", "N.V.", "S.A."}
    words = [w for w in title.replace(",", "").split() if w.upper() not in drop]

    def fix(w):
        if w.upper() in keep or not w.isupper() or not any(c.isalpha() for c in w):
            return w  # karışık yazımı (IonQ, eBay) ve kısaltmaları olduğu gibi bırak
        if len(w) <= 3 and not w.isalpha():
            return w
        return w.capitalize()
    return " ".join(fix(w) for w in words) or title


def ticker_list() -> dict | None:
    """Sitedeki arama kutusu için ABD borsalarındaki (Nasdaq/NYSE/CBOE) tüm SEC şirketleri."""
    r = sess.get("https://www.sec.gov/files/company_tickers_exchange.json")
    if r is None:
        return None
    js = r.json()
    f = js.get("fields", [])
    i_c, i_n, i_t, i_e = f.index("cik"), f.index("name"), f.index("ticker"), f.index("exchange")
    seen, rows = set(), []
    for row in js.get("data", []):
        t, e = (row[i_t] or "").upper(), row[i_e]
        if not t or e not in ("Nasdaq", "NYSE", "CBOE") or t in seen:
            continue
        seen.add(t)
        rows.append([t, nice_name(row[i_n] or t), e, int(row[i_c])])
    return {"alanlar": ["ticker", "ad", "borsa", "cik"], "liste": rows,
            "kaynak": "https://www.sec.gov/files/company_tickers_exchange.json"}


# SIC sektör kodu -> sektör ETF'i (hisse eklerken otomatik karşılaştırma seçimi)
SIC_ETF = [
    ((3674, 3674), "SMH"), ((3670, 3679), "SMH"), ((3570, 3579), "XLK"), ((3660, 3669), "XLK"),
    ((7370, 7379), "IGV"), ((4800, 4899), "XLC"), ((7810, 7819), "XLC"), ((2710, 2741), "XLC"),
    ((4922, 4925), "XLE"), ((1300, 1399), "XLE"), ((2910, 2919), "XLE"), ((4900, 4999), "XLU"),
    ((6798, 6798), "XLRE"), ((6500, 6599), "XLRE"), ((6000, 6799), "XLF"),
    ((2830, 2836), "XLV"), ((3840, 3851), "XLV"), ((8000, 8099), "XLV"), ((8731, 8731), "XLV"),
    ((3720, 3729), "XLI"), ((3760, 3769), "XLI"), ((3500, 3569), "XLI"), ((4000, 4799), "XLI"),
    ((3710, 3716), "XLY"), ((5000, 5999), "XLY"), ((7000, 7099), "XLY"), ((5800, 5899), "XLY"),
    ((2000, 2199), "XLP"), ((5400, 5499), "XLP"), ((2840, 2844), "XLP"),
    ((1000, 1499), "XLB"), ((2800, 2899), "XLB"), ((3300, 3399), "XLB"),
]
TECH_ETF = {"SMH", "XLK", "IGV", "XLC"}


def benchmarks_for_sic(sic) -> list[str]:
    try:
        sic = int(sic)
    except (TypeError, ValueError):
        return ["SPY", "QQQ"]
    for (lo, hi), etf in SIC_ETF:
        if lo <= sic <= hi:
            return ["QQQ" if etf in TECH_ETF else "SPY", etf]
    return ["SPY", "QQQ"]


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
