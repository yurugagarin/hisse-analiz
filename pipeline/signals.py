"""Sinyal kaydı (data/signals.jsonl) ve sinyal karnesi.

Her önemli sinyal, üretildiği gün ve o günkü kapanış fiyatıyla kaydedilir.
Sonra 30/90/180 günlük mutlak ve QQQ'ya göre göreli performans hesaplanır.
'İsabet' = göreli getiri, sinyalin beklenen yönüyle aynı işaretli mi.
"""
from __future__ import annotations

import datetime as dt
import hashlib

import prices
from common import DATA, append_jsonl, now_iso, read_json, read_jsonl, rnd, today, write_json

TUR = {
    "tez_bozulma": ("Tez genel durumu KIRMIZI'ya döndü", "olumsuz"),
    "tez_iyilesme": ("Tez genel durumu kırmızıdan çıktı", "olumlu"),
    "sutun_kirmizi": ("Bir tez sütunu KIRMIZI'ya döndü", "olumsuz"),
    "cikis_kriteri": ("Önceden yazılmış çıkış kriteri tetiklendi", "olumsuz"),
    "kural_kademe_tez_saglam": ("Düşüş kademesi tetiklendi, tez sağlam", "olumlu"),
    "kural_kademe_tez_bozuk": ("Düşüş kademesi tetiklendi, tez kırmızı", "olumsuz"),
    "kural_kademe_tez_bilinmiyor": ("Düşüş kademesi tetiklendi, tez verisi yok", "notr"),
    "insider_alim": ("Yönetimden açık piyasa alımı (P)", "olumlu"),
    "insider_kume_satis": ("Kümelenmiş yönetici satışı", "olumsuz"),
    "bilanco_kirmizi_bayrak": ("Yeni bilançoda kırmızı bayrak", "olumsuz"),
}


def _sid(*parts) -> str:
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:12]


def detect(ticker: str, thesis_eval: dict, rule_eval: dict, insider: dict, quality: dict,
           filing_accn: str | None, pstats: dict, qqq_stats: dict) -> list[dict]:
    state_path = DATA / "state.json"
    state = read_json(state_path, {}) or {}
    st = state.get(ticker, {})
    first = not st
    ev = []

    def emit(tur, aciklama, key):
        ad, yon = TUR[tur]
        ev.append({"id": _sid(ticker, tur, key), "tarih": today().isoformat(), "ticker": ticker, "tur": tur,
                   "tur_adi": ad, "yon": yon, "aciklama": aciklama, "fiyat": pstats.get("fiyat"),
                   "fiyat_tarihi": pstats.get("tarih"), "qqq": qqq_stats.get("fiyat"),
                   "baslangic_kaydi": first, "kayit_zamani": now_iso()})

    g = thesis_eval.get("genel")
    pg = st.get("genel")
    if g == "kirmizi" and pg != "kirmizi":
        reds = [p["ad"] for p in thesis_eval.get("sutunlar", []) if p["durum"] == "kirmizi"]
        emit("tez_bozulma", "Kırmızı sütunlar: " + (", ".join(reds) or "çıkış kriteri"), f"{today()}")
    elif pg == "kirmizi" and g in ("sari", "yesil"):
        emit("tez_iyilesme", f"Genel durum: {g}", f"{today()}")
    ps = st.get("sutun", {})
    for p in thesis_eval.get("sutunlar", []):
        if p["durum"] == "kirmizi" and ps.get(p["id"]) != "kirmizi":
            from anlati import _n
            v = p.get("deger")
            vs = "" if v is None else (f"%{_n(v, 1)}" if p.get("birim") == "%" else f"{_n(v, 2)}{'x' if p.get('birim') == 'x' else ' ' + (p.get('birim') or '')}")
            emit("sutun_kirmizi", f"{p['ad']}: {vs}".strip().rstrip(":"), f"{p['id']}{today()}")
    pc = set(st.get("cikis", []))
    for c in thesis_eval.get("cikis", []):
        if c["durum"] == "tetiklendi" and c["id"] not in pc:
            emit("cikis_kriteri", c["ad"], f"{c['id']}{today()}")
    lvl = max([k["dusus"] for k in rule_eval.get("kademeler", []) if k["tetiklendi"]], default=0)
    plvl = st.get("kademe", 0)
    if lvl > plvl:
        k = rule_eval.get("kosul_saglaniyor")
        tur = {True: "kural_kademe_tez_saglam", False: "kural_kademe_tez_bozuk", None: "kural_kademe_tez_bilinmiyor"}[k]
        from anlati import pc
        emit(tur, f"Zirveden {pc(rule_eval.get('zirveden_uzaklik'))}, −%{lvl} kademesi. "
                  f"{rule_eval.get('dusus_kaynagi_aciklama', '')}", f"{lvl}{today()}")
    # insider P alımları
    seen_p = set(st.get("insider_p", []))
    new_p = [r for r in insider.get("son_islemler", []) if r["kod"] == "P" and not r["turev"] and r["accn"] not in seen_p
             and r["tarih"] >= (today() - dt.timedelta(days=30)).isoformat()]
    if new_p:
        names = sorted({r["kisi"] for r in new_p})
        tot = sum(r.get("tutar") or 0 for r in new_p)
        emit("insider_alim", f"{', '.join(names)} — toplam ≈ ${tot:,.0f}", ",".join(sorted({r['accn'] for r in new_p})))
    seen_c = set(st.get("kume", []))
    for c in insider.get("kumelenmis_satislar", []):
        if c["baslangic"] not in seen_c and c["bitis"] >= (today() - dt.timedelta(days=30)).isoformat():
            emit("insider_kume_satis", f"{c['baslangic']}–{c['bitis']}: {', '.join(c['kisiler'])}", c["baslangic"])
    if filing_accn and filing_accn != st.get("bayrak_accn"):
        reds = [b["baslik"] for b in (quality or {}).get("bulgular", []) if b["etiket"] == "kirmizi_bayrak"]
        if reds:
            emit("bilanco_kirmizi_bayrak", "; ".join(reds), filing_accn)

    # durumu güncelle
    state[ticker] = {
        "genel": g, "sutun": {p["id"]: p["durum"] for p in thesis_eval.get("sutunlar", [])},
        "cikis": [c["id"] for c in thesis_eval.get("cikis", []) if c["durum"] == "tetiklendi"],
        "kademe": lvl,
        "insider_p": sorted(seen_p | {r["accn"] for r in insider.get("son_islemler", []) if r["kod"] == "P"})[-200:],
        "kume": sorted(seen_c | {c["baslangic"] for c in insider.get("kumelenmis_satislar", [])})[-50:],
        "bayrak_accn": filing_accn or st.get("bayrak_accn"),
    }
    write_json(state_path, state)
    existing = {s["id"] for s in read_jsonl(DATA / "signals.jsonl")}
    fresh = [e for e in ev if e["id"] not in existing]
    for e in fresh:
        append_jsonl(DATA / "signals.jsonl", e)
    return fresh


