"""Claude görevleri (abonelik, `claude -p`, model claude-opus-5-5). İki tetik:

  python pipeline/claude_tasks.py --filings NVDA,AAOI   # yeni 10-Q/10-K dipnot analizi
  python pipeline/claude_tasks.py --weekly              # Salı 23:00 (Berlin) raporu

Sonrasında `python pipeline/run.py --offline` tez/özet dosyalarını yeniden hesaplar.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import filing_claude  # noqa: E402
import sec  # noqa: E402
import weekly  # noqa: E402
from claude_cli import ARR, ENUM, NSTR, S, STR, Claude, url_ok  # noqa: E402
from common import DATA, load_yaml, log, now_iso, read_json, setup_logging, today, write_json  # noqa: E402

INT = {"type": "integer"}
DURUM = ENUM("yesil", "sari", "kirmizi", "veri_yok")

WEEKLY_SCHEMA = S({
    "ozet": STR,
    "gelismeler": ARR(S({
        "kategori": ENUM("sirket", "urun_sozlesme", "rakip", "musteri", "tedarikci", "sektor", "duzenleme", "diger"),
        "tarih": STR, "baslik": STR, "olgu": STR, "yorum": STR, "etki": ENUM("destekler", "zayiflatir", "notr"),
        "sutun_id": NSTR, "onem": INT, "kaynak_url": STR, "kaynak_adi": STR})),
    "yonetim": S({
        "insider_degerlendirmesi": STR,
        "olaylar": ARR(S({"tur": ENUM("yonetim_degisikligi", "yonetici_aciklamasi", "tartismali_davranis", "dava",
                                      "sec_inceleme", "diger"),
                          "tarih": STR, "olgu": STR, "yorum": STR, "kaynak_url": STR}))}),
    "hareketler": ARR(S({"tarih": STR, "neden": STR,
                         "siniflama": ENUM("sirkete_ozel", "sektor", "piyasa", "karma", "belirsiz"),
                         "teze_etki": STR, "kalicilik": ENUM("kalici", "gurultu", "belirsiz"),
                         "kaynak_urls": ARR(STR)})),
    "tez": S({"degerlendirme": STR,
              "sutun_notlari": ARR(S({"id": STR, "not": STR})),
              "yorum_sutunlari": ARR(S({"id": STR, "durum": DURUM, "gerekce": STR, "kaynak_url": NSTR}))}),
    "neden_tutmali": S({"arguman": STR, "dayanaklar": ARR(S({"olgu": STR, "kaynak": STR}))}),
    "neden_satmali": S({"arguman": STR, "dayanaklar": ARR(S({"olgu": STR, "kaynak": STR})), "zayif_halka": STR}),
    "dca_notu": S({"kural_durumu": STR, "riskler": ARR(STR), "not": STR}),
    "radar": ARR(S({"kategori": ENUM("marka_patent", "ise_alim", "konferans", "earnings_call_dili", "sektor_tedarik",
                                     "uygulama_magazasi"),
                    "sinyal": STR, "yorum": STR, "yon": ENUM("olumlu", "olumsuz", "belirsiz"),
                    "guven": ENUM("dusuk", "orta", "yuksek"), "sutun_id": NSTR, "tarih": NSTR, "kaynak_url": STR})),
})

WEEKLY_PROMPT = """Sen Wall Street'te çalışan kıdemli bir hisse analistisin. Okuyucu uzun vadeli, haftalık DCA yapan bir yatırımcı ve ileri seviye muhasebe bilen bir controller; Çarşamba sabahı DCA alımından önce bu raporu okuyacak. Yüzeysel özet değil, derin ve eleştirel analiz yaz.

stdin'de {ticker} ({name}) için bu haftanın VERİ PAKETİ (JSON) var: fiyat ve benchmark'lar, tez sütunlarının Python ile hesaplanmış durumu (SEC XBRL), kural durumu, Form 4 insider işlemleri (kod ve 10b5-1 ayrımıyla), ±%{esik} üzeri büyük hareketler (benchmark, başlık ve SEC bildirimleriyle), haftanın haber başlıkları, SEC bildirimleri, son bilanço analizi özeti. Bugün: {bugun}. Dönem: {ws} – {we}.

