"""Form 4 insider işlemleri: SEC EDGAR'dan XML parse + Finnhub çapraz kontrol.

Kodlar: P açık piyasa alımı, S satış, F vergi kesintisi, M opsiyon kullanımı,
A hibe; diğerleri (G hediye, C dönüşüm, X, D ...) 'diğer' olarak listelenir.
"""
from __future__ import annotations

import datetime as dt
import xml.etree.ElementTree as ET

import sec
from common import DATA, log, read_json, rnd, today, write_json

KOD_ADI = {"P": "Açık piyasa alımı", "S": "Açık piyasa / özel satış", "F": "Vergi kesintisi (rutin)",
           "M": "Opsiyon / RSU kullanımı", "A": "Hibe / ödül", "G": "Hediye", "C": "Dönüşüm",
           "X": "Opsiyon kullanımı (in-the-money)", "D": "İhraççıya elden çıkarma", "J": "Diğer"}


def _t(el, path):
    x = el.find(path)
    if x is None:
        return None
    v = x.find("value")
    txt = (v.text if v is not None else x.text) or ""
    return txt.strip() or None


def _f(el, path):
    t = _t(el, path)
    try:
        return float(t) if t is not None else None
    except ValueError:
        return None


def _truthy(s):
    return (s or "").strip().lower() in ("1", "true", "yes")


def parse_form4(xml: str) -> dict | None:
    try:
        root = ET.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
    except ET.ParseError:
        return None
    owners = []
    for ro in root.findall("reportingOwner"):
        name = _t(ro, "reportingOwnerId/rptOwnerName")
        rel = ro.find("reportingOwnerRelationship")
        roles = []
        title = None
        if rel is not None:
            if _truthy(_t(rel, "isDirector")):
                roles.append("Yönetim kurulu üyesi")
            if _truthy(_t(rel, "isOfficer")):
                title = _t(rel, "officerTitle")
                roles.append(title or "Yönetici")
            if _truthy(_t(rel, "isTenPercentOwner")):
                roles.append("%10+ hissedar")
            if _truthy(_t(rel, "isOther")):
                roles.append(_t(rel, "otherText") or "Diğer")
        owners.append({"ad": name, "unvan": ", ".join(roles) or "—",
                       "yonetici": bool(rel is not None and (_truthy(_t(rel, "isOfficer")) or _truthy(_t(rel, "isDirector"))))})
    footnotes = {fn.get("id"): (fn.text or "") for fn in root.findall(".//footnotes/footnote")}
    aff = root.find("aff10b5One")
    plan_flag = _truthy(aff.text) if aff is not None else None
    txs = []
    for tbl, deriv in (("nonDerivativeTable/nonDerivativeTransaction", False),
                       ("derivativeTable/derivativeTransaction", True)):
        for t in root.findall(tbl):
            code = _t(t, "transactionCoding/transactionCode")
            fn_ids = [f.get("id") for f in t.iter("footnoteId")]
            fn_text = " ".join(footnotes.get(i, "") for i in fn_ids)
            plan = plan_flag if plan_flag else ("10b5-1" in fn_text or "10b5‑1" in fn_text)
            txs.append({
                "turev": deriv,
                "menkul": _t(t, "securityTitle"),
                "tarih": _t(t, "transactionDate"),
                "kod": code,
                "adet": _f(t, "transactionAmounts/transactionShares"),
                "fiyat": _f(t, "transactionAmounts/transactionPricePerShare"),
                "yon": _t(t, "transactionAmounts/transactionAcquiredDisposedCode"),
                "sonrasi": _f(t, "postTransactionAmounts/sharesOwnedFollowingTransaction"),
                "sahiplik": _t(t, "ownershipNature/directOrIndirectOwnership"),
                "plan_10b5_1": bool(plan),
            })
    return {"sahipler": owners, "islemler": txs, "plan_10b5_1_isaret": plan_flag}


