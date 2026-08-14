"""Bind Render $PORT so a Celery process can run as a web service.

Render MCP cannot create Background Workers. A free web service also spins
down without HTTP traffic. This sidecar keeps /health on $PORT while the
existing Celery app (worker or beat) runs as the real process.
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        body = b'{"status":"ok","role":"celery-sidecar"}\n'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        return


def _serve() -> None:
    port = int(os.environ.get("PORT", "10000"))
    HTTPServer(("0.0.0.0", port), _HealthHandler).serve_forever()


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python deployment/render_sidecar.py <command> [args...]", file=sys.stderr)
        return 2
    threading.Thread(target=_serve, daemon=True).start()
    return subprocess.call(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
