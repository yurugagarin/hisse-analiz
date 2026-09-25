"""Kural bazlı alım takibi: zirveden düşüş kademeleri + benchmark karşılaştırması.

Otomatik işlem YOK; sadece bilgilendirme.
"""
from __future__ import annotations

from common import now_iso, rnd


def evaluate(ticker: str, rcfg: dict, pstats: dict, bench: dict[str, dict], thesis_eval: dict) -> dict:
    cfg = rcfg.get(ticker) or rcfg.get("varsayilan") or {}
    dd = pstats.get("zirveden_uzaklik")
    out = {"ticker": ticker, "onay": cfg.get("onay", "taslak"), "kosul": cfg.get("kosul", "tez_saglam"),
           "zirveden_uzaklik": dd, "kademeler": [], "benchmark": [], "guncelleme": now_iso(),
           "not": "Otomatik işlem yok. Bu bölüm önceden yazdığın kuralları hatırlatır."}
    if dd is None:
        out["durum"] = "veri_yok"
        return out
    tez = thesis_eval.get("genel", "veri_yok")
    if out["kosul"] == "tez_saglam":
        kosul_ok = None if tez == "veri_yok" else tez != "kirmizi"  # None: tez verisi yok, koşul doğrulanamaz
    else:
        kosul_ok = True
    triggered = []
    for k in sorted(cfg.get("kademeler", []), key=lambda x: x["dusus"]):
        hit = dd <= -abs(k["dusus"])
        out["kademeler"].append({"dusus": k["dusus"], "not": k.get("not", ""), "tetiklendi": hit})
        if hit:
            triggered.append(k)
    # Benchmark karşılaştırması
    thr = cfg.get("sirkete_ozel_esik", 10)
    rel = []
    for sym, s in bench.items():
        bdd = s.get("zirveden_uzaklik")
        row = {"sembol": sym, "zirveden_uzaklik": bdd, "degisim_1a": s.get("degisim_1a"),
               "degisim_3a": s.get("degisim_3a"), "fark_puan": rnd(dd - bdd) if bdd is not None else None}
        rel.append(row)
    out["benchmark"] = rel
    diffs = [r["fark_puan"] for r in rel if r["fark_puan"] is not None]
    if diffs:
        worst = max(diffs)  # en az negatif fark: tüm benchmark'lardan kötü mü?
        if all(d <= -thr for d in diffs):
            kaynak = "sirkete_ozel"
            acik = f"Hisse, tüm benchmark'lardan en az {thr} puan daha fazla düşmüş: düşüş ağırlıkla şirkete özel görünüyor."
        elif any(d <= -thr for d in diffs):
            kaynak = "karma"
            acik = "Hisse bazı benchmark'lardan belirgin kötü, bazılarına yakın: sektör + şirkete özel karma."
        else:
            kaynak = "piyasa_sektor"
            acik = "Hissenin düşüşü benchmark'larla benzer: ağırlıkla piyasa/sektör kaynaklı."
        out["dusus_kaynagi"] = kaynak
        out["dusus_kaynagi_aciklama"] = acik
        out["en_iyi_fark"] = worst
    out["tetiklenen"] = triggered[-1] if triggered else None
    out["tez_durumu"] = tez
    out["kosul_saglaniyor"] = kosul_ok
    if triggered:
        out["durum"] = {True: "tetiklendi_kosul_ok", False: "tetiklendi_kosul_yok", None: "tetiklendi_kosul_bilinmiyor"}[kosul_ok]
        out["mesaj"] = (f"Zirveden %{dd} düşüş: -%{triggered[-1]['dusus']} kademesi tetiklendi. "
                        + {True: "Tez sağlam koşulu sağlanıyor.", False: "ANCAK tez durumu KIRMIZI — koşul sağlanmıyor.",
                           None: "Tez verisi yok — 'tez sağlam' koşulu doğrulanamıyor."}[kosul_ok]
                        + f" Önceden yazdığın not: {triggered[-1].get('not','')}")
    else:
        nxt = next((k for k in out["kademeler"] if not k["tetiklendi"]), None)
        out["durum"] = "tetiklenmedi"
        out["mesaj"] = f"Zirveden %{dd}. " + (f"Sonraki kademe: -%{nxt['dusus']}." if nxt else "")
    return out
