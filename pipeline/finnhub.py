"""Finnhub istemcisi (ücretsiz katman: 60 istek/dk)."""
from __future__ import annotations

import datetime as dt
import os

from common import RateLimitedSession, log

BASE = "https://finnhub.io/api/v1"


class Finnhub:
    def __init__(self):
        self.key = os.environ.get("FINNHUB_API_KEY", "").strip()
        self.available = bool(self.key)
        if not self.available:
            log.warning("FINNHUB_API_KEY yok: Finnhub haber/insider/quote atlanacak.")
        self.s = RateLimitedSession(1.1, name="Finnhub")

    def _get(self, path, **params):
        if not self.available:
            return None
        params["token"] = self.key
        r = self.s.get(f"{BASE}{path}", params=params, retries=3)
        if r is None:
            return None
        try:
            return r.json()
        except ValueError:
            return None

    def quote(self, sym):
        return self._get("/quote", symbol=sym)

    def metric(self, sym):
        d = self._get("/stock/metric", symbol=sym, metric="all")
        return (d or {}).get("metric") if isinstance(d, dict) else None

    def news(self, sym, days=7):
        to = dt.date.today()
        fr = to - dt.timedelta(days=days)
        d = self._get("/company-news", symbol=sym, **{"from": fr.isoformat(), "to": to.isoformat()})
        return d if isinstance(d, list) else []

    def news_range(self, sym, fr: str, to: str):
        d = self._get("/company-news", symbol=sym, **{"from": fr, "to": to})
        return d if isinstance(d, list) else []

    def insider(self, sym, days=180):
        to = dt.date.today()
        fr = to - dt.timedelta(days=days)
        d = self._get("/stock/insider-transactions", symbol=sym, **{"from": fr.isoformat(), "to": to.isoformat()})
        return (d or {}).get("data", []) if isinstance(d, dict) else []