WEB ARAMASI: En fazla ~{maxs} arama yap. Başlık listesi sadece başlangıç noktası; haftanın TÜM önemli gelişmelerini tamamla: şirket haberleri, ürün ve sözleşmeler, rakipler, müşteriler, tedarikçiler, sektör ve düzenleme. Yönetim değişiklikleri, yönetici açıklamaları, tartışmalı davranışlar, davalar ve SEC incelemelerini ara. Öncü sinyal radarı için: sektör/tedarik zinciri haberleri, marka ve patent başvuruları, iş ilanı yoğunlaşmaları, konferans gündemleri, earnings call dilindeki değişimler.

KESİN KURALLAR:
1. Sayıları ASLA hafızandan üretme. Sayılar ya veri paketinden ya da linkini verdiğin kaynaktan gelmeli; yoksa "veri yok" yaz.
2. Her gelişme, olay ve radar sinyali için `kaynak_url` zorunlu: yalnızca web aramasında/çektiğin sayfada gerçekten gördüğün ya da veri paketinde bulunan URL'ler. Uydurma link otomatik elenir.
3. `olgu` yalnızca kaynağın söylediğidir; `yorum` senin analizindir. Karıştırma.
4. Al veya sat komutu verme. Senaryo, risk ve tez durumu sun. DCA notunda bilgi ver, talimat verme.
5. Fiyat hareketi ile tez durumunu ayrı tut; fiyat düşüşü tek başına tezin bozulduğu anlamına gelmez.
6. Türkçe yaz.

