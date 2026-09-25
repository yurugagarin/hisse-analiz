"""Yeni 10-Q/10-K geldiğinde: tam metin + kazanç basın bülteni -> Claude (abonelik, claude -p).

Belgeler stdin ile verilir (web araması yok). Her bulgu için belgeden birebir alıntı
istenir; alıntı SEC metninde aranır ve ✓/✕ olarak işaretlenir.
"""
from __future__ import annotations

import datetime as dt
import re

import sec
from claude_cli import ARR, BOOL, ENUM, S, STR, Claude, verify_quote
from common import now_iso

MAX_DOC_CHARS = 700_000
MAX_PR_CHARS = 150_000
KB = ENUM("10-Q/10-K", "basin_bulteni", "onceki_basin_bulteni", "metrik_tablosu")

FILING_SCHEMA = S({
    "ozet": STR,
    "non_gaap": S({
        "aciklama_var": BOOL,
        "duzeltmeler": ARR(S({"kalem": STR, "tutar_metni": STR,
                              "degerlendirme": ENUM("makul", "kari_iyi_gosteriyor", "belirsiz"),
                              "gerekce": STR, "kanit_alinti": STR, "kaynak_belge": KB})),
        "genel_yorum": STR}),
    "musteri_yogunlasmasi": S({"aciklama_var": BOOL, "detay": STR, "bolum": STR, "kanit_alinti": STR,
                               "etiket": ENUM("kirmizi_bayrak", "dikkat", "olumlu", "bilgi")}),
    "organik_buyume": S({"satin_alma_var": BOOL, "detay": STR, "bolum": STR, "kanit_alinti": STR}),
    "guidance": S({"onceki_guidance": STR, "onceki_alinti": STR, "gerceklesen": STR, "gerceklesen_alinti": STR,
                   "sonuc": ENUM("ustunde", "icinde", "altinda", "karsilastirilamaz"),
                   "yeni_guidance": STR, "yeni_alinti": STR}),
    "dipnot_bulgulari": ARR(S({"etiket": ENUM("kirmizi_bayrak", "dikkat", "olumlu"), "baslik": STR,
                               "aciklama": STR, "bolum": STR, "kanit_alinti": STR, "kaynak_belge": KB})),
    "yorum_sutunlari": ARR(S({"id": STR, "durum": ENUM("yesil", "sari", "kirmizi", "veri_yok"),
                              "gerekce": STR, "kanit_alinti": STR, "kaynak_belge": KB})),
    "seytanin_avukati": S({"en_guclu_arguman": STR,
                           "destekleyen_olgular": ARR(S({"olgu": STR, "kaynak": STR})),
                           "tezin_zayif_halkasi": STR,
                           "argumani_curutecek_gostergeler": ARR(STR)}),
})

