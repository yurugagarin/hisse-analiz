"""SEC companyfacts (XBRL) -> çeyreklik seri ve metrikler.

Kural: burada üretilen HER sayı SEC'in companyfacts API'sinden gelir. Türetilen
değerler (ör. Q4 = yıllık − 9 aylık, nakit akışı çeyreği = YTD farkı) açıkça
"türetilmiş" diye işaretlenir. Hiçbir değer tahmin edilmez; bulunamazsa None.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from common import pct, rnd, safe_div

D = dt.date.fromisoformat

# ---------------------------------------------------------------------------
# Kavram (concept) haritası: öncelik sırasıyla. (taksonomi, concept)
# 'tablo' alanı sitedeki "ilgili tablo satırı" referansı içindir.
# ---------------------------------------------------------------------------
CONCEPTS: dict[str, dict] = {
    "revenue": {"tablo": "Gelir tablosu", "c": [
        "Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"]},
    "cogs": {"tablo": "Gelir tablosu", "c": [
        "CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfServices"]},
    "gross_profit": {"tablo": "Gelir tablosu", "c": ["GrossProfit"]},
    "rd": {"tablo": "Gelir tablosu", "c": ["ResearchAndDevelopmentExpense",
                                           "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"]},
    "operating_income": {"tablo": "Gelir tablosu", "c": ["OperatingIncomeLoss"]},
    "restructuring": {"tablo": "Gelir tablosu / dipnot", "c": [
        "RestructuringCharges", "RestructuringSettlementAndImpairmentProvisions"]},
    "impairment": {"tablo": "Gelir tablosu / nakit akış", "c": [
        "AssetImpairmentCharges", "GoodwillImpairmentLoss", "ImpairmentOfLongLivedAssetsHeldForUse",
        "ImpairmentOfIntangibleAssetsExcludingGoodwill"]},
    "interest_income": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": [
        "InvestmentIncomeInterest", "InvestmentIncomeInterestAndDividend", "InterestIncomeOther",
        "InterestAndOtherIncome", "InterestIncomeOperating"]},
    "interest_expense": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": [
        "InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"]},
    "warrant_fv": {"tablo": "Gelir tablosu (faaliyet dışı)", "sign": -1, "c": [
        "FairValueAdjustmentOfWarrants"]},  # pozitif = gider -> köprüde eksi
    "derivative_gl": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": [
        "DerivativeGainLossOnDerivativeNet", "DerivativeInstrumentsNotDesignatedAsHedgingInstrumentsGainLossNet",
        "GainLossOnDerivativeInstrumentsNetPretax"]},
    "investment_gl": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": [
        "GainLossOnInvestments", "EquitySecuritiesFvNiGainLoss", "GainLossOnSaleOfInvestments",
        "MarketableSecuritiesRealizedGainLossExcludingOtherThanTemporaryImpairments"]},
    "debt_extinguishment": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": [
        "GainsLossesOnExtinguishmentOfDebt"]},
    "nonoperating_total": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": ["NonoperatingIncomeExpense"]},
    "other_nonoperating": {"tablo": "Gelir tablosu (faaliyet dışı)", "c": ["OtherNonoperatingIncomeExpense"]},
    "pretax": {"tablo": "Gelir tablosu", "c": [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic"]},
    "tax": {"tablo": "Gelir tablosu", "c": ["IncomeTaxExpenseBenefit"]},
    "net_income": {"tablo": "Gelir tablosu", "c": ["NetIncomeLoss", "ProfitLoss",
                                                   "NetIncomeLossAvailableToCommonStockholdersBasic"]},
    "ocf": {"tablo": "Nakit akış tablosu", "c": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]},
    "capex": {"tablo": "Nakit akış tablosu", "c": [
        "PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets",
        "PaymentsForCapitalImprovements", "PaymentsToAcquireMachineryAndEquipment",
        "PaymentsToAcquireOtherPropertyPlantAndEquipment"]},
    "sbc": {"tablo": "Nakit akış tablosu", "c": ["ShareBasedCompensation",
                                                  "AllocatedShareBasedCompensationExpense"]},
    "acquisitions": {"tablo": "Nakit akış tablosu", "c": [
        "PaymentsToAcquireBusinessesNetOfCashAcquired", "PaymentsToAcquireBusinessesGross"]},
    "buybacks": {"tablo": "Nakit akış tablosu", "c": ["PaymentsForRepurchaseOfCommonStock"]},
    "equity_issued": {"tablo": "Nakit akış tablosu", "c": [
        "ProceedsFromIssuanceOfCommonStock", "ProceedsFromIssuanceOrSaleOfEquity",
        "ProceedsFromStockOptionsExercised"]},
    "da": {"tablo": "Nakit akış tablosu", "c": [
        "DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet",
        "Depreciation"]},
    "sga": {"tablo": "Gelir tablosu", "c": ["SellingGeneralAndAdministrativeExpense", "GeneralAndAdministrativeExpense"]},
    "dividends": {"tablo": "Nakit akış tablosu", "c": ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"]},
    "debt_issued": {"tablo": "Nakit akış tablosu", "c": [
        "ProceedsFromIssuanceOfLongTermDebt", "ProceedsFromConvertibleDebt", "ProceedsFromIssuanceOfDebt"]},
    "debt_repaid": {"tablo": "Nakit akış tablosu", "c": ["RepaymentsOfLongTermDebt", "RepaymentsOfDebt",
                                                        "RepaymentsOfConvertibleDebt"]},
    "eps_diluted": {"tablo": "Gelir tablosu (hisse başına kâr)", "unit": "USD/shares", "additive": False,
                    "c": ["EarningsPerShareDiluted"]},
    "diluted_shares": {"tablo": "Gelir tablosu (hisse başına kâr)", "unit": "shares", "additive": False, "c": [
        "WeightedAverageNumberOfDilutedSharesOutstanding"]},
    "acquiree_revenue": {"tablo": "Dipnot: işletme birleşmeleri", "c": [
        "BusinessCombinationProFormaInformationRevenueOfAcquireeSinceAcquisitionDateActual"]},
    # --- Bilanço (anlık) ---
    "ar": {"tablo": "Bilanço", "instant": True, "c": [
        "AccountsReceivableNetCurrent", "ReceivablesNetCurrent", "AccountsReceivableNet"]},
    "inventory": {"tablo": "Bilanço", "instant": True, "c": ["InventoryNet", "InventoryGross"]},
    "deferred_rev_current": {"tablo": "Bilanço", "instant": True, "c": [
        "ContractWithCustomerLiabilityCurrent", "DeferredRevenueCurrent"]},
    "deferred_rev_noncurrent": {"tablo": "Bilanço", "instant": True, "c": [
        "ContractWithCustomerLiabilityNoncurrent", "DeferredRevenueNoncurrent"]},
    "rpo": {"tablo": "Dipnot: gelir / kalan edim yükümlülükleri", "instant": True, "c": [
        "RevenueRemainingPerformanceObligation"]},
    "cash": {"tablo": "Bilanço", "instant": True, "c": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]},
    "st_investments": {"tablo": "Bilanço", "instant": True, "c": [
        "MarketableSecuritiesCurrent", "ShortTermInvestments", "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
        "DebtSecuritiesCurrent", "AvailableForSaleSecuritiesCurrent", "OtherShortTermInvestments"]},
    "cash_and_st": {"tablo": "Bilanço", "instant": True, "c": ["CashCashEquivalentsAndShortTermInvestments"]},
    "total_debt": {"tablo": "Bilanço", "instant": True, "c": ["LongTermDebt"]},
    "convertible": {"tablo": "Bilanço", "instant": True, "c": [
        "ConvertibleNotesPayable", "ConvertibleLongTermNotesPayable", "ConvertibleNotesPayableNoncurrent"]},
    "st_borrowings": {"tablo": "Bilanço", "instant": True, "c": ["ShortTermBorrowings", "CommercialPaper"]},
    "eq_inv_fv": {"tablo": "Bilanço (dipnot: yatırımlar)", "instant": True, "c": ["EquitySecuritiesFvNi"]},
    "eq_inv_other": {"tablo": "Bilanço (dipnot: yatırımlar)", "instant": True, "c": [
        "EquitySecuritiesWithoutReadilyDeterminableFairValueAmount", "EquityMethodInvestments"]},
    "goodwill": {"tablo": "Bilanço", "instant": True, "c": ["Goodwill"]},
    "total_assets": {"tablo": "Bilanço", "instant": True, "c": ["Assets"]},
    "current_assets": {"tablo": "Bilanço", "instant": True, "c": ["AssetsCurrent"]},
    "total_liabilities": {"tablo": "Bilanço", "instant": True, "c": ["Liabilities"]},
    "current_liabilities": {"tablo": "Bilanço", "instant": True, "c": ["LiabilitiesCurrent"]},
    "liab_and_equity": {"tablo": "Bilanço", "instant": True, "c": ["LiabilitiesAndStockholdersEquity"]},
    "equity": {"tablo": "Bilanço", "instant": True, "c": [
        "StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]},
    "ppe": {"tablo": "Bilanço", "instant": True, "c": ["PropertyPlantAndEquipmentNet",
                                                      "PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization"]},
    "ap": {"tablo": "Bilanço", "instant": True, "c": ["AccountsPayableCurrent", "AccountsPayableTradeCurrent"]},
    "intangibles": {"tablo": "Bilanço", "instant": True, "c": [
        "IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"]},
    "lt_investments": {"tablo": "Bilanço", "instant": True, "c": [
        "LongTermInvestments", "MarketableSecuritiesNoncurrent", "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent",
        "OtherLongTermInvestments"]},
    "debt_current": {"tablo": "Bilanço", "instant": True, "c": [
        "LongTermDebtCurrent", "DebtCurrent", "ConvertibleNotesPayableCurrent"]},
    "debt_noncurrent": {"tablo": "Bilanço", "instant": True, "c": ["LongTermDebtNoncurrent"]},
    "lease_liab": {"tablo": "Bilanço", "instant": True, "c": [
        "OperatingLeaseLiability", "OperatingLeaseLiabilityNoncurrent"]},
    "warrant_liability": {"tablo": "Bilanço", "instant": True, "c": [
        "DerivativeLiabilitiesNoncurrent", "DerivativeLiabilities", "WarrantLiabilities"]},
}


@dataclass
class Point:
    start: str | None
    end: str
    val: float
    accn: str
    form: str
    filed: str
    fy: int | None
    fp: str | None
    concept: str
    derived: bool = False
    note: str = ""


@dataclass
class Series:
    key: str
    points: dict[str, Point] = field(default_factory=dict)  # end -> Point (çeyreklik veya anlık)
    annual: dict[str, Point] = field(default_factory=dict)  # end -> yıllık Point
    concepts_used: list[str] = field(default_factory=list)
    label: dict[str, str] = field(default_factory=dict)


def _days(a: str, b: str) -> int:
    return (D(b) - D(a)).days


def _facts_for(cf: dict, concept: str, unit: str) -> tuple[list[dict], str]:
    for tax in ("us-gaap", "ifrs-full", "dei"):
        node = cf.get("facts", {}).get(tax, {}).get(concept)
        if node and unit in node.get("units", {}):
            return node["units"][unit], node.get("label", concept)
    return [], concept


def _dedup(entries: list[dict], instant: bool) -> dict[tuple, dict]:
    """Aynı dönem için en son dosyalanan değeri (yeniden düzenlenmiş) tut."""
    out: dict[tuple, dict] = {}
    for e in entries:
        if e.get("form") not in ("10-Q", "10-K", "10-Q/A", "10-K/A", "10-KT", "20-F", "40-F"):
            continue
        k = (e["end"],) if instant else (e.get("start"), e["end"])
        if instant and e.get("start"):
            continue
        if not instant and not e.get("start"):
            continue
        prev = out.get(k)
        if prev is None or e.get("filed", "") > prev.get("filed", ""):
            out[k] = e
    return out


def _mk(e: dict, concept: str, derived=False, start=None, val=None, note="") -> Point:
    return Point(start=start if start is not None else e.get("start"), end=e["end"],
                 val=float(val if val is not None else e["val"]), accn=e.get("accn", ""),
                 form=e.get("form", ""), filed=e.get("filed", ""), fy=e.get("fy"), fp=e.get("fp"),
                 concept=concept, derived=derived, note=note)


def _quarterize(dd: dict[tuple, dict], concept: str | None = None, additive: bool = True
                ) -> tuple[dict[str, Point], dict[str, Point]]:
    """dd değerleri '_concept' anahtarı taşıyabilir (kavramlar arası birleştirilmiş seri)."""
    q: dict[str, Point] = {}
    annual: dict[str, Point] = {}
    for (s, e), ent in dd.items():
        d = _days(s, e)
        if 75 <= d <= 105:
            q[e] = _mk(ent, ent.get("_concept", concept))
        elif 350 <= d <= 380:
            annual[e] = _mk(ent, ent.get("_concept", concept))
    if not additive:
        # Ağırlıklı ortalama hisse sayısı gibi değerler toplanamaz: YTD farkından türetilmez
        return q, annual
    # YTD farkından çeyrek türet (nakit akışı 6/9/12 aylık; Q4 = yıl − 9 ay)
    by_start: dict[str, list[tuple[str, dict]]] = {}
    for (s, e), ent in dd.items():
        by_start.setdefault(s, []).append((e, ent))
    for s, items in by_start.items():
        items.sort()
        for i in range(len(items)):
            e_long, ent_long = items[i]
            if e_long in q:
                continue
            for j in range(i):
                e_short, ent_short = items[j]
                gap = _days(e_short, e_long)
                if 75 <= gap <= 105 and _days(s, e_short) >= 75:
                    qs = (D(e_short) + dt.timedelta(days=1)).isoformat()
                    q[e_long] = _mk(ent_long, ent_long.get("_concept", concept), derived=True, start=qs,
                                    val=float(ent_long["val"]) - float(ent_short["val"]),
                                    note=f"türetilmiş: {s}→{e_long} ({ent_long['form']}) − {s}→{e_short}"
                                    + (f" · UYARI: farklı XBRL kavramları ({ent_long.get('_concept')} − {ent_short.get('_concept')}), SEC belgesinden kontrol et"
                                       if ent_long.get("_concept") != ent_short.get("_concept") else ""))
                    break
    # Q4 = yıllık − (Q1+Q2+Q3) (9 aylık YTD raporlanmamışsa)
    for e, pa in annual.items():
        if e in q:
            continue
        inside = sorted((qe, qp) for qe, qp in q.items()
                        if qp.start and qp.start >= pa.start and qe < e and not qp.derived)
        if len(inside) == 3 and 75 <= _days(inside[-1][0], e) <= 105:
            qs = (D(inside[-1][0]) + dt.timedelta(days=1)).isoformat()
            q[e] = Point(start=qs, end=e, val=pa.val - sum(p.val for _, p in inside), accn=pa.accn,
                         form=pa.form, filed=pa.filed, fy=pa.fy, fp=pa.fp, concept=pa.concept, derived=True,
                         note=f"türetilmiş: yıllık ({pa.form}) − 3 çeyrek toplamı")
    return q, annual


def build_series(cf: dict, key: str) -> Series:
    """Kavramları (en güncel veriyi taşıyan önce) dönem bazında birleştirir, SONRA çeyrekler.
    Böylece şirket bir kavramdan diğerine geçtiğinde de YTD farkı hesaplanabilir."""
    spec = CONCEPTS[key]
    unit = spec.get("unit", "USD")
    instant = spec.get("instant", False)
    per_concept = []
    for c in spec["c"]:
        entries, label = _facts_for(cf, c, unit)
        if not entries:
            continue
        dd = _dedup(entries, instant)
        if dd:
            latest = max(k[-1] for k in dd)
            per_concept.append((latest, -spec["c"].index(c), c, label, dd))
    per_concept.sort(reverse=True)
    s = Series(key=key)
    merged: dict[tuple, dict] = {}
    for _, _, c, label, dd in per_concept:
        used = False
        for k, ent in dd.items():
            if k not in merged:
                merged[k] = {**ent, "_concept": c}
                used = True
        if used:
            s.concepts_used.append(c)
            s.label[c] = label
    if instant:
        s.points = {k[0]: _mk(v, v["_concept"]) for k, v in merged.items()}
    else:
        s.points, s.annual = _quarterize(merged, None, spec.get("additive", True))
    if key == "diluted_shares":
        _normalize_splits(s)
    return s


def _normalize_splits(s: Series) -> None:
    """Hisse bölünmesi: ardışık çeyrekler arasında ~tam sayı katı sıçrama varsa eski değerleri ölçekle."""
    ends = sorted(s.points)
    factor = 1.0
    for i in range(len(ends) - 1, 0, -1):
        cur, prev = s.points[ends[i]], s.points[ends[i - 1]]
        if prev.val and cur.val:
            r = (cur.val / factor) / prev.val if factor else 0
            for k in (2, 3, 4, 5, 8, 10, 15, 20, 25, 40, 50):
                for ratio, mult in ((k, k), (1 / k, 1 / k)):
                    if abs(r / ratio - 1) < 0.06:
                        factor *= mult
                        break
                else:
                    continue
                break
        if factor != 1.0:
            p = s.points[ends[i - 1]]
            s.points[ends[i - 1]] = Point(p.start, p.end, p.val * factor, p.accn, p.form, p.filed, p.fy, p.fp,
                                          p.concept, p.derived, (p.note + " " if p.note else "") + f"bölünme düzeltmesi ×{factor:g}")


# ---------------------------------------------------------------------------
# Çeyrek tablosu ve metrikler
# ---------------------------------------------------------------------------

def _near(points: dict[str, Point], end: str, tol: int = 5) -> Point | None:
    if end in points:
        return points[end]
    best = None
    for e, p in points.items():
        d = abs(_days(e, end))
        if d <= tol and (best is None or d < abs(_days(best.end, end))):
            best = p
    return best


def _prev_year(ends: list[str], end: str) -> str | None:
    for e in ends:
        if 355 <= _days(e, end) <= 375:
            return e
    return None


def _ttm(series: Series, end: str, ends: list[str]) -> float | None:
    """Son 4 çeyreğin toplamı (ardışık çeyrekler)."""
    chain = [end]
    cur = end
    for _ in range(3):
        prev = [e for e in ends if 75 <= _days(e, cur) <= 105]
        if not prev:
            return None
        cur = max(prev)
        chain.append(cur)
    vals = []
    for e in chain:
        p = _near(series.points, e)
        if p is None:
            # yıllık dönem sonu ise doğrudan yıllık değeri kullan
            return None
        vals.append(p.val)
    return sum(vals)


def build_table(cf: dict, max_quarters: int = 12) -> dict:
    S = {k: build_series(cf, k) for k in CONCEPTS}
    rev = S["revenue"]
    ends = sorted(rev.points.keys())
    if not ends:
        return {"ceyrekler": [], "kavramlar": {}, "hata": "Gelir serisi bulunamadı (XBRL)"}

    def v(key, end, tol=5):
        p = _near(S[key].points, end, tol)
        return p.val if p else None

    rows = []
    for end in ends:
        r: dict = {"donem_sonu": end}
        p_rev = rev.points[end]
        # Mali dönem etiketi: bu dönemi İLK raporlayan dosyadan
        r["donem_basi"] = p_rev.start
        for key in CONCEPTS:
            r[key] = v(key, end)
        if r["gross_profit"] is None and r["revenue"] is not None and r["cogs"] is not None:
            r["gross_profit"] = r["revenue"] - r["cogs"]
        src = {}
        for k in CONCEPTS:
            p = _near(S[k].points, end)
            if p is not None:
                src[k] = {"concept": p.concept, "accn": p.accn, "turetilmis": p.derived, "not": p.note}
        r["_kaynak"] = src
        rows.append(r)

    # Etiketler: dönemi ilk raporlayan dosyanın fy/fp bilgisi
    first_filed: dict[str, dict] = {}
    for c in rev.concepts_used:
        entries, _ = _facts_for(cf, c, "USD")
        for e in entries:
            if e.get("form") not in ("10-Q", "10-K", "10-Q/A", "10-K/A"):
                continue
            for end in ends:
                if abs(_days(e["end"], end)) <= 3:
                    cur = first_filed.get(end)
                    if cur is None or e.get("filed", "") < cur.get("filed", ""):
                        first_filed[end] = e
    for r in rows:
        e = first_filed.get(r["donem_sonu"])
        if e:
            fp = e.get("fp") or ""
            fy = e.get("fy")
            r["etiket"] = f"FY{fy} {'Q4' if fp == 'FY' else fp}"
            r["ilk_rapor_accn"] = e.get("accn")
            r["ilk_rapor_form"] = e.get("form")
            r["ilk_rapor_tarih"] = e.get("filed")
        else:
            r["etiket"] = r["donem_sonu"]

    idx = {r["donem_sonu"]: r for r in rows}
    for r in rows:
        end = r["donem_sonu"]
        py = _prev_year(ends, end)
        pr = idx.get(py) if py else None
        rv = r["revenue"]
        r["gross_margin"] = rnd(safe_div(r["gross_profit"], rv) * 100 if safe_div(r["gross_profit"], rv) is not None else None)
        r["operating_margin"] = rnd(safe_div(r["operating_income"], rv) * 100 if safe_div(r["operating_income"], rv) is not None else None)
        r["net_margin"] = rnd(safe_div(r["net_income"], rv) * 100 if safe_div(r["net_income"], rv) is not None else None)
        r["fcf"] = (r["ocf"] - r["capex"]) if (r["ocf"] is not None and r["capex"] is not None) else None
        # TTM
        for k in ("revenue", "gross_profit", "operating_income", "net_income", "ocf", "capex", "sbc",
                  "cogs", "acquisitions", "interest_income", "tax", "pretax", "da", "buybacks", "dividends",
                  "rd", "sga", "equity_issued", "debt_issued", "debt_repaid"):
            if k == "gross_profit" and not S["gross_profit"].points:
                # brüt kâr kavramı yoksa gelir − SMM'den TTM
                a, b = _ttm(S["revenue"], end, ends), _ttm(S["cogs"], end, ends)
                r["gross_profit_ttm"] = (a - b) if a is not None and b is not None else None
                continue
            r[f"{k}_ttm"] = _ttm(S[k], end, ends)
        r["fcf_ttm"] = (r["ocf_ttm"] - r["capex_ttm"]) if (r["ocf_ttm"] is not None and r["capex_ttm"] is not None) else None
        rt = r["revenue_ttm"]
        r["gross_margin_ttm"] = rnd(_p(r["gross_profit_ttm"], rt))
        r["operating_margin_ttm"] = rnd(_p(r["operating_income_ttm"], rt))
        r["fcf_margin_ttm"] = rnd(_p(r["fcf_ttm"], rt))
        r["sbc_to_revenue_ttm"] = rnd(_p(r["sbc_ttm"], rt))
        r["capex_to_revenue_ttm"] = rnd(_p(r["capex_ttm"], rt))
        r["ocf_to_ni_ttm"] = rnd(safe_div(r["ocf_ttm"], r["net_income_ttm"]) if (r["net_income_ttm"] or 0) > 0 else None)
        r["fcf_to_ni_ttm"] = rnd(safe_div(r["fcf_ttm"], r["net_income_ttm"]) if (r["net_income_ttm"] or 0) > 0 else None)
        r["sbc_adj_fcf_ttm"] = (r["fcf_ttm"] - r["sbc_ttm"]) if (r["fcf_ttm"] is not None and r["sbc_ttm"] is not None) else None
        r["sbc_adj_fcf_margin_ttm"] = rnd(_p(r["sbc_adj_fcf_ttm"], rt))
        r["capex_to_da_ttm"] = rnd(safe_div(r["capex_ttm"], r["da_ttm"]))
        r["shareholder_return_ttm"] = ((r["buybacks_ttm"] or 0) + (r["dividends_ttm"] or 0)) if (
            r["buybacks_ttm"] is not None or r["dividends_ttm"] is not None) else None
        qdays = _days(r["donem_basi"], end) + 1 if r.get("donem_basi") else 91
        r["dso"] = rnd(safe_div(r["ar"], rv) * qdays if safe_div(r["ar"], rv) is not None else None, 1)
        r["dio"] = rnd(safe_div(r["inventory"], r["cogs"]) * qdays if safe_div(r["inventory"], r["cogs"]) is not None else None, 1)
        dr = None
        if r["deferred_rev_current"] is not None or r["deferred_rev_noncurrent"] is not None:
            dr = (r["deferred_rev_current"] or 0) + (r["deferred_rev_noncurrent"] or 0)
        r["deferred_revenue"] = dr
        r["liquidity"] = None if r["cash"] is None else r["cash"] + (r["st_investments"] or 0)
        if r.get("cash_and_st") is not None and (r["liquidity"] is None or r["cash_and_st"] > r["liquidity"]):
            r["liquidity"] = r["cash_and_st"]
        # --- bilanço ve verimlilik oranları ---
        if r["total_liabilities"] is None and r["liab_and_equity"] is not None and r["equity"] is not None:
            r["total_liabilities"] = r["liab_and_equity"] - r["equity"]
        # Finansal borç: LongTermDebt (kısa vadeli kısım dahil) varsa o; yoksa kısa + uzun vadeli parçalar.
        # Dönüştürülebilir tahvil ayrı etiketlenmişse ve uzun vadeli borçtan büyükse ayrı kalem sayılır.
        # Ticari senet / kısa vadeli banka kredisi her durumda eklenir.
        base = r["total_debt"]
        if base is None and (r["debt_current"] is not None or r["debt_noncurrent"] is not None or r["convertible"] is not None):
            nc = r["debt_noncurrent"] or 0
            cv = r["convertible"] or 0
            base = (r["debt_current"] or 0) + (nc if nc >= cv else nc + cv)
        if base is not None or r["st_borrowings"] is not None:
            r["total_debt"] = (base or 0) + (r["st_borrowings"] or 0)
        r["equity_investments"] = ((r["eq_inv_fv"] or 0) + (r["eq_inv_other"] or 0)) if (
            r["eq_inv_fv"] is not None or r["eq_inv_other"] is not None) else None
        r["net_cash"] = (r["liquidity"] - (r["total_debt"] or 0)) if r["liquidity"] is not None else None
        r["current_ratio"] = rnd(safe_div(r["current_assets"], r["current_liabilities"]))
        r["working_capital"] = (r["current_assets"] - r["current_liabilities"]) if (
            r["current_assets"] is not None and r["current_liabilities"] is not None) else None
        r["debt_to_equity"] = rnd(safe_div(r["total_debt"], r["equity"])) if (r["equity"] or 0) > 0 else None
        r["equity_ratio"] = rnd(_p(r["equity"], r["total_assets"]))
        r["goodwill_to_assets"] = rnd(_p(r["goodwill"], r["total_assets"]))
        r["dpo"] = rnd(safe_div(r["ap"], r["cogs"]) * qdays if safe_div(r["ap"], r["cogs"]) is not None else None, 1)
        r["ccc"] = rnd(r["dso"] + (r["dio"] or 0) - (r["dpo"] or 0), 1) if r["dso"] is not None else None
        r["rd_to_revenue"] = rnd(_p(r["rd"], rv))
        r["sga_to_revenue"] = rnd(_p(r["sga"], rv))
        # YoY
        if pr:
            r["onceki_yil_donem"] = pr["donem_sonu"]
            r["revenue_yoy"] = rnd(pct(rv, pr["revenue"]))
            r["revenue_ttm_yoy"] = rnd(pct(rt, pr.get("revenue_ttm")))
            r["diluted_shares_yoy"] = rnd(pct(r["diluted_shares"], pr["diluted_shares"]))
            r["ar_yoy"] = rnd(pct(r["ar"], pr["ar"]))
            r["inventory_yoy"] = rnd(pct(r["inventory"], pr["inventory"]))
            r["deferred_revenue_yoy"] = rnd(pct(dr, pr.get("deferred_revenue")))
            r["rpo_yoy"] = rnd(pct(r["rpo"], pr["rpo"]))
            r["gross_margin_yoy_pp"] = _diff(r["gross_margin"], pr.get("gross_margin"))
            r["dso_yoy_change"] = _diff(r["dso"], pr.get("dso"))
            r["capex_to_revenue_ttm_yoy_pp"] = _diff(r["capex_to_revenue_ttm"], pr.get("capex_to_revenue_ttm"))
            r["receivables_vs_revenue_gap"] = _diff(r["ar_yoy"], r["revenue_yoy"])
            r["eps_yoy"] = rnd(pct(r["eps_diluted"], pr.get("eps_diluted")))
            r["net_income_yoy"] = rnd(pct(r["net_income"], pr.get("net_income")))
            r["operating_income_yoy"] = rnd(pct(r["operating_income"], pr.get("operating_income")))
            r["gross_margin_yoy_pp"] = _diff(r["gross_margin"], pr.get("gross_margin"))
            r["operating_margin_yoy_pp"] = _diff(r["operating_margin"], pr.get("operating_margin"))
            ae = [x for x in (r["equity"], pr.get("equity")) if x is not None]
            aa = [x for x in (r["total_assets"], pr.get("total_assets")) if x is not None]
            avg_eq = sum(ae) / len(ae) if ae else None
            avg_as = sum(aa) / len(aa) if aa else None
            r["roe_ttm"] = rnd(_p(r["net_income_ttm"], avg_eq)) if avg_eq and avg_eq > 0 else None
            r["accruals_ratio"] = rnd(_p((r["net_income_ttm"] - r["ocf_ttm"]) if (r["net_income_ttm"] is not None and r["ocf_ttm"] is not None) else None, avg_as))
            ic = None
            if r["equity"] is not None:
                ic = r["equity"] + (r["total_debt"] or 0) - (r["liquidity"] or 0)
            r["roic_ttm"] = rnd(_p(r["operating_income_ttm"] * 0.79 if r["operating_income_ttm"] is not None else None, ic)) if ic and ic > 0 else None
            r["inventory_vs_revenue_gap"] = _diff(r["inventory_yoy"], r["revenue_yoy"])
        else:
            for k in ("revenue_yoy", "revenue_ttm_yoy", "diluted_shares_yoy", "ar_yoy", "inventory_yoy",
                      "deferred_revenue_yoy", "rpo_yoy", "gross_margin_yoy_pp", "dso_yoy_change",
                      "capex_to_revenue_ttm_yoy_pp", "receivables_vs_revenue_gap", "inventory_vs_revenue_gap",
                      "eps_yoy", "net_income_yoy", "operating_income_yoy", "operating_margin_yoy_pp",
                      "roe_ttm", "accruals_ratio", "roic_ttm"):
                r[k] = None
        prevq = [e for e in ends if 75 <= _days(e, end) <= 105]
        pq = idx.get(max(prevq)) if prevq else None
        r["revenue_qoq"] = rnd(pct(rv, pq["revenue"])) if pq else None
        # Nakit pisti: sadece TTM FCF negatifse
        if r["fcf_ttm"] is not None and r["fcf_ttm"] < 0 and r["liquidity"] is not None:
            r["cash_runway_months"] = rnd(r["liquidity"] / (-r["fcf_ttm"] / 12), 1)
        else:
            r["cash_runway_months"] = None
        r["nakit_uretiyor"] = (r["fcf_ttm"] is not None and r["fcf_ttm"] >= 0)

    rows = rows[-max_quarters:]
    kavramlar = {k: {"tablo": CONCEPTS[k]["tablo"], "kullanilan": S[k].concepts_used,
                     "etiketler": S[k].label} for k in CONCEPTS}
    return {"ceyrekler": rows, "kavramlar": kavramlar}


def _p(a, b):
    x = safe_div(a, b)
    return None if x is None else x * 100


def _diff(a, b):
    return None if a is None or b is None else round(a - b, 2)


def tag_dump(cf: dict, table: dict) -> dict:
    """Teşhis: son dönem sonunda raporlanan tüm us-gaap USD etiketleri (eşleme doğrulaması için)."""
    rows = table.get("ceyrekler") or []
    if not rows:
        return {}
    end = rows[-1]["donem_sonu"]
    used = {c for spec in CONCEPTS.values() for c in spec["c"]}
    inst, dur = {}, {}
    for name, node in (cf.get("facts", {}).get("us-gaap", {}) or {}).items():
        for e in node.get("units", {}).get("USD", []):
            if abs(_days(e["end"], end)) > 3:
                continue
            if e.get("start"):
                dur[name] = {"deger": e["val"], "baslangic": e["start"], "kullaniliyor": name in used}
            else:
                inst[name] = {"deger": e["val"], "kullaniliyor": name in used}
    srt = lambda d: dict(sorted(d.items(), key=lambda kv: -abs(kv[1]["deger"])))  # noqa: E731
    return {"donem_sonu": end, "anlik": srt(inst), "donemsel": srt(dur)}
