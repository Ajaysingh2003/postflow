"""Bounded public-web requests, including DNS pinning and redirect validation."""

import ipaddress
import socket
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException


def public_url(url: str) -> tuple[str, str]:
    parsed = urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise HTTPException(422, "A public HTTP(S) URL is required")
    if parsed.port not in {None, 80, 443}:
        raise HTTPException(422, "Custom URL ports are not allowed")
    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except OSError as exc:
        raise HTTPException(422, "Could not resolve URL host") from exc
    ips = sorted({item[4][0] for item in addresses})
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise HTTPException(422, "Private or reserved network addresses are not allowed")
    return parsed.hostname, ips[0]


class PublicTransport(httpx.AsyncHTTPTransport):
    async def handle_async_request(self, request):
        host, ip = public_url(str(request.url))
        # Connect to the validated address; retain Host and TLS identity. This
        # prevents a second DNS lookup from resolving to an internal address.
        request.headers["Host"] = request.url.netloc.decode()
        request.extensions["sni_hostname"] = host.encode()
        original_url = request.url
        request.url = request.url.copy_with(host=ip)
        try:
            return await super().handle_async_request(request)
        finally:
            request.url = original_url


async def public_text(url: str, max_bytes: int = 256_000) -> str:
    async with (
        httpx.AsyncClient(
            transport=PublicTransport(),
            timeout=10,
            follow_redirects=True,
            max_redirects=5,
            trust_env=False,
        ) as client,
        client.stream("GET", url, headers={"User-Agent": "postflow/1.0"}) as response,
    ):
        response.raise_for_status()
        if not any(
            t in response.headers.get("content-type", "") for t in ("text/html", "text/plain")
        ):
            raise HTTPException(422, "URL must return text or HTML")
        data = bytearray()
        async for chunk in response.aiter_bytes():
            data.extend(chunk)
            if len(data) > max_bytes:
                raise HTTPException(413, "Source webpage exceeds the size limit")
        return data.decode(response.encoding or "utf-8", errors="replace")