def update_cache(ticker: str, cik: int, filings: list[dict], days: int = 200) -> dict:
    path = DATA / "cache" / "form4" / f"{ticker}.json"
    cache = read_json(path, {}) or {}
    cutoff = (today() - dt.timedelta(days=days)).isoformat()
    new = 0
    for f in filings:
        if f.get("form") not in ("4", "4/A") or f.get("filingDate", "") < cutoff:
            continue
        accn = f["accessionNumber"]
        if accn in cache:
            continue
        doc = (f.get("primaryDocument") or "").split("/")[-1]
        if not doc.endswith(".xml"):
            continue
        xml = sec.fetch_text(sec.archive_url(cik, accn, doc), cache_dir="form4")
        if not xml:
            continue
        parsed = parse_form4(xml)
        if parsed is None:
            continue
        parsed.update({"accn": accn, "dosyalama": f.get("filingDate"), "form": f.get("form"),
                       "url": sec.archive_url(cik, accn, f.get("primaryDocument"))})
        cache[accn] = parsed
        new += 1
    # çok eski kayıtları temizle
    cache = {k: v for k, v in cache.items() if v.get("dosyalama", "") >= (today() - dt.timedelta(days=400)).isoformat()}
    write_json(path, cache)
    log.info("%s Form 4: %d yeni, %d toplam", ticker, new, len(cache))
    return cache


def _flatten(cache: dict) -> list[dict]:
    rows = []
    for accn, f in cache.items():
        owner = f["sahipler"][0] if f["sahipler"] else {"ad": "?", "unvan": "—", "yonetici": False}
        names = " / ".join(o["ad"] or "?" for o in f["sahipler"])
        for t in f["islemler"]:
            if not t.get("tarih"):
                continue
            rows.append({**t, "kisi": names, "unvan": owner["unvan"], "yonetici": owner["yonetici"],
                         "accn": accn, "url": f["url"], "dosyalama": f["dosyalama"],
                         "tutar": (t["adet"] or 0) * (t["fiyat"] or 0) if t.get("fiyat") else None})
    rows.sort(key=lambda r: (r["tarih"], r["accn"]), reverse=True)
    return rows


