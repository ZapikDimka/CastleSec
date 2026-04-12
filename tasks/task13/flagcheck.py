#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FLAG_PATH = os.environ.get("FLAG_PATH", "/root/IRON_CROWN.flag")

def load_expected_flag() -> str:
    try:
        with open(FLAG_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""

EXPECTED = load_expected_flag()

class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if self.path != "/api/check":
            self._json(404, {"ok": False, "error": "not_found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")
            got = (data.get("flag") or "").strip()
        except Exception:
            self._json(400, {"ok": False, "error": "bad_request"})
            return

        if EXPECTED and got == EXPECTED:
            self._json(200, {"ok": True})
        else:
            self._json(400, {"ok": False})

    def log_message(self, fmt, *args):
        return

def main():
    host = os.environ.get("BIND", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()

if __name__ == "__main__":
    main()