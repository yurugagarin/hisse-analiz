"""Sentetik companyfacts ile XBRL çeyrekleme mantığının testi."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import xbrl


def fact(start, end, val, form, fy, fp, filed, accn="0000-00-1"):
    d = {"end": end, "val": val, "form": form, "fy": fy, "fp": fp, "filed": filed, "accn": accn}
    if start:
        d["start"] = start
    return d


def make_cf():
    rev = []
    ocf = []
    # FY2024: Q1..Q3 10-Q, FY 10-K; FY2025 aynı. Takvim yılı.
    qs = {2024: [100, 110, 120, 130], 2025: [150, 160, 170, 180]}
    for fy, vals in qs.items():
        ends = [f"{fy}-03-31", f"{fy}-06-30", f"{fy}-09-30", f"{fy}-12-31"]
        starts = [f"{fy}-01-01", f"{fy}-04-01", f"{fy}-07-01", f"{fy}-10-01"]
        for i in range(3):
            rev.append(fact(starts[i], ends[i], vals[i], "10-Q", fy, f"Q{i+1}", f"{fy}-{3*i+5:02d}-01"))
        rev.append(fact(f"{fy}-01-01", ends[3], sum(vals), "10-K", fy, "FY", f"{fy+1}-02-15"))
        # nakit akışı YTD
        cum = 0
        for i in range(3):
            cum += vals[i] // 2
            ocf.append(fact(f"{fy}-01-01", ends[i], cum, "10-Q", fy, f"Q{i+1}", f"{fy}-{3*i+5:02d}-01"))
        ocf.append(fact(f"{fy}-01-01", ends[3], cum + vals[3] // 2, "10-K", fy, "FY", f"{fy+1}-02-15"))
    shares = [fact(s, e, 1000 + i, "10-Q", 2025, "Q1", "2025-05-01") for i, (s, e) in enumerate([
        ("2024-10-01", "2024-12-31"), ("2025-10-01", "2025-12-31")])]
    return {"facts": {"us-gaap": {
        "Revenues": {"label": "Revenues", "units": {"USD": rev}},
        "NetCashProvidedByUsedInOperatingActivities": {"label": "OCF", "units": {"USD": ocf}},
        "NetIncomeLoss": {"label": "NI", "units": {"USD": [dict(x, val=x["val"] // 4) for x in rev]}},
        "WeightedAverageNumberOfDilutedSharesOutstanding": {"label": "sh", "units": {"shares": shares}},
        "AccountsReceivableNetCurrent": {"label": "AR", "units": {"USD": [
            fact(None, "2024-12-31", 50, "10-K", 2024, "FY", "2025-02-15"),
            fact(None, "2025-12-31", 90, "10-K", 2025, "FY", "2026-02-15")]}},
    }}}


def test_quarters():
    t = xbrl.build_table(make_cf())
    rows = {r["donem_sonu"]: r for r in t["ceyrekler"]}
    q4 = rows["2025-12-31"]
    assert q4["revenue"] == 180, q4["revenue"]
    assert q4["etiket"] == "FY2025 Q4", q4["etiket"]
    assert q4["ocf"] == 90
    assert q4["revenue_ttm"] == 660
    assert q4["revenue_yoy"] == round((180 - 130) / 130 * 100, 2)
    assert q4["ar_yoy"] == 80.0
    assert q4["receivables_vs_revenue_gap"] == round(80.0 - q4["revenue_yoy"], 2)
    assert rows["2025-06-30"]["ocf"] == 80
    assert q4["_kaynak"]["revenue"]["turetilmis"] is True
    assert q4["ocf_to_ni_ttm"] == round(330 / 165, 2)
    print("ok", q4["etiket"], q4["revenue_yoy"], q4["dso"])


if __name__ == "__main__":
    test_quarters()
