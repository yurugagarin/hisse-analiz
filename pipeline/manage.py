"""Hisse ekle / çıkar (GitHub Actions'taki "Hisse ekle / çıkar" butonu bunu çalıştırır).

  python pipeline/manage.py ekle AMD [--ad "Advanced Micro Devices"] [--benchmarks QQQ,SMH]
  python pipeline/manage.py cikar AMD
  python pipeline/manage.py --issue      (GitHub issue'dan: başlık "hisse ekle CEG" / "hisse cikar CEG")

Siteden ekleme/çıkarma bu betiği GitHub Actions üzerinden çalıştırır; sonuç mesajı
iş akışında not (annotation) olarak yazılır ve site bunu okuyup gösterir.

Ekleme:
  1. Kodu SEC ticker listesinde doğrular (SEC_USER_AGENT varsa); şirket adını oradan alır.
  2. config/stocks.yaml'a tek satır ekler (yorumlar korunur).
  3. config/theses.yaml'da bu hisse için tez yoksa, şirketin SON RAKAMLARINA göre
     "mevcut kaliteyi koru" mantığında bir TASLAK tez yazar (onay: taslak).
Çıkarma: stocks.yaml'dan satırı siler; tez ve geçmiş veri silinmez (geri eklenirse kullanılır).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CONFIG, load_yaml, setup_logging  # noqa: E402

TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")


class Hata(Exception):
    pass


def sec_lookup(ticker: str):
    """(ticker, cik, SEC'teki şirket adı) veya (ticker, None, None). BRK.B gibi yazımları BRK-B'ye çevirir."""
    try:
        import sec
        if sec.sess.disabled:
            return ticker, None, None
        r = sec.sess.get("https://www.sec.gov/files/company_tickers.json")
        if r is None:
            return ticker, None, None
        m = {v["ticker"].upper(): v for v in r.json().values()}
        for t in (ticker, ticker.replace(".", "-"), ticker.replace("-", ".")):
            if t in m:
                return t, int(m[t]["cik_str"]), m[t]["title"]
    except Exception as e:  # noqa: BLE001
        print("SEC sorgusu başarısız:", e)
    return ticker, None, None


def nice_name(title: str) -> str:
    import sec
    return sec.nice_name(title)


def sec_profile(cik: int) -> dict:
    """SIC sektörü ve ABD GAAP (10-Q/10-K) verisi olup olmadığı."""
    import sec
    out = {"sic": None, "sektor": None, "us_gaap": None, "formlar": []}
    sub = sec.submissions(cik) or {}
    out["sic"], out["sektor"] = sub.get("sic"), sub.get("sicDescription")
    out["formlar"] = sorted(set((sub.get("filings", {}).get("recent", {}) or {}).get("form", [])[:200]))
    cf = sec.companyfacts(cik)
    if cf is not None:
        out["us_gaap"] = bool((cf.get("facts") or {}).get("us-gaap"))
    return out


def latest_metrics(cik: int) -> dict:
    try:
        import sec
        import xbrl
        cf = sec.companyfacts(cik)
        rows = xbrl.build_table(cf).get("ceyrekler", []) if cf else []
        return rows[-1] if rows else {}
    except Exception as e:  # noqa: BLE001
        print("XBRL okunamadı, genel eşikler kullanılacak:", e)
        return {}


def r0(x):
    return int(round(x))


def thesis_block(T: str, name: str, m: dict) -> str:
    """Şirketin mevcut rakamlarına göre 'kaliteyi koru' taslağı. Tüm eşikler sadece başlangıç önerisidir."""
    ry, gm, fm, om = m.get("revenue_yoy"), m.get("gross_margin"), m.get("fcf_margin_ttm"), m.get("operating_margin_ttm")
    note = []
    # Büyüme: mevcut büyümenin yaklaşık yarısı yeşil sınırı
    if ry is not None:
        g_e, g_u = max(5, r0(ry * 0.5)), max(0, r0(ry * 0.2))
        note.append(f"son yıllık büyüme %{ry:.0f}")
    else:
        g_e, g_u = 10, 3
    # Brüt marj: mevcut seviyeden 3 puan düşüşe kadar yeşil, 8 puana kadar sarı
    if gm is not None:
        m_e, m_u = r0(gm - 3), r0(gm - 8)
        note.append(f"brüt marj %{gm:.0f}")
    else:
        m_e, m_u = 40, 30
    # Nakit: FCF pozitifse korunması; negatifse faaliyet marjının iyileşmesi
    if fm is not None and fm > 0:
        cash = (f"    - {{id: nakit, ad: \"Serbest nakit akışı\", tip: metrik, metrik: fcf_margin_ttm, operator: \">\", "
                f"esik: {max(0, r0(fm - 5))}, uyari: {r0(fm - 15)}}}\n")
        note.append(f"FCF marjı %{fm:.0f}")
    else:
        cash = (f"    - {{id: karlilik, ad: \"Kârlılığa gidiş\", tip: metrik, metrik: operating_margin_ttm, operator: \">\", "
                f"esik: 0, uyari: {r0(min(-5, (om or -10) - 5))}}}\n"
                f"    - {{id: pist, ad: \"Nakit pisti\", tip: metrik, metrik: cash_runway_months, operator: \">\", esik: 24, uyari: 12}}\n")
    return (f"\n{T}:\n"
            f"  onay: taslak\n"
            f"  # OTOMATİK ŞABLON: eşikler şirketin bugünkü rakamlarına göre ({', '.join(note) or 'veri yok'}) \"mevcut kaliteyi koru\"\n"
            f"  # mantığıyla önerildi. Kendi tezine göre düzenle; özet ve yorum sütununu kendi cümlelerinle yaz.\n"
            f"  ozet: >\n"
            f"    {name} için tez henüz yazılmadı. Bu otomatik taslak yalnızca büyümenin, marjın, nakit üretiminin\n"
            f"    ve hisse sayısının bugünkü seviyesini koruyup korumadığını izler.\n"
            f"  sutunlar:\n"
            f"    - {{id: buyume, ad: \"Gelir büyümesi\", tip: metrik, metrik: revenue_yoy, operator: \">\", esik: {g_e}, uyari: {g_u}}}\n"
            f"    - {{id: brut_marj, ad: \"Brüt marj\", tip: metrik, metrik: gross_margin, operator: \">\", esik: {m_e}, uyari: {m_u}}}\n"
            f"{cash}"
            f"    - {{id: sulandirma, ad: \"Hisse sayısı\", tip: metrik, metrik: diluted_shares_yoy, operator: \"<\", esik: 2, uyari: 5}}\n"
            f"    - id: rekabet\n"
            f"      ad: \"Rekabet ve yönetim\"\n"
            f"      tip: yorum\n"
            f"      soru: >\n"
            f"        10-Q/10-K ve basın bülteninde rekabet, müşteri yoğunlaşması ve yönetimin beklentileri\n"
            f"        hakkındaki açıklamalar tezi destekliyor mu?\n"
            f"  cikis_kriterleri:\n"
            f"    - {{id: daralma, ad: \"Gelir 2 çeyrek üst üste yıllık bazda daralırsa\", metrik: revenue_yoy, operator: \"<\", esik: 0, ardisik_ceyrek: 2}}\n"
            f"    - {{id: marj_kirilmasi, ad: \"Brüt marj 2 çeyrek üst üste eşiğin (%{m_u - 4}) altına inerse\", metrik: gross_margin, operator: \"<\", esik: {m_u - 4}, ardisik_ceyrek: 2}}\n"
            f"    - {{id: asiri_sulandirma, ad: \"Hisse sayısı yıllık %10'dan fazla artarsa\", metrik: diluted_shares_yoy, operator: \">\", esik: 10, ardisik_ceyrek: 1}}\n")


def add(T: str, name: str | None, benchmarks: list[str]) -> str:
    stocks = load_yaml("stocks.yaml").get("stocks", [])
    if any(s["ticker"].upper() == T for s in stocks):
        return f"{T} zaten listede; değişiklik yapılmadı."
    T, cik, sec_title = sec_lookup(T)
    if any(s["ticker"].upper() == T for s in stocks):
        return f"{T} zaten listede; değişiklik yapılmadı."
    prof = {}
    if cik is None:
        try:
            import sec
            sec_off = sec.sess.disabled
        except Exception:  # noqa: BLE001
            sec_off = True
        if not sec_off:
            raise Hata(f"{T} ABD borsalarındaki SEC şirket listesinde yok. Borsa kodunu kontrol et: sitedeki arama kutusuna "
                       "şirketin adını yazıp listeden seç (ör. Constellation Energy = CEG, Google = GOOGL). "
                       "Frankfurt/Xetra gibi Avrupa borsa kodları burada geçmez.")
    else:
        prof = sec_profile(cik)
        if prof.get("us_gaap") is False:
            forms = [f for f in prof.get("formlar", []) if f in ("20-F", "40-F", "6-K")]
            raise Hata(f"{T} ({nice_name(sec_title)}) SEC'e ABD GAAP bilançosu vermiyor"
                       + (f" (yabancı şirket, {'/'.join(forms)} ile raporluyor)" if forms else "")
                       + ". Bu sitenin bilanço, tez ve insider analizleri SEC'in 10-Q/10-K ve Form 4 verisine dayandığı için eklenmedi.")
    if not benchmarks:
        import sec
        benchmarks = sec.benchmarks_for_sic(prof.get("sic"))
    name = (name or "").strip() or (nice_name(sec_title) if sec_title else T)
    bm = ", ".join(benchmarks)
    p = CONFIG / "stocks.yaml"
    txt = p.read_text(encoding="utf-8").rstrip("\n") + "\n"
    safe = name.replace('"', "'")
    txt += f'  - {{ticker: {T}, name: "{safe}", benchmarks: [{bm}], haber_anahtar: ["{safe}"]}}\n'
    p.write_text(txt, encoding="utf-8")
    msg = [f"{T} ({name}) listeye eklendi."
           + (f" Sektör: {prof['sektor']}." if prof.get("sektor") else "") + f" Karşılaştırma: {bm}."]
    theses = load_yaml("theses.yaml")
    if T not in theses:
        m = latest_metrics(cik) if cik else {}
        tp = CONFIG / "theses.yaml"
        tp.write_text(tp.read_text(encoding="utf-8").rstrip("\n") + "\n" + thesis_block(T, name, m), encoding="utf-8")
        msg.append("Şirketin son rakamlarına göre TASLAK tez yazıldı (config/theses.yaml); gözden geçir.")
    else:
        msg.append("Bu hisse için daha önce yazılmış tez bulundu ve korundu.")
    return " ".join(msg)


def remove(T: str) -> str:
    p = CONFIG / "stocks.yaml"
    lines = p.read_text(encoding="utf-8").splitlines(keepends=True)
    pat = re.compile(rf"^\s*-\s*\{{\s*ticker:\s*{re.escape(T)}\s*,")
    kept = [l for l in lines if not pat.match(l)]
    if len(kept) == len(lines):
        return f"{T} listede yok; değişiklik yapılmadı."
    p.write_text("".join(kept), encoding="utf-8")
    return f"{T} listeden çıkarıldı. Tezi ve geçmiş verisi silinmedi; tekrar eklersen kaldığı yerden devam eder."


def from_issue(title: str, body: str):
    """'hisse ekle CEG' / 'hisse cikar CEG' + gövdede isteğe bağlı 'ad: ...' ve 'benchmarks: ...' satırları."""
    m = re.match(r"^\s*hisse\s+(ekle|cikar|çıkar)\s+([A-Za-z0-9.\-]{1,10})\s*$", title or "", re.I)
    if not m:
        raise Hata("Başlık 'hisse ekle KOD' veya 'hisse cikar KOD' biçiminde olmalı.")
    islem = "cikar" if m.group(1).lower() in ("cikar", "çıkar") else "ekle"
    kv = {}
    for line in (body or "").splitlines():
        k, _, v = line.partition(":")
        if k.strip().lower() in ("ad", "benchmarks") and v.strip():
            kv[k.strip().lower()] = v.strip()[:80]
    return islem, m.group(2), kv.get("ad", ""), kv.get("benchmarks", "")


def _gh_out(ok: bool, msg: str, T: str, islem: str):
    """Sonucu iş akışına yazar: annotation (site bunu okur), özet ve sonraki adımlar için çıktı."""
    import os
    one = msg.replace("\n", " ").replace("%", "%25")
    print(f"::{'notice' if ok else 'error'} title={'Tamam' if ok else 'Hata'}::{one}")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(f"### {'✅' if ok else '❌'} {msg}\n")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"ok={'true' if ok else 'false'}\nticker={T}\nislem={islem}\n")
            f.write(f"mesaj<<EOF_MSG\n{msg}\nEOF_MSG\n")


def main():
    import os
    setup_logging()
    ap = argparse.ArgumentParser()
    ap.add_argument("islem", nargs="?", choices=["ekle", "cikar"])
    ap.add_argument("ticker", nargs="?", default="")
    ap.add_argument("--ad", default="")
    ap.add_argument("--benchmarks", default="")
    ap.add_argument("--issue", action="store_true", help="ISSUE_TITLE / ISSUE_BODY ortam değişkenlerinden oku")
    a = ap.parse_args()
    islem, T = a.islem or "ekle", ""
    try:
        if a.issue:
            islem, tk, ad, bm = from_issue(os.environ.get("ISSUE_TITLE", ""), os.environ.get("ISSUE_BODY", ""))
        else:
            if not a.islem:
                raise Hata("İşlem (ekle/cikar) belirtilmedi.")
            tk, ad, bm = a.ticker, a.ad, a.benchmarks
        T = tk.strip().upper().replace(" ", "")
        if not TICKER_RE.match(T):
            raise Hata(f"'{tk}' geçerli bir borsa kodu değil.")
        if islem == "ekle":
            bms = [b.strip().upper() for b in bm.split(",") if b.strip() and b.strip().lower() != "otomatik"]
            bms = [b for b in bms if TICKER_RE.match(b)][:4]
            out = add(T, ad, bms)
        else:
            out = remove(T)
    except Hata as e:
        _gh_out(False, str(e), T, islem)
        raise SystemExit(1)
    _gh_out(True, out, T, islem)


if __name__ == "__main__":
    main()