PROMPT = """Sen Wall Street'te çalışan kıdemli bir hisse analisti ve kazanç kalitesi uzmanısın. Okuyucu ileri seviye muhasebe bilen bir controller; yüzeysel özet değil, eleştirel analiz istiyor. Belgeler stdin'de (BELGE 1: 10-Q/10-K tam metin, BELGE 2: bu çeyreğin kazanç basın bülteni, BELGE 3: önceki çeyreğin basın bülteni, METRİK TABLOSU: SEC XBRL'den Python'la hesaplandı).

KESİN KURALLAR:
1. Yalnızca stdin'deki belgelerdeki ve METRİK TABLOSU'ndaki sayıları kullan. Hafızandan hiçbir sayı üretme; yoksa "veri yok" yaz. Web araması yapma.
2. Her bulgu için `kanit_alinti`: ilgili belgeden BİREBİR, en fazla 300 karakterlik alıntı (otomatik doğrulanacak). Metrik tablosuna dayanıyorsa kaynak_belge="metrik_tablosu" ve tablo satırını yaz.
3. `bolum`: dipnot/bölüm başlığı (ör. "Note 12 - Segment Information").
4. Al/sat tavsiyesi verme. Alıntı olgudur; `aciklama`/`gerekce` yorumdur.
5. Non-GAAP: tekrarlayan maliyeti (SBC, sürekli 'yeniden yapılanma') dışlayan düzeltme -> kari_iyi_gosteriyor; gerçekten tek seferlik/nakit dışı ve faaliyetle ilgisiz -> makul.
6. `seytanin_avukati`: "Bu hisseyi şimdi satmak için en güçlü argüman nedir?" Tezine karşı dürüst ve sert yaz; olguların kaynağı "SEC XBRL: <metrik>" veya "10-Q/10-K: <bölüm>" olsun.
7. Türkçe yaz.

HİSSE: {ticker} — {form}, dönem sonu {period}, dosyalama {filed}
KULLANICININ TEZİ: {ozet}
YORUM GEREKTİREN TEZ SÜTUNLARI (yorum_sutunlari'nda her biri için durum ver):
{pillars}

GÖREVLER: (1) non-GAAP mutabakatını eleştirel değerlendir, (2) müşteri yoğunlaşması, (3) organik vs satın alma büyümesi, (4) önceki guidance vs gerçekleşen + yeni guidance, (5) dipnotlardan 3-8 kazanç kalitesi bulgusu (gelir tanıma, stok değer düşüklüğü, alım taahhütleri, türevler/warrant, vergi, ilişkili taraf, dava, borç/convertible, segment), (6) yorum sütunları, (7) şeytanın avukatı."""


def _latest(recent):
    per = sorted([f for f in recent if f.get("form") in ("10-Q", "10-K")], key=lambda f: f["filingDate"], reverse=True)
    e8 = sorted([f for f in recent if f.get("form") == "8-K" and "2.02" in (f.get("items") or "")],
                key=lambda f: f["filingDate"], reverse=True)
    return (per[0] if per else None), e8


def _minus(d, n):
    return (dt.date.fromisoformat(d) - dt.timedelta(days=n)).isoformat()


def _pr(cik, f8k):
    if not f8k:
        return "", []
    items = sec.filing_files(cik, f8k["accessionNumber"])
    names = sorted(i["name"] for i in items if re.search(r"ex[-_]?99", i.get("name", ""), re.I)
                   and i["name"].lower().endswith((".htm", ".html", ".txt")))[:2]
    txt, refs = [], []
    for n in names:
        url = sec.archive_url(cik, f8k["accessionNumber"], n)
        h = sec.fetch_text(url)
        if h:
            txt.append(f"--- {n} ---\n{sec.html_to_text(h)}")
            refs.append({"ad": n, "url": url, "tarih": f8k["filingDate"]})
    return "\n\n".join(txt)[:MAX_PR_CHARS], refs


def metrics_text(table: dict, n: int = 8) -> str:
    rows = table.get("ceyrekler", [])[-n:]
    keys = ["revenue", "revenue_yoy", "gross_margin", "operating_income", "operating_margin", "net_income", "ocf",
            "capex", "fcf", "fcf_margin_ttm", "ocf_to_ni_ttm", "sbc_to_revenue_ttm", "diluted_shares",
            "diluted_shares_yoy", "ar", "dso", "inventory", "inventory_yoy", "dio", "deferred_revenue", "rpo",
            "rpo_yoy", "liquidity", "cash_runway_months", "interest_income", "pretax", "tax"]
    lines = ["| metrik | " + " | ".join(r.get("etiket", r["donem_sonu"]) for r in rows) + " |"]
    for k in keys:
        vals = ["—" if r.get(k) is None else (f"{r[k]:,.0f}" if abs(r[k]) >= 1000 else f"{r[k]}") for r in rows]
        lines.append(f"| {k} | " + " | ".join(vals) + " |")
    return "\n".join(lines)


