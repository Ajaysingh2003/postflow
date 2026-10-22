"""Opt-in real TLS/Nginx tests against disposable echo containers, never the app DB."""

import hashlib
import http.client
import json
import os
import socket
import ssl
import subprocess
import time
import uuid
from contextlib import closing
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(
    os.getenv("DRAFTVA_PROXY_INTEGRATION") != "1",
    reason="Set DRAFTVA_PROXY_INTEGRATION=1 to run isolated Docker TLS tests",
)

ECHO_SERVER = """
import hashlib, json, os, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *args): pass
    def handle_request(self):
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path == "/api/v1/assistant/test/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            first = b"event: first\\ndata: ready\\n\\n"
            self.wfile.write(f"{len(first):x}\\r\\n".encode() + first + b"\\r\\n")
            self.wfile.flush()
            time.sleep(1.5)
            self.wfile.write(b"0\\r\\n\\r\\n")
            self.wfile.flush()
            return
        body = json.dumps({"method": self.command, "path": self.path, "headers": dict(self.headers), "body_hash": hashlib.sha256(data).hexdigest(), "size": len(data), "instance": os.getenv("MOCK_INSTANCE", "one")}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    do_GET = handle_request
    do_POST = handle_request
ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
"""


def docker(*args, check=True):
    result = subprocess.run(
        ["docker", *args], capture_output=True, text=True, timeout=60, check=False
    )
    if check and result.returncode:
        raise RuntimeError(f"Docker proxy fixture failed: {result.stderr}")
    return result.stdout.strip()


class LocalHTTPSConnection(http.client.HTTPSConnection):
    def connect(self):
        self.sock = self._context.wrap_socket(
            socket.create_connection(("127.0.0.1", self.port), self.timeout),
            server_hostname=self.host,
        )


@pytest.fixture(scope="module")
def proxy(tmp_path_factory):
    root = tmp_path_factory.mktemp("draftva-proxy")
    certificate_dir = root / "certificates" / "live" / "api.draftva.com"
    certificate_dir.mkdir(parents=True)
    certificate = certificate_dir / "fullchain.pem"
    private_key = certificate_dir / "privkey.pem"
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-days",
            "1",
            "-subj",
            "/CN=api.draftva.com",
            "-addext",
            "subjectAltName=DNS:api.draftva.com",
            "-keyout",
            str(private_key),
            "-out",
            str(certificate),
        ],
        check=True,
        capture_output=True,
        timeout=20,
    )
    script = root / "echo.py"
    script.write_text(ECHO_SERVER)
    challenges = root / "challenges" / ".well-known" / "acme-challenge"
    challenges.mkdir(parents=True)
    (challenges / "fixture").write_text("acme-fixture")
    unique = uuid.uuid4().hex[:12]
    network = "draftva-proxy-test-" + unique
    frontend = network + "-nginx"
    backend = network + "-api"
    replacement = network + "-replacement"
    echo_image = os.getenv("DRAFTVA_PROXY_ECHO_IMAGE", "python:3.13-slim")
    nginx_image = "nginx:1.28-alpine"
    docker("network", "create", network)
    try:

        def start_echo(name, instance):
            docker(
                "run",
                "-d",
                "--name",
                name,
                "--network",
                network,
                "--network-alias",
                "api",
                "-e",
                f"MOCK_INSTANCE={instance}",
                "--mount",
                f"type=bind,source={script},target=/opt/echo.py,readonly",
                "--entrypoint",
                "python",
                echo_image,
                "/opt/echo.py",
            )

        start_echo(backend, "one")
        common_mounts = [
            "--mount",
            f"type=bind,source={BACKEND / 'deploy/nginx/nginx.conf'},target=/etc/nginx/nginx.conf,readonly",
            "--mount",
            f"type=bind,source={BACKEND / 'deploy/nginx/proxy.conf'},target=/etc/nginx/draftva-proxy.conf,readonly",
            "--mount",
            f"type=bind,source={root / 'certificates'},target=/etc/letsencrypt,readonly",
            "--mount",
            f"type=bind,source={root / 'challenges'},target=/var/www/certbot,readonly",
        ]
        # Validate both first-certificate bootstrap and the HTTPS config with real Nginx.
        for mode in ("http", "https"):
            docker(
                "run",
                "--rm",
                "--network",
                network,
                *common_mounts,
                "--mount",
                f"type=bind,source={BACKEND / 'deploy/nginx' / (mode + '.conf')},target=/etc/nginx/conf.d/default.conf,readonly",
                nginx_image,
                "nginx",
                "-t",
            )
        docker(
            "run",
            "-d",
            "--name",
            frontend,
            "--network",
            network,
            "--read-only",
            "--security-opt",
            "no-new-privileges:true",
            "--tmpfs",
            "/var/cache/nginx:size=256m,mode=0755",
            "--tmpfs",
            "/var/run:size=1m,mode=0755",
            "-p",
            "127.0.0.1::80",
            "-p",
            "127.0.0.1::443",
            *common_mounts,
            "--mount",
            f"type=bind,source={BACKEND / 'deploy/nginx/https.conf'},target=/etc/nginx/conf.d/default.conf,readonly",
            nginx_image,
        )
        ports = json.loads(
            docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", frontend)
        )
        http_port = int(ports["80/tcp"][0]["HostPort"])
        https_port = int(ports["443/tcp"][0]["HostPort"])
        context = ssl.create_default_context(cafile=str(certificate))

        def connection(tls=True):
            if tls:
                return closing(
                    LocalHTTPSConnection("api.draftva.com", https_port, timeout=5, context=context)
                )
            return closing(http.client.HTTPConnection("127.0.0.1", http_port, timeout=5))

        deadline = time.monotonic() + 15
        while True:
            try:
                with connection() as conn:
                    conn.request("GET", "/health", headers={"Host": "api.draftva.com"})
                    assert conn.getresponse().status == 200
                break
            except (OSError, http.client.HTTPException, AssertionError):
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.2)
        yield {
            "connection": connection,
            "nginx": frontend,
            "backend": backend,
            "replacement": replacement,
            "start_echo": start_echo,
        }
    finally:
        for name in (frontend, backend, replacement):
            docker("rm", "-f", name, check=False)
        docker("network", "rm", network, check=False)


