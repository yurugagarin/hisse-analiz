"""Günlük pipeline (yalnızca Python, Claude YOK).

  python pipeline/run.py                  # günlük veri toplama + değerlendirme
  python pipeline/run.py --offline        # ağ yok: kayıtlı veriden tez/kural/özet yeniden hesapla
  python pipeline/run.py --force-filings  # XBRL tablosunu yeni dosya olmasa da yeniden kur
  python pipeline/run.py --tickers NVDA,META

Günlük: fiyat (Nasdaq/Yahoo), haber başlıkları (Finnhub + Google News RSS), SEC Form 4,
büyük hareket kaydı, tez/kural/sinyal değerlendirmesi. XBRL bilanço tablosu yalnızca
yeni 10-Q/10-K geldiğinde yeniden kurulur. Claude gerektiren işler (yeni bilançonun
dipnot analizi) data/pending_claude.json'a yazılır; claude_tasks.py bunları çalıştırır.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import anlati  # noqa: E402
import insider as insider_mod  # noqa: E402
import moves as moves_mod  # noqa: E402
import news  # noqa: E402
import prices  # noqa: E402
import quality  # noqa: E402
import rules  # noqa: E402
import sec  # noqa: E402
import signals  # noqa: E402
import thesis as thesis_mod  # noqa: E402
import weekly  # noqa: E402
import xbrl  # noqa: E402
from common import DATA, load_yaml, log, now_iso, read_json, setup_logging, today, write_json  # noqa: E402
from finnhub import Finnhub  # noqa: E402


class Run:
    def __init__(self, args):
        self.args = args
        self.id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        self.errors: list[dict] = []
        self.steps: dict[str, dict] = {}

    def step(self, name, ticker, fn, *a, **kw):
        t0 = time.time()
        st = self.steps.setdefault(name, {"ok": 0, "hata": 0, "sure_sn": 0.0})
        try:
            r = fn(*a, **kw)
            st["ok"] += 1
            return r
        except Exception as e:  # noqa: BLE001
            log.error("%s %s HATA: %s\n%s", name, ticker, e, traceback.format_exc())
            self.errors.append({"adim": name, "ticker": ticker, "hata": f"{type(e).__name__}: {e}"[:400]})
            st["hata"] += 1
            return None
        finally:
            st["sure_sn"] = round(st["sure_sn"] + time.time() - t0, 1)


def load_config():
    settings = load_yaml("settings.yaml")
    stocks = load_yaml("stocks.yaml").get("stocks", [])
    for s in stocks:
        s["ticker"] = s["ticker"].upper()
        s.setdefault("name", s["ticker"])
        s.setdefault("benchmarks", settings.get("default_benchmarks", ["QQQ", "SMH"]))
    return settings, stocks, load_yaml("theses.yaml"), load_yaml("rules.yaml")


def filings_map(cik: int, recent: list[dict]) -> dict:
    out = {}
    for f in recent:
        if f.get("form") in ("10-Q", "10-K", "10-Q/A", "10-K/A", "8-K"):
            out[f["accessionNumber"]] = {"form": f["form"], "filingDate": f["filingDate"], "reportDate": f.get("reportDate"),
                                         "url": sec.archive_url(cik, f["accessionNumber"], f.get("primaryDocument", "")),
                                         "index_url": sec.filing_index_url(cik, f["accessionNumber"])}
    return out


def save_filings(T: str, cik: int, recent: list[dict]) -> None:
    """Son 120 günün SEC bildirimlerini (Form 4 hariç özet) sakla: Salı raporu ve hareket açıklayıcı için."""
    cutoff = (today() - dt.timedelta(days=120)).isoformat()
    rows = [{"form": f["form"], "tarih": f["filingDate"], "donem": f.get("reportDate"), "items": f.get("items") or "",
             "aciklama": f.get("primaryDocDescription") or "", "accn": f["accessionNumber"],
             "url": sec.archive_url(cik, f["accessionNumber"], f.get("primaryDocument", ""))}
            for f in recent if f.get("filingDate", "") >= cutoff]
    write_json(DATA / "filings" / f"{T}.json", {"ticker": T, "cik": cik, "guncelleme": now_iso(), "bildirimler": rows})


def fundamentals(run: Run, T: str, cik: int, recent: list[dict]) -> tuple[dict, bool]:
    path = DATA / "fundamentals" / f"{T}.json"
    old = read_json(path, {}) or {}
    periodic = sorted([f for f in recent if f.get("form") in ("10-Q", "10-K")], key=lambda f: f["filingDate"], reverse=True)
    latest = periodic[0] if periodic else None
    accn = latest["accessionNumber"] if latest else None
    if old and old.get("son_dosya", {}).get("accn") == accn and not run.args.force_filings and not old.get("xbrl_beklemede"):
        log.info("%s: yeni 10-Q/10-K yok (%s) — XBRL tablosu yeniden kurulmadı", T, accn)
        return old, False
    cf = sec.companyfacts(cik)
    if not cf:
        raise RuntimeError("companyfacts alınamadı")
    table = xbrl.build_table(cf)
    write_json(DATA / "debug" / f"{T}_etiketler.json", xbrl.tag_dump(cf, table))
    fmap = filings_map(cik, recent)
    q = quality.analyze(table, fmap, cik, T)
    last_end = table["ceyrekler"][-1]["donem_sonu"] if table.get("ceyrekler") else None
    beklemede = bool(latest and latest.get("reportDate") and last_end
                     and last_end < (dt.date.fromisoformat(latest["reportDate"]) - dt.timedelta(days=5)).isoformat())
    obj = {"ticker": T, "cik": cik, "sirket": cf.get("entityName"), "guncelleme": now_iso(),
           "son_dosya": {"accn": accn, "form": latest["form"] if latest else None, "tarih": latest["filingDate"] if latest else None,
                         "donem_sonu": latest.get("reportDate") if latest else None,
                         "url": fmap.get(accn, {}).get("url") if accn else None},
           "xbrl_beklemede": beklemede, "tablo": table, "kalite": q,
           "dosyalar": [{"form": f["form"], "tarih": f["filingDate"], "donem_sonu": f.get("reportDate"), "accn": f["accessionNumber"],
                         "url": sec.archive_url(cik, f["accessionNumber"], f.get("primaryDocument", ""))} for f in periodic[:12]],
           "kaynak": f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"}
    if beklemede:
        log.warning("%s: %s dosyalandı ama XBRL henüz güncellenmemiş; yarın tekrar denenecek", T, accn)
    write_json(path, obj)
    return obj, True


def _plan_pct(ins: dict):
    s = ((ins.get("pencereler") or {}).get("90", {}).get("kodlar", {}).get("S") or {})
    return round(s["plan_10b5_1_adet"] / s["adet"] * 100, 1) if s.get("adet") else None


def latest_weekly_for(T: str) -> dict | None:
    idx = read_json(DATA / "weekly" / "index.json", []) or []
    for label in reversed(idx):
        w = read_json(DATA / "weekly" / f"{label}.json", {}) or {}
        if w.get("tur") != "sali_raporu" or not isinstance(w.get("hisseler"), dict):
            continue
        h = w["hisseler"].get(T) or {}
        c = h.get("claude")
        if c and not c.get("hata"):
            return {**c, "rapor_tarihi": w.get("rapor_tarihi"), "hafta": label}
    return None


def main():
    setup_logging()
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--force-filings", action="store_true")
    ap.add_argument("--tickers", default="")
    args = ap.parse_args()
    run = Run(args)
    started = now_iso()
    settings, stocks, theses, rcfg = load_config()
    only = {t.strip().upper() for t in args.tickers.split(",") if t.strip()}
    active = {s["ticker"] for s in stocks if not only or s["ticker"] in only}
    fh = Finnhub()
    if args.offline:
        fh.available = False
        sec.sess.disabled = True

    write_json(DATA / "config.json", {"stocks": stocks, "theses": theses, "rules": rcfg,
                                      "settings": settings, "guncelleme": now_iso()})

    bench_syms = sorted({b for s in stocks for b in s["benchmarks"]} | {"QQQ"})
    pstats = {}
    for sym in [s["ticker"] for s in stocks] + bench_syms:
        p = None
        if not args.offline and (sym in active or sym in bench_syms):
            p = run.step("fiyat", sym, prices.update, sym, fh)
        pstats[sym] = prices.stats(p or read_json(DATA / "prices" / f"{sym}.json", {}) or {})

    summary = {"guncelleme": now_iso(), "hisseler": {}, "benchmarklar": {b: pstats.get(b, {}) for b in bench_syms}}
    old_summary = read_json(DATA / "summary.json", {}) or {}
    pending = []

    for s in stocks:
        T = s["ticker"]
        if T not in active:
            if T in old_summary.get("hisseler", {}):
                summary["hisseler"][T] = old_summary["hisseler"][T]
            continue
        log.info("==== %s ====", T)
        th = theses.get(T)
        # --- SEC ---
        cik = s.get("cik") or (None if args.offline or sec.sess.disabled else run.step("cik", T, sec.cik_for, T))
        recent = []
        if cik and not sec.sess.disabled:
            sub = run.step("sec_submissions", T, sec.submissions, int(cik))
            recent = sec.recent_filings(sub) if sub else []
            for f in recent:
                f["_url"] = sec.archive_url(int(cik), f["accessionNumber"], f.get("primaryDocument", ""))
            if recent:
                save_filings(T, int(cik), recent)
        fund, is_new = (read_json(DATA / "fundamentals" / f"{T}.json", {}) or {}), False
        if cik and recent:
            r = run.step("bilanco_xbrl", T, fundamentals, run, T, int(cik), recent)
            if r:
                fund, is_new = r
        table = fund.get("tablo", {}) or {}
        an_txt = run.step("bilanco_yorum", T, anlati.build, T, s["name"], table, fund.get("kalite")) if table else None
        if an_txt:
            write_json(DATA / "anlati" / f"{T}.json", an_txt)
        an_txt = an_txt or read_json(DATA / "anlati" / f"{T}.json", {}) or {}
        # --- Sonraki bilanço tarihi (Finnhub) ---
        epath = DATA / "earnings" / f"{T}.json"
        if fh.available:
            e = run.step("bilanco_takvimi", T, fh.earnings, T)
            if e is not None:
                write_json(epath, {"tarih": e.get("date"), "saat": e.get("hour"), "eps_tahmin": e.get("epsEstimate"),
                                   "gelir_tahmin": e.get("revenueEstimate"), "ceyrek": e.get("quarter"), "yil": e.get("year"),
                                   "kaynak": "Finnhub earnings calendar (konsensüs tahmini)", "guncelleme": now_iso()})
        earn = read_json(epath, {}) or {}
        if earn.get("tarih") and earn["tarih"] < today().isoformat():
            earn = {}
        # --- Insider ---
        ins = None
        if cik and recent:
            icache = run.step("insider_form4", T, insider_mod.update_cache, T, int(cik), recent)
            fh_ins = run.step("finnhub_insider", T, fh.insider, T) if fh.available else None
            if icache is not None:
                ins = run.step("insider_analiz", T, insider_mod.analyze, T, icache, settings.get("insider", {}),
                               pstats.get(T, {}), fh_ins)
                if ins:
                    write_json(DATA / "insider" / f"{T}.json", ins)
        ins = ins or read_json(DATA / "insider" / f"{T}.json", {}) or {}
        # --- Haber başlıkları ---
        ncfg = settings.get("news", {})
        heads = (read_json(DATA / "headlines" / f"{T}.json", {}) or {}).get("basliklar", [])
        if not args.offline:
            items = []
            if fh.available:
                items += news.finnhub_items(run.step("finnhub_haber", T, fh.news, T, 10) or [])
            kws = news.keywords(T, s["name"], s.get("haber_anahtar"))
            items += run.step("google_news", T, news.google_news, T, s["name"], 7, kws) or []
            heads = run.step("baslik_arsivi", T, news.update_archive, T, items, ncfg.get("archive_days", 45), kws) or heads
        top = news.top_developments(T, s["name"], heads, ncfg.get("top_n", 3), ncfg.get("lookback_days", 7))
        write_json(DATA / "news" / f"{T}.json", top)
        # --- Büyük hareketler ---
        mcfg = settings.get("moves", {})
        mv = run.step("hareketler", T, moves_mod.update, T, s["benchmarks"], mcfg.get("threshold_pct", 5),
                      recent, heads, fh if not args.offline else None, mcfg.get("lookback_days", 30)) \
            or read_json(DATA / "moves" / f"{T}.json", {}) or {}
        # --- Tez / kural / sinyal ---
        an = read_json(DATA / "analysis" / f"{T}.json", {}) or {}
        wk = latest_weekly_for(T)
        te = run.step("tez", T, thesis_mod.evaluate, T, th, table, an.get("son"), wk) or {}
        write_json(DATA / "thesis" / f"{T}.json", te)
        bench = {b: pstats.get(b, {}) for b in s["benchmarks"]}
        re_ = run.step("kural", T, rules.evaluate, T, rcfg, pstats.get(T, {}), bench, te) or {}
        write_json(DATA / "rules" / f"{T}.json", re_)
        run.step("sinyal", T, signals.detect, T, te, re_, ins, fund.get("kalite"),
                 (fund.get("son_dosya") or {}).get("accn") if is_new or not (read_json(DATA / "state.json", {}) or {}).get(T) else None,
                 pstats.get(T, {}), pstats.get("QQQ", {}))
        # Claude bekleyen iş: yeni bilanço analizi
        latest_accn = (fund.get("son_dosya") or {}).get("accn")
        if latest_accn and not fund.get("xbrl_beklemede") and \
                ((an.get("son") or {}).get("dosya", {}).get("accn") != latest_accn or (an.get("son") or {}).get("hata")):
            pending.append(T)
        kal = fund.get("kalite") or {}
        week_moves = [m for m in mv.get("hareketler", []) if m["tarih"] >= (today() - dt.timedelta(days=7)).isoformat()]
        last = (table.get("ceyrekler") or [{}])[-1]
        metrics = {k: last.get(k) for k in ("etiket", "revenue", "revenue_yoy", "gross_margin", "operating_margin", "net_margin",
                                            "fcf_margin_ttm", "ocf_to_ni_ttm", "diluted_shares_yoy", "sbc_to_revenue_ttm",
                                            "net_cash", "cash_runway_months", "revenue_ttm", "fcf_ttm")}
        spark_m = {k: [x.get(k) for x in (table.get("ceyrekler") or [])[-8:]] for k in ("revenue", "gross_margin", "fcf_margin_ttm")}
        summary["hisseler"][T] = {
            "ticker": T, "ad": s["name"], "benchmarks": s["benchmarks"], "fiyat": pstats.get(T),
            "metrikler": metrics, "metrik_seri": spark_m,
            "hikaye": (an_txt.get("hikaye") or [])[:2],
            "bilanco_bolumleri": [{"id": b["id"], "baslik": b["baslik"], "durum": b["durum"], "manset": b["manset"]}
                                  for b in an_txt.get("bolumler", [])],
            "insider": {"durum": ins.get("durum"), "ozet": (ins.get("anlati") or [None])[0],
                        "satis_90g": ((ins.get("pencereler") or {}).get("90", {}).get("kodlar", {}).get("S") or {}).get("tutar"),
                        "alim_90g": ((ins.get("pencereler") or {}).get("90", {}).get("kodlar", {}).get("P") or {}).get("tutar"),
                        "planli_orani": _plan_pct(ins), "kume": bool(ins.get("kumelenmis_satislar"))},
            "sonraki_bilanco": earn or None,
            "grafik": prices.spark(read_json(DATA / "prices" / f"{T}.json", {}) or {}, 365),
            "tez": {"genel": te.get("genel"), "onay": te.get("onay"),
                    "sutunlar": [{"id": p["id"], "ad": p["ad"], "durum": p["durum"], "deger": p.get("deger"),
                                  "birim": p.get("birim"), "tip": p.get("tip")} for p in te.get("sutunlar", [])],
                    "cikis_tetiklenen": [c["ad"] for c in te.get("cikis", []) if c["durum"] == "tetiklendi"]},
            "gelismeler": (wk or {}).get("gelismeler", [])[:3] if wk and (wk.get("rapor_tarihi") or "") >= (today() - dt.timedelta(days=7)).isoformat() else top["gelismeler"],
            "haber_yontem": (f"Salı raporu ({wk['rapor_tarihi']}) — Claude seçimi" if wk and (wk.get("rapor_tarihi") or "") >= (today() - dt.timedelta(days=7)).isoformat() else top["yontem"]),
            "buyuk_hareketler": [{"tarih": m["tarih"], "hareket": m["hareket"], "on_siniflama": m["on_siniflama"]} for m in week_moves],
            "kural": {k: re_.get(k) for k in ("durum", "mesaj", "tetiklenen", "zirveden_uzaklik", "dusus_kaynagi",
                                              "dusus_kaynagi_aciklama", "kosul_saglaniyor")},
            "insider_uyarilar": ins.get("uyarilar", []),
            "bilanco": {"son_ceyrek": (kal.get("son_ceyrek") or {}).get("etiket"),
                        "kirmizi": sum(1 for b in kal.get("bulgular", []) if b["etiket"] == "kirmizi_bayrak"),
                        "dikkat": sum(1 for b in kal.get("bulgular", []) if b["etiket"] == "dikkat"),
                        "olumlu": sum(1 for b in kal.get("bulgular", []) if b["etiket"] == "olumlu"),
                        "son_dosya": fund.get("son_dosya"), "xbrl_beklemede": fund.get("xbrl_beklemede")},
            "sali_raporu": {"hafta": (wk or {}).get("hafta"), "tarih": (wk or {}).get("rapor_tarihi"),
                            "dca_notu": (wk or {}).get("dca_notu")},
        }

    run.step("karne", None, signals.scorecard, settings.get("signals", {}).get("horizons_days", [30, 90, 180]))
    write_json(DATA / "summary.json", summary)
    run.step("haftalik_derleme", None, weekly.rolling, stocks, summary)
    write_json(DATA / "pending_claude.json", {"guncelleme": now_iso(), "bilanco": pending})
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"claude_filings={','.join(pending)}\n")

    runs = read_json(DATA / "runs.json", []) or []
    runs.insert(0, {"id": run.id, "tur": "offline_yeniden_hesap" if args.offline else "gunluk_python",
                    "baslangic": started, "bitis": now_iso(), "hisseler": sorted(active),
                    "finnhub_aktif": fh.available, "sec_aktif": not sec.sess.disabled,
                    "sec_user_agent_tanimli": bool(os.environ.get("SEC_USER_AGENT")), "sec_istek": sec.sess.count,
                    "claude": None, "bekleyen_bilanco": pending, "adimlar": run.steps, "hatalar": run.errors,
                    "argumanlar": vars(args)})
    write_json(DATA / "runs.json", runs[:150])
    log.info("Bitti. Hatalar: %d. Claude bekleyen bilanço: %s", len(run.errors), pending or "yok")


if __name__ == "__main__":
    main()