def analyze_filing(cl: Claude, ticker: str, cik: int, recent: list, table: dict, thesis: dict | None,
                   max_turns: int = 20) -> dict:
    latest, e8 = _latest(recent)
    if not latest:
        return {"hata": "10-Q/10-K bulunamadı"}
    accn = latest["accessionNumber"]
    url = sec.archive_url(cik, accn, latest["primaryDocument"])
    html = sec.fetch_text(url)
    if not html:
        return {"hata": f"Belge indirilemedi: {url}"}
    doc = sec.html_to_text(html)
    cur8 = next((f for f in e8 if _minus(latest["filingDate"], 75) <= f["filingDate"] <= latest["filingDate"]), None)
    prev8 = next((f for f in e8 if cur8 and f["filingDate"] < _minus(cur8["filingDate"], 40)), None)
    pr, pr_refs = _pr(cik, cur8)
    prev_pr, prev_refs = _pr(cik, prev8)
    mt = metrics_text(table)
    pillars = [p for p in (thesis or {}).get("sutunlar", []) if p.get("tip") == "yorum"]
    prompt = PROMPT.format(ticker=ticker, form=latest["form"], period=latest.get("reportDate"), filed=latest["filingDate"],
                           ozet=(thesis or {}).get("ozet", "(tez yok)").strip(),
                           pillars="\n".join(f"- id={p['id']}: {p['ad']} — {p.get('soru', '').strip()}" for p in pillars) or "(yok)")
    truncated = len(doc) > MAX_DOC_CHARS
    stdin = (f"=== METRİK TABLOSU (SEC XBRL) ===\n{mt}\n\n=== BELGE 1: {latest['form']} TAM METİN"
             f"{' (UYARI: uzunluk sınırında kesildi)' if truncated else ''} ===\n{doc[:MAX_DOC_CHARS]}\n\n"
             f"=== BELGE 2: BU ÇEYREĞİN KAZANÇ BASIN BÜLTENİ ===\n{pr or '(bulunamadı)'}\n\n"
             f"=== BELGE 3: ÖNCEKİ ÇEYREĞİN BASIN BÜLTENİ ===\n{prev_pr or '(bulunamadı)'}\n")
    res = cl.run("bilanco_analizi", ticker, prompt, stdin, schema=FILING_SCHEMA, web=False, max_turns=max_turns)
    out = {"dosya": {"accn": accn, "form": latest["form"], "donem_sonu": latest.get("reportDate"),
                     "tarih": latest["filingDate"], "url": url, "index_url": sec.filing_index_url(cik, accn),
                     "kesildi": truncated, "karakter": len(doc)},
           "basin_bulteni": pr_refs, "onceki_basin_bulteni": prev_refs, "model": cl.model, "guncelleme": now_iso()}
    if not res["ok"]:
        out["hata"] = res["hata"]
        return out
    a = res["json"]
    srcs = {"10-Q/10-K": doc, "basin_bulteni": pr, "onceki_basin_bulteni": prev_pr, "metrik_tablosu": mt}
    alltext = "\n".join(srcs.values())

    def chk(it):
        q = it.get("kanit_alinti", "")
        it["kanit_alinti_dogrulandi"] = verify_quote(q, srcs.get(it.get("kaynak_belge"), "") or "") or verify_quote(q, alltext)

    for it in (a.get("non_gaap") or {}).get("duzeltmeler", []) + a.get("dipnot_bulgulari", []) + a.get("yorum_sutunlari", []):
        chk(it)
    for k in ("musteri_yogunlasmasi", "organik_buyume"):
        if a.get(k):
            a[k]["kanit_alinti_dogrulandi"] = verify_quote(a[k].get("kanit_alinti", ""), alltext)
    g = a.get("guidance") or {}
    for k in ("onceki_alinti", "gerceklesen_alinti", "yeni_alinti"):
        g[k + "_dogrulandi"] = verify_quote(g.get(k, ""), alltext)
    for o in (a.get("seytanin_avukati") or {}).get("destekleyen_olgular", []):
        o["kaynak_dogrulandi"] = bool(re.match(r"^(SEC XBRL|10-Q|10-K)", o.get("kaynak", "")))
    out["analiz"] = a
    return out