def scorecard(horizons: list[int]) -> dict:
    sigs = read_jsonl(DATA / "signals.jsonl")
    cache = {}

    def P(sym):
        if sym not in cache:
            cache[sym] = read_json(DATA / "prices" / f"{sym}.json", {}) or {}
        return cache[sym]

    rows = []
    agg: dict = {}
    for s in sigs:
        p = P(s["ticker"])
        q = P("QQQ")
        kap = p.get("kapanislar") or []
        last_d = kap[-1][0] if kap else None
        base = s.get("fiyat")
        qbase = s.get("qqq")
        if base is None:
            b = prices.close_on_or_before(p, s["tarih"])
            base = b[1] if b else None
        r = {**s, "sonuclar": {}}
        for h in horizons:
            tgt = (dt.date.fromisoformat(s["tarih"]) + dt.timedelta(days=h)).isoformat()
            if not last_d or last_d < tgt or base is None:
                r["sonuclar"][str(h)] = None
                continue
            c = prices.close_on_or_after(p, tgt)
            qc = prices.close_on_or_after(q, tgt)
            ret = (c[1] / base - 1) * 100 if c else None
            qret = (qc[1] / qbase - 1) * 100 if (qc and qbase) else None
            rel = ret - qret if (ret is not None and qret is not None) else None
            hit = None
            if rel is not None and s["yon"] in ("olumlu", "olumsuz"):
                hit = rel > 0 if s["yon"] == "olumlu" else rel < 0
            r["sonuclar"][str(h)] = {"getiri": rnd(ret), "qqq": rnd(qret), "goreli": rnd(rel), "isabet": hit}
            a = agg.setdefault(s["tur"], {}).setdefault(str(h), {"n": 0, "isabet": 0, "goreli_toplam": 0.0})
            if hit is not None:
                a["n"] += 1
                a["isabet"] += int(hit)
                a["goreli_toplam"] += rel
        rows.append(r)
    ozet = []
    for tur, (ad, yon) in TUR.items():
        hs = agg.get(tur, {})
        ozet.append({"tur": tur, "ad": ad, "beklenen_yon": yon,
                     "adet": sum(1 for s in sigs if s["tur"] == tur),
                     "ufuklar": {str(h): ({"n": hs[str(h)]["n"],
                                           "isabet_orani": rnd(hs[str(h)]["isabet"] / hs[str(h)]["n"] * 100, 0) if hs[str(h)]["n"] else None,
                                           "ort_goreli": rnd(hs[str(h)]["goreli_toplam"] / hs[str(h)]["n"]) if hs[str(h)]["n"] else None}
                                          if str(h) in hs else {"n": 0, "isabet_orani": None, "ort_goreli": None})
                                 for h in horizons}})
    out = {"guncelleme": now_iso(), "ufuklar": horizons, "ozet": ozet, "sinyaller": list(reversed(rows)),
           "not": "İsabet: sinyal sonrası hissenin QQQ'ya göre göreli getirisinin beklenen yönde olması. "
                  "Az sayıda sinyalle istatistik anlamsızdır."}
    write_json(DATA / "scorecard.json", out)
    return out
