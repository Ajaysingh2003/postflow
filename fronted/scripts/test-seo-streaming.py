#!/usr/bin/env python3
"""Integration smoke test: home content must stream before a slow/unavailable price catalog.

Requires an existing `bun run build`. Starts only its own local test server and
an isolated mock billing endpoint; does not write to or call the real backend.
"""

import contextlib
import json
import os
import signal
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DelayedBilling(BaseHTTPRequestHandler):
    def do_GET(self):
        time.sleep(4)
        with contextlib.suppress(BrokenPipeError):
            self.send_response(503)
            self.end_headers()
            self.wfile.write(b'{"detail":"test catalog unavailable"}')

    def log_message(self, *_args):
        pass


with socket.socket() as port_probe:
    port_probe.bind(("127.0.0.1", 0))
    preview_port = port_probe.getsockname()[1]
mock = ThreadingHTTPServer(("127.0.0.1", 0), DelayedBilling)
threading.Thread(target=mock.serve_forever, daemon=True).start()
environment = {**os.environ, "BASE_API": f"http://127.0.0.1:{mock.server_port}/api"}
with tempfile.TemporaryFile() as log:
    server = subprocess.Popen(
        ["bun", "run", "start", "--port", str(preview_port)],
        cwd=ROOT,
        env=environment,
        stdout=log,
        stderr=log,
        start_new_session=True,
    )
    try:
        origin = f"http://127.0.0.1:{preview_port}"
        for _ in range(40):
            try:
                with urllib.request.urlopen(origin + "/robots.txt", timeout=1):
                    break
            except (urllib.error.URLError, TimeoutError):
                time.sleep(0.1)
        started = time.monotonic()
        with urllib.request.urlopen(origin + "/", timeout=2) as response:
            content = b""
            while b"</h1>" not in content:
                content += response.read(1024)
                if time.monotonic() - started > 2 or len(content) > 2_000_000:
                    raise AssertionError(
                        "Hero content waited for the slow billing catalog"
                    )
            elapsed = time.monotonic() - started
            assert response.status == 200
            assert b"AI-powered" in content
            assert b'"@type":"Organization"' in content
            assert b'"@type":"WebPage"' in content
            assert b'"@type":"FAQPage"' in content
            assert elapsed < 2
        result = {
            "heroStreamedBeforeBilling": True,
            "entityAndAnswerSchemaStreamedBeforeBilling": True,
            "mockBillingDelaySeconds": 4,
            "heroHtmlSeconds": round(elapsed, 3),
        }
        (ROOT / "docs/seo/streaming.json").write_text(
            json.dumps(result, indent=2) + "\n"
        )
        print(json.dumps(result, indent=2))
    finally:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(server.pid, signal.SIGTERM)
        server.wait(timeout=10)
        mock.shutdown()
        mock.server_close()