BÖLÜMLER:
- ozet: haftanın analist notu (1 yoğun paragraf).
- gelismeler (1): haftanın tüm önemli gelişmeleri; onem 1-5; ilgili tez sütunu id'si (sutun_id) ve teze etkisi.
- yonetim (2): insider_degerlendirmesi — veri paketindeki Form 4 işlemlerini kod (P/S/F/M/A) ve 10b5-1 ayrımıyla yorumla; olaylar — yönetim değişiklikleri, açıklamalar, tartışmalar, davalar, SEC incelemeleri.
- hareketler (3): veri paketindeki HER büyük hareket için: neden oldu, şirkete özel mi/sektör mü/piyasa mı (benchmark'lara bak), teze etkisi, kalıcı mı gürültü mü. Hareket yoksa boş liste.
- tez (4): her sütunun durumu veri paketinde; değişenlerin nedenini sutun_notlari'nda açıkla. "yorum" tipindeki sütunları bu haftanın bilgisiyle yeniden değerlendir (yorum_sutunlari).
- neden_tutmali (5): bu hafta itibarıyla EN GÜÇLÜ tutma argümanı ve dayanakları (kaynak: URL veya "Veri paketi: <alan>").
- neden_satmali (6): şeytanın avukatı olarak EN GÜÇLÜ satış argümanı; dürüst ve sert; zayif_halka = en kırılgan sütun.
- dca_notu (7): tetiklenen alım kuralı var mı (veri paketindeki kural durumu), dikkat edilmesi gereken riskler; komut değil bilgi.
- radar: öncü sinyaller, her birine güven seviyesi (dusuk/orta/yuksek) ve kaynak. Bu bölüm gürültülüdür; abartma."""


def load_cfg():
    settings = load_yaml("settings.yaml")
    stocks = load_yaml("stocks.yaml").get("stocks", [])
    for s in stocks:
        s["ticker"] = s["ticker"].upper()
        s.setdefault("name", s["ticker"])
        s.setdefault("benchmarks", settings.get("default_benchmarks", ["QQQ", "SMH"]))
    return settings, stocks, load_yaml("theses.yaml")


def do_filing(cl: Claude, T: str, th: dict | None, max_turns: int) -> str | None:
    fund = read_json(DATA / "fundamentals" / f"{T}.json", {}) or {}
    cik = fund.get("cik")
    if not cik:
        return "CIK/fundamentals yok"
    sub = sec.submissions(int(cik))
    recent = sec.recent_filings(sub) if sub else []
    if not recent:
        return "SEC submissions alınamadı"
    res = filing_claude.analyze_filing(cl, T, int(cik), recent, fund.get("tablo") or {}, th, max_turns)
    apath = DATA / "analysis" / f"{T}.json"
    an = read_json(apath, {}) or {}
    if an.get("son") and not an["son"].get("hata") and an["son"]["dosya"]["accn"] != (res.get("dosya") or {}).get("accn"):
        hist = an.get("gecmis", [])
        hist.insert(0, {"dosya": an["son"]["dosya"], "ozet": (an["son"].get("analiz") or {}).get("ozet"),
                        "seytanin_avukati": (an["son"].get("analiz") or {}).get("seytanin_avukati")})
        an["gecmis"] = hist[:8]
    an["son"] = res
    write_json(apath, an)
    return res.get("hata")


def build_context(T: str, s: dict, summary: dict) -> dict:
    ctx = weekly.stock_snapshot(T, s, summary, 7)
    te = read_json(DATA / "thesis" / f"{T}.json", {}) or {}
    ctx["tez_detay"] = {"ozet": te.get("ozet"), "genel": te.get("genel"), "onay": te.get("onay"),
                        "sutunlar": [{k: p.get(k) for k in ("id", "ad", "tip", "durum", "metrik_adi", "deger", "birim", "donem",
                                                            "esik", "uyari", "operator", "soru", "gerekce")}
                                     | {"gecmis": (p.get("gecmis") or [])[-4:]} for p in te.get("sutunlar", [])],
                        "cikis_kriterleri": te.get("cikis")}
    ctx["kural_detay"] = read_json(DATA / "rules" / f"{T}.json", {})
    fund = read_json(DATA / "fundamentals" / f"{T}.json", {}) or {}
    ctx["kazanc_kalitesi_bulgulari"] = [{k: b.get(k) for k in ("etiket", "baslik", "olgu")}
                                        for b in ((fund.get("kalite") or {}).get("bulgular") or [])]
    an = (read_json(DATA / "analysis" / f"{T}.json", {}) or {}).get("son") or {}
    ctx["son_bilanco_analizi"] = {"dosya": an.get("dosya"), "ozet": (an.get("analiz") or {}).get("ozet"),
                                  "guidance": (an.get("analiz") or {}).get("guidance")}
    # önceki haftanın argümanları (tekrarı önlemek ve değişimi görmek için)
    idx = read_json(DATA / "weekly" / "index.json", []) or []
    for label in reversed(idx):
        prev = ((read_json(DATA / "weekly" / f"{label}.json", {}) or {}).get("hisseler") or {}).get(T, {}).get("claude") or {}
        if prev and not prev.get("hata"):
            ctx["onceki_rapor"] = {"hafta": label, "ozet": prev.get("ozet"),
                                   "neden_satmali": (prev.get("neden_satmali") or {}).get("arguman", "")[:1200],
                                   "neden_tutmali": (prev.get("neden_tutmali") or {}).get("arguman", "")[:1200]}
            break
    for m in ctx["buyuk_hareketler"]:
        m.pop("claude", None)
    return ctx


def _urls_in(obj) -> set:
    return set(re.findall(r"https?://[^\s\"'<>]+", json.dumps(obj, ensure_ascii=False)))


def do_weekly(cl: Claude, stocks: list, settings: dict, max_turns: int) -> dict:
    summary = read_json(DATA / "summary.json", {}) or {}
    rdate = today().isoformat()
    y, w, _ = today().isocalendar()
    label = f"{y}-W{w:02d}"
    path = DATA / "weekly" / f"{label}.json"
    out = read_json(path, {}) or {}
    out.update({"hafta": label, "rapor_tarihi": rdate, "guncelleme": now_iso(), "model": cl.model,
                "tur": "sali_raporu"})
    out.setdefault("hisseler", {})
    esik = settings.get("moves", {}).get("threshold_pct", 5)
    for s in stocks:
        T = s["ticker"]
        ctx = build_context(T, s, summary)
        prompt = WEEKLY_PROMPT.format(ticker=T, name=s["name"], esik=esik, bugun=rdate, ws=ctx["donem"][0],
                                      we=ctx["donem"][1], maxs=15)
        res = cl.run("sali_raporu", T, prompt, json.dumps(ctx, ensure_ascii=False, default=str), schema=WEEKLY_SCHEMA,
                     web=True, max_turns=max_turns)
        entry = {"veri": {k: ctx[k] for k in ("fiyat", "benchmark_haftalik", "tez", "kural", "donem")},
                 "insider_hafta": ctx["insider"]["hafta_kodlari"], "buyuk_hareketler": ctx["buyuk_hareketler"]}
        if not res["ok"]:
            entry["claude"] = {"hata": res["hata"]}
            out["hisseler"][T] = entry
            write_json(path, out)
            continue
        r = res["json"]
        allowed = set(res["urls"]) | _urls_in(ctx)
        dropped = 0
        for key in ("gelismeler", "radar"):
            keep = [x for x in r.get(key, []) if url_ok(x.get("kaynak_url", ""), allowed)]
            dropped += len(r.get(key, [])) - len(keep)
            r[key] = keep
        ol = (r.get("yonetim") or {}).get("olaylar", [])
        keep = [x for x in ol if url_ok(x.get("kaynak_url", ""), allowed)]
        dropped += len(ol) - len(keep)
        if r.get("yonetim"):
            r["yonetim"]["olaylar"] = keep
        for h in r.get("hareketler", []):
            h["kaynak_urls"] = [u for u in h.get("kaynak_urls", []) if url_ok(u, allowed)]
        for sec_key in ("neden_tutmali", "neden_satmali"):
            for d in (r.get(sec_key) or {}).get("dayanaklar", []):
                k = d.get("kaynak", "")
                d["kaynak_dogrulandi"] = url_ok(k, allowed) if k.startswith("http") else k.lower().startswith("veri paketi")
        for y_ in (r.get("tez") or {}).get("yorum_sutunlari", []):
            if y_.get("kaynak_url") and not url_ok(y_["kaynak_url"], allowed):
                y_["kaynak_url"] = None
        r["elenen_dogrulanamayan"] = dropped
        entry["claude"] = r
        out["hisseler"][T] = entry
        # hareket kayıtlarına Claude açıklamasını ekle
        mpath = DATA / "moves" / f"{T}.json"
        mv = read_json(mpath, {}) or {}
        byd = {h["tarih"]: h for h in r.get("hareketler", [])}
        for m in mv.get("hareketler", []):
            if m["tarih"] in byd:
                m["claude"] = {**byd[m["tarih"]], "rapor": label, "model": cl.model}
        if mv:
            write_json(mpath, mv)
        write_json(path, out)
    # DCA tablosu (deterministik, raporun başında)
    out["dca_tablosu"] = [{"ticker": T, "kural": ((summary.get("hisseler") or {}).get(T) or {}).get("kural"),
                           "tez": (((summary.get("hisseler") or {}).get(T) or {}).get("tez") or {}).get("genel"),
                           "claude_notu": ((h.get("claude") or {}).get("dca_notu"))} for T, h in out["hisseler"].items()]
    write_json(path, out)
    idx = read_json(DATA / "weekly" / "index.json", []) or []
    if label not in idx:
        idx.append(label)
    write_json(DATA / "weekly" / "index.json", sorted(idx)[-104:])
    return out


def main():
    setup_logging()
    ap = argparse.ArgumentParser()
    ap.add_argument("--filings", default="")
    ap.add_argument("--weekly", action="store_true")
    args = ap.parse_args()
    settings, stocks, theses = load_cfg()
    if not settings.get("claude", {}).get("aktif", False):
        # Ana şalter kapalı: hiçbir Claude çağrısı yapma (Pro planından harcama yok)
        print("Claude kapalı (config/settings.yaml → claude.aktif: false); hiçbir görev çalıştırılmadı.")
        return
    rid = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    cl = Claude(rid)
    mt = settings.get("claude", {}).get("max_turns", {})
    errors = []
    started = now_iso()
    if not cl.available:
        errors.append({"adim": "claude", "ticker": None, "hata": "Claude devre dışı: CLAUDE_CODE_OAUTH_TOKEN veya claude CLI yok"})
    else:
        for T in [t.strip().upper() for t in args.filings.split(",") if t.strip()]:
            e = do_filing(cl, T, theses.get(T), mt.get("bilanco", 20))
            if e:
                errors.append({"adim": "bilanco_claude", "ticker": T, "hata": e})
        if args.weekly:
            w = do_weekly(cl, stocks, settings, mt.get("sali_raporu", 60))
            for T, h in (w.get("hisseler") or {}).items():
                if (h.get("claude") or {}).get("hata"):
                    errors.append({"adim": "sali_raporu", "ticker": T, "hata": h["claude"]["hata"]})
    runs = read_json(DATA / "runs.json", []) or []
    runs.insert(0, {"id": rid, "tur": "claude", "baslangic": started, "bitis": now_iso(),
                    "gorevler": {"bilanco": args.filings, "sali_raporu": args.weekly}, "model": cl.model,
                    "claude_aktif": cl.available, "claude": cl.totals, "hatalar": errors})
    write_json(DATA / "runs.json", runs[:150])
    log.info("Claude görevleri bitti: %s, hatalar: %s", cl.totals, errors)


if __name__ == "__main__":
    main()
