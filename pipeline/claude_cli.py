"""Claude Code CLI (`claude -p`) sarmalayıcısı — abonelik (Pro/Max) OAuth token'ı ile.

- Kimlik: CLAUDE_CODE_OAUTH_TOKEN (`claude setup-token` ile üretilir). ANTHROPIC_API_KEY
  ortamdan bilinçli olarak SİLİNİR; böylece API faturası oluşmaz.
- Model: CLAUDE_MODEL ortam değişkeni, yoksa settings.yaml (varsayılan claude-opus-5-5).
- `--bare` KULLANILMAZ: bare mod OAuth token'ını okumaz.
- Çıktı: stream-json. Araç sonuçlarındaki (WebSearch/WebFetch) URL'ler toplanır; modelin
  verdiği her kaynak linki bu kümeye karşı doğrulanır (uydurma link engeli).
- Her çağrının token kullanımı data/usage.jsonl'e yazılır. `total_cost_usd` abonelikte
  faturalanmaz; sadece "API'de olsaydı" göstergesidir.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time

from common import DATA, append_jsonl, load_yaml, log, now_iso

URL_RE = re.compile(r"https?://[^\s\"'<>\)\]\}\\]+")


class Claude:
    def __init__(self, run_id: str):
        self.run_id = run_id
        st = load_yaml("settings.yaml").get("claude", {})
        self.settings = st
        self.model = os.environ.get("CLAUDE_MODEL", "").strip() or st.get("model", "claude-opus-5-5")
        self.bin = shutil.which("claude")
        self.token = bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "").strip())
        self.available = bool(self.bin) and self.token and os.environ.get("SKIP_CLAUDE") != "1"
        if not self.available:
            why = "claude CLI kurulu değil" if not self.bin else (
                "CLAUDE_CODE_OAUTH_TOKEN yok" if not self.token else "SKIP_CLAUDE=1")
            log.warning("Claude devre dışı: %s", why)
        self.totals = {"cagri": 0, "input_tokens": 0, "output_tokens": 0, "cache_read": 0, "cache_write": 0,
                       "web_search": 0, "api_esdegeri_usd": 0.0, "sure_sn": 0.0}

    def run(self, task: str, ticker: str | None, prompt: str, stdin_text: str = "", *, schema: dict,
            web: bool = False, max_turns: int = 40, timeout_s: int = 1800) -> dict:
        """Döner: {'ok', 'json', 'urls', 'hata'}"""
        if not self.available:
            return {"ok": False, "json": None, "urls": set(), "hata": "Claude devre dışı (CLAUDE_CODE_OAUTH_TOKEN yok)"}
        tools = ["WebSearch", "WebFetch"] if web else []
        cmd = [self.bin, "-p", prompt, "--model", self.model, "--output-format", "stream-json", "--verbose",
               "--json-schema", json.dumps(schema, ensure_ascii=False), "--max-turns", str(max_turns),
               "--permission-mode", "dontAsk"]
        if tools:
            cmd += ["--allowedTools", ",".join(tools)]
        # Diğer tüm araçları kapat: dosya/kabuk erişimi yok, bağlam stdin'den gelir
        cmd += ["--disallowedTools", "Bash,Edit,Write,NotebookEdit,Task,Agent"]
        env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        # Boş çalışma klasörü: repodaki CLAUDE.md/.claude ayarları yüklenmesin
        work = DATA.parent / ".claude_work"
        work.mkdir(exist_ok=True)
        t0 = time.time()
        try:
            p = subprocess.run(cmd, input=stdin_text, capture_output=True, text=True, timeout=timeout_s, env=env,
                               cwd=str(work))
        except subprocess.TimeoutExpired:
            return {"ok": False, "json": None, "urls": set(), "hata": f"zaman aşımı ({timeout_s}s)"}
        dur = time.time() - t0
        urls: set[str] = set()
        result = None
        structured = None
        for line in p.stdout.splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            if ev.get("type") == "result":
                result = ev
            elif ev.get("type") == "user":
                # araç sonuçları (WebSearch/WebFetch) -> izin verilen URL kümesi
                for blk in (ev.get("message") or {}).get("content") or []:
                    if isinstance(blk, dict) and blk.get("type") == "tool_result":
                        urls.update(u.rstrip(".,;") for u in URL_RE.findall(json.dumps(blk.get("content"), ensure_ascii=False)))
            elif ev.get("type") == "assistant":
                for blk in (ev.get("message") or {}).get("content") or []:
                    if isinstance(blk, dict) and blk.get("type") == "tool_use" and blk.get("name") == "WebFetch":
                        u = (blk.get("input") or {}).get("url")
                        if u:
                            urls.add(u)
                    if isinstance(blk, dict) and blk.get("type") == "tool_use" and blk.get("name") == "StructuredOutput":
                        structured = blk.get("input")
        if result is None:
            err = (p.stderr or p.stdout or "")[-400:]
            log.error("Claude %s %s: sonuç yok (exit %s): %s", task, ticker, p.returncode, err)
            return {"ok": False, "json": None, "urls": urls, "hata": f"sonuç yok (exit {p.returncode}): {err[-200:]}"}
        self._log(task, ticker, result, dur)
        if result.get("is_error"):
            return {"ok": False, "json": None, "urls": urls, "hata": str(result.get("result") or result.get("subtype"))[:300]}
        obj = result.get("structured_output") or structured
        if obj is None:
            obj = _parse_json(result.get("result") or "")
        return {"ok": obj is not None, "json": obj, "urls": urls, "hata": None if obj is not None else "JSON yok"}

    def _log(self, task, ticker, r, dur):
        u = r.get("usage") or {}
        stu = u.get("server_tool_use") or {}
        rec = {"zaman": now_iso(), "calisma": self.run_id, "gorev": task, "ticker": ticker, "model": self.model,
               "input_tokens": u.get("input_tokens", 0) or 0, "output_tokens": u.get("output_tokens", 0) or 0,
               "cache_read": u.get("cache_read_input_tokens", 0) or 0,
               "cache_write": u.get("cache_creation_input_tokens", 0) or 0,
               "web_search": stu.get("web_search_requests", 0) or 0,
               "tur": r.get("num_turns"), "sure_sn": round(dur, 1),
               "api_esdegeri_usd": round(r.get("total_cost_usd") or 0.0, 4),
               "faturalama": "abonelik (Claude Code OAuth) — API faturası yok", "hata": bool(r.get("is_error"))}
        append_jsonl(DATA / "usage.jsonl", rec)
        self.totals["cagri"] += 1
        for k in ("input_tokens", "output_tokens", "cache_read", "cache_write", "web_search"):
            self.totals[k] += rec[k]
        self.totals["api_esdegeri_usd"] = round(self.totals["api_esdegeri_usd"] + rec["api_esdegeri_usd"], 4)
        self.totals["sure_sn"] = round(self.totals["sure_sn"] + dur, 1)
        log.info("Claude %s %s: in=%s out=%s ws=%s tur=%s %.0fs", task, ticker, rec["input_tokens"],
                 rec["output_tokens"], rec["web_search"], rec["tur"], dur)


def _parse_json(text: str):
    if not text:
        return None
    for c in list(reversed(re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S))) + [text.strip()]:
        try:
            return json.loads(c)
        except (json.JSONDecodeError, TypeError):
            pass
    i, j = text.find("{"), text.rfind("}")
    if i != -1 and j > i:
        try:
            return json.loads(text[i:j + 1])
        except json.JSONDecodeError:
            return None
    return None


def norm_url(u: str) -> str:
    u = (u or "").strip().rstrip("/").lower()
    u = re.sub(r"^https?://(www\.)?", "", u)
    return u.split("#")[0]


def url_ok(u: str, allowed: set) -> bool:
    if not u:
        return False
    n = norm_url(u)
    an = {norm_url(a) for a in allowed}
    return n in an or any(a.split("?")[0] == n.split("?")[0] for a in an)


def verify_quote(quote: str, source: str) -> bool:
    """Alıntının kaynak metinde geçip geçmediğini (boşluk/noktalama toleranslı) kontrol eder."""
    if not quote or not source:
        return False

    def n(s):
        s = s.lower().replace("’", "'").replace("“", '"').replace("”", '"').replace("—", "-").replace("–", "-")
        s = re.sub(r"[^a-z0-9%$.,'\-]+", " ", s)
        return re.sub(r"\s+", " ", s).strip()

    q, src = n(quote), n(source)
    if len(q) < 12:
        return False
    if q in src:
        return True
    if len(q) > 140:
        return q[:60] in src and q[-60:] in src
    return False


# ---- JSON Schema yardımcıları ----
def S(props: dict, req: list | None = None) -> dict:
    return {"type": "object", "properties": props, "required": req or list(props), "additionalProperties": False}


STR = {"type": "string"}
BOOL = {"type": "boolean"}
NSTR = {"type": ["string", "null"]}


def ENUM(*v):
    return {"type": "string", "enum": list(v)}


def ARR(x):
    return {"type": "array", "items": x}