def test_proxy_preserves_signed_webhook_bytes_and_replaces_spoofed_headers(proxy):
    data = b'{"type":"payment.succeeded","note":"raw \\u2713"}'
    with proxy["connection"]() as conn:
        conn.request(
            "POST",
            "/api/v1/webhooks/dodo?fixture_secret=must-not-be-logged",
            data,
            {
                "Host": "api.draftva.com",
                "Content-Type": "application/json",
                "webhook-id": "msg_fixture",
                "webhook-timestamp": "123456",
                "webhook-signature": "v1,fixture",
                "Authorization": "Bearer fixture-token",
                "X-Workspace-ID": "fixture-workspace",
                "X-Forwarded-For": "198.51.100.8",
                "X-Forwarded-Proto": "http",
                "Forwarded": "for=spoofed",
                "X-Request-ID": "spoofed-request-id",
            },
        )
        response = conn.getresponse()
        assert response.status == 200
        assert response.getheader("Strict-Transport-Security") == "max-age=31536000"
        body = json.loads(response.read())
    assert body["method"] == "POST"
    assert body["body_hash"] == hashlib.sha256(data).hexdigest()
    headers = {key.lower(): value for key, value in body["headers"].items()}
    assert headers["webhook-signature"] == "v1,fixture"
    assert headers["authorization"] == "Bearer fixture-token"
    assert headers["x-workspace-id"] == "fixture-workspace"
    assert headers["x-forwarded-proto"] == "https"
    assert headers["x-forwarded-for"] != "198.51.100.8"
    assert headers["x-request-id"] != "spoofed-request-id"
    assert "forwarded" not in headers
    logs = docker("logs", proxy["nginx"])
    assert "must-not-be-logged" not in logs
    assert "fixture-token" not in logs


def test_http_redirect_and_acme_challenge(proxy):
    with proxy["connection"](False) as conn:
        conn.request("GET", "/health", headers={"Host": "api.draftva.com"})
        response = conn.getresponse()
        assert response.status == 308
        assert response.getheader("Location") == "https://api.draftva.com/health"
        response.read()
        conn.request(
            "GET", "/.well-known/acme-challenge/fixture", headers={"Host": "api.draftva.com"}
        )
        response = conn.getresponse()
        assert response.status == 200
        assert response.read() == b"acme-fixture"


def test_unknown_host_is_not_forwarded(proxy):
    with proxy["connection"](False) as conn:
        conn.request("GET", "/health", headers={"Host": "evil.invalid"})
        with pytest.raises(http.client.RemoteDisconnected):
            conn.getresponse()


def test_only_legacy_upload_endpoint_accepts_large_bodies(proxy):
    data = b"a" * (2 * 1024 * 1024 + 1)
    for path, expected in (("/api/v1/auth/login", 413), ("/api/v1/media/attachments", 200)):
        with proxy["connection"]() as conn:
            conn.request(
                "POST",
                path,
                data,
                {"Host": "api.draftva.com", "Content-Type": "application/octet-stream"},
            )
            response = conn.getresponse()
            assert response.status == expected
            body = response.read()
            if expected == 200:
                assert json.loads(body)["size"] == len(data)


def test_assistant_stream_is_forwarded_before_completion(proxy):
    with proxy["connection"]() as conn:
        start = time.monotonic()
        conn.request("GET", "/api/v1/assistant/test/stream", headers={"Host": "api.draftva.com"})
        response = conn.getresponse()
        assert response.status == 200
        assert response.readline() == b"event: first\n"
        assert time.monotonic() - start < 1.2
        response.read()


def test_proxy_resolves_api_container_replacement_without_restart(proxy):
    proxy["start_echo"](proxy["replacement"], "two")
    docker("rm", "-f", proxy["backend"])
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        try:
            with proxy["connection"]() as conn:
                conn.request("GET", "/health", headers={"Host": "api.draftva.com"})
                response = conn.getresponse()
                if response.status == 200 and json.loads(response.read())["instance"] == "two":
                    return
        except (OSError, http.client.HTTPException):
            pass
        time.sleep(0.3)
    pytest.fail("Nginx kept using the removed API container")