def analyze(ticker: str, cache: dict, cfg: dict, price_stats: dict, finnhub_rows: list | None) -> dict:
    rows = _flatten(cache)
    t0 = today()
    out = {"ticker": ticker, "guncelleme": t0.isoformat(), "pencereler": {}, "uyarilar": [], "kaynak":
           "SEC EDGAR Form 4 (XML)"}
    for w in cfg.get("windows", [90, 180]):
        cutoff = (t0 - dt.timedelta(days=w)).isoformat()
        nd = [r for r in rows if r["tarih"] >= cutoff and not r["turev"]]
        by_code = {}
        for r in nd:
            k = r["kod"] if r["kod"] in ("P", "S", "F", "M", "A") else "diger"
            b = by_code.setdefault(k, {"islem": 0, "adet": 0.0, "tutar": 0.0, "plan_10b5_1_adet": 0.0})
            b["islem"] += 1
            b["adet"] += r["adet"] or 0
            b["tutar"] += r["tutar"] or 0
            if r["plan_10b5_1"]:
                b["plan_10b5_1_adet"] += r["adet"] or 0
        # kişi bazında
        people = {}
        for r in sorted(nd, key=lambda r: r["tarih"]):
            p = people.setdefault(r["kisi"], {"kisi": r["kisi"], "unvan": r["unvan"], "satis_adet": 0.0,
                                              "satis_tutar": 0.0, "alim_adet": 0.0, "vergi_adet": 0.0,
                                              "planli_satis_adet": 0.0, "ilk_satis_oncesi": None,
                                              "son_pozisyon": None, "son_tarih": None})
            if r["sahiplik"] == "D" and r["sonrasi"] is not None:
                p["son_pozisyon"] = r["sonrasi"]
                p["son_tarih"] = r["tarih"]
            if r["kod"] == "S":
                if p["ilk_satis_oncesi"] is None and r["sahiplik"] == "D" and r["sonrasi"] is not None:
                    p["ilk_satis_oncesi"] = r["sonrasi"] + (r["adet"] or 0)
                p["satis_adet"] += r["adet"] or 0
                p["satis_tutar"] += r["tutar"] or 0
                if r["plan_10b5_1"]:
                    p["planli_satis_adet"] += r["adet"] or 0
            elif r["kod"] == "P":
                p["alim_adet"] += r["adet"] or 0
            elif r["kod"] == "F":
                p["vergi_adet"] += r["adet"] or 0
        plist = []
        for p in people.values():
            if p["satis_adet"] and p["ilk_satis_oncesi"]:
                p["satilan_pozisyon_orani"] = rnd(p["satis_adet"] / p["ilk_satis_oncesi"] * 100, 1)
            else:
                p["satilan_pozisyon_orani"] = None
            p["oran_notu"] = "Doğrudan (D) sahiplik bazında: satılan / ilk satıştan önceki pozisyon. Dolaylı (tröst vb.) pozisyonlar hariç."
            plist.append(p)
        plist.sort(key=lambda p: -p["satis_tutar"])
        out["pencereler"][str(w)] = {"kodlar": by_code, "kisiler": plist}

    # Kümelenmiş satış
    cw = cfg.get("cluster_window_days", 14)
    cmin = cfg.get("cluster_min_insiders", 3)
    sales = sorted([r for r in rows if r["kod"] == "S" and not r["turev"] and r["yonetici"]
                    and r["tarih"] >= (t0 - dt.timedelta(days=180)).isoformat()], key=lambda r: r["tarih"])
    clusters = []
    D = dt.date.fromisoformat
    i = 0
    while i < len(sales):
        start = D(sales[i]["tarih"])
        grp = [s for s in sales if start <= D(s["tarih"]) <= start + dt.timedelta(days=cw)]
        names = sorted({s["kisi"] for s in grp})
        if len(names) >= cmin:
            planned = sum(1 for s in grp if s["plan_10b5_1"])
            clusters.append({"baslangic": start.isoformat(), "bitis": max(s["tarih"] for s in grp),
                             "kisiler": names, "islem": len(grp),
                             "tutar": sum(s["tutar"] or 0 for s in grp),
                             "planli_islem_orani": rnd(planned / len(grp) * 100, 0)})
            i += len(grp)
        else:
            i += 1
    out["kumelenmis_satislar"] = clusters
    if clusters:
        c = clusters[-1]
        out["uyarilar"].append({"etiket": "dikkat", "metin":
            f"Kümelenmiş satış: {c['baslangic']}–{c['bitis']} arasında {len(c['kisiler'])} yönetici satış yaptı "
            f"(işlemlerin %{c['planli_islem_orani']:.0f}'i 10b5-1 planlı)."})

    # Açık piyasa alımı yokken fiyat yükselişi
    p180 = out["pencereler"].get("180", {}).get("kodlar", {})
    buys = p180.get("P", {}).get("islem", 0)
    rally = price_stats.get("degisim_6a")
    thr = cfg.get("rally_without_buys_pct", 30)
    if buys == 0:
        msg = "Son 180 günde yönetimden hiç açık piyasa alımı (P) yok."
        if rally is not None and rally >= thr:
            out["uyarilar"].append({"etiket": "dikkat", "metin": msg + f" Aynı dönemde fiyat %{rally} yükseldi."})
        else:
            out["uyarilar"].append({"etiket": "bilgi", "metin": msg})
    else:
        out["uyarilar"].append({"etiket": "olumlu", "metin": f"Son 180 günde {buys} açık piyasa alımı (P) var."})

    out["son_islemler"] = [r for r in rows if r["tarih"] >= (t0 - dt.timedelta(days=180)).isoformat()][:150]

    # Finnhub çapraz kontrol (90 gün, kod bazında adet)
    if finnhub_rows is not None:
        cutoff = (t0 - dt.timedelta(days=90)).isoformat()
        fh = {}
        for r in finnhub_rows:
            if (r.get("transactionDate") or "") < cutoff:
                continue
            k = r.get("transactionCode") or "?"
            b = fh.setdefault(k, {"islem": 0, "adet": 0.0})
            b["islem"] += 1
            b["adet"] += abs(r.get("change") or 0)
        ed = out["pencereler"].get("90", {}).get("kodlar", {})
        cmp = []
        for k in sorted(set(fh) | set(ed)):
            e = ed.get(k, {"islem": 0, "adet": 0})
            f = fh.get(k, {"islem": 0, "adet": 0})
            diff = abs((e.get("adet") or 0) - (f.get("adet") or 0))
            base = max(e.get("adet") or 0, f.get("adet") or 0, 1)
            cmp.append({"kod": k, "edgar_islem": e.get("islem", 0), "edgar_adet": e.get("adet", 0),
                        "finnhub_islem": f["islem"], "finnhub_adet": f["adet"],
                        "uyumlu": diff / base < 0.05})
        out["capraz_kontrol"] = {"kaynak": "Finnhub /stock/insider-transactions", "pencere_gun": 90, "satirlar": cmp}
    else:
        out["capraz_kontrol"] = None
    return out
