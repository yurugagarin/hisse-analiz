"""Ortak yardımcılar: yollar, JSON I/O, HTTP oturumları, loglama."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"
CACHE = ROOT / ".cache"  # GitHub Actions cache ile korunur, repoya commit'lenmez

log = logging.getLogger("hisse")


def setup_logging() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def today() -> dt.date:
    return dt.datetime.now(dt.timezone.utc).date()


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def load_yaml(name: str) -> Any:
    with open(CONFIG / name, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def read_json(path: Path, default: Any = None) -> Any:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=False, default=str)
        f.write("\n")
    tmp.replace(path)


def append_jsonl(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False, default=str) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    out = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        out.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except FileNotFoundError:
        pass
    return out


class RateLimitedSession:
    """requests.Session + basit hız sınırı + yeniden deneme."""

    def __init__(self, min_interval: float, headers: dict | None = None, name: str = "http"):
        self.s = requests.Session()
        if headers:
            self.s.headers.update(headers)
        self.min_interval = min_interval
        self._last = 0.0
        self._lock = threading.Lock()
        self.name = name
        self.count = 0
        self.fail_streak = 0
        self.disabled = False
        self.last_error = None

    def get(self, url: str, params: dict | None = None, retries: int = 4, timeout: int = 60,
            ok_404: bool = False) -> requests.Response | None:
        """GET; 429/5xx'te üstel bekleme ile yeniden dener. 401/403 kalıcı sayılır (tekrar denenmez).
        Üst üste 8 başarısız istekten sonra bu çalışma için kaynağı devre dışı bırakır (devre kesici)."""
        if self.disabled:
            return None
        for attempt in range(retries):
            with self._lock:
                wait = self.min_interval - (time.monotonic() - self._last)
                if wait > 0:
                    time.sleep(wait)
                self._last = time.monotonic()
            try:
                self.count += 1
                r = self.s.get(url, params=params, timeout=timeout)
            except requests.RequestException as e:
                log.warning("%s GET hata (%s) %s: %s", self.name, attempt + 1, url, str(e)[:200])
                self.last_error = str(e)[:200]
                time.sleep(min(8, 2 ** attempt))
                continue
            if r.status_code == 200:
                self.fail_streak = 0
                return r
            if r.status_code == 404 and ok_404:
                return None
            self.last_error = f"HTTP {r.status_code}"
            if r.status_code in (429, 500, 502, 503, 504):
                log.warning("%s %s %s (deneme %s)", self.name, r.status_code, url, attempt + 1)
                time.sleep(min(30, 3 * 2 ** attempt))
                continue
            log.warning("%s %s %s: %s", self.name, r.status_code, url, r.text[:160].replace("\n", " "))
            break
        self.fail_streak += 1
        if self.fail_streak >= 8:
            log.error("%s: üst üste %d başarısız istek — bu çalışmada devre dışı (%s)", self.name, self.fail_streak, self.last_error)
            self.disabled = True
        return None


def pct(a: float | None, b: float | None) -> float | None:
    """a'nın b'ye göre yüzde değişimi."""
    if a is None or b is None or b == 0:
        return None
    return (a - b) / abs(b) * 100.0


def safe_div(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return a / b


def rnd(x: float | None, n: int = 2) -> float | None:
    return None if x is None else round(x, n)
