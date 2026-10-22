"""AT Protocol OAuth discovery, PAR, PKCE and nonce-bound DPoP."""

import base64
import hashlib
import json
import logging
import secrets
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode, urlsplit

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from fastapi import HTTPException

logger = logging.getLogger(__name__)

from app.core.config import get_settings
from app.core.safe_http import PublicTransport
from app.modules.channels.base import AuthStart
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token
from app.modules.channels.support import AdapterHTTP


def b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def jwk(key):
    public = key.public_key().public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": b64(public.x.to_bytes(32, "big")),
        "y": b64(public.y.to_bytes(32, "big")),
    }


def jwt(key, header, claims):
    encoded = ".".join(b64(json.dumps(v, separators=(",", ":")).encode()) for v in (header, claims))
    r, s = decode_dss_signature(key.sign(encoded.encode(), ec.ECDSA(hashes.SHA256())))
    return encoded + "." + b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))


def client_key():
    value = get_settings().bluesky_private_key
    if not value:
        return None
    raw = value.strip().replace("\\n", "\n")
    if not raw.startswith("-----BEGIN"):
        raw = f"-----BEGIN PRIVATE KEY-----\n{raw}\n-----END PRIVATE KEY-----"
    try:
        key = serialization.load_pem_private_key(raw.encode(), password=None)
    except Exception as exc:
        raise HTTPException(503, f"Invalid Bluesky private key: {exc}") from exc
    if not isinstance(key, ec.EllipticCurvePrivateKey) or not isinstance(key.curve, ec.SECP256R1):
        raise HTTPException(503, "Bluesky OAuth requires a P-256 private key")
    return key


class BlueskyOAuth:
    async def _get_client(self):
        return self._http_client or AdapterHTTP(
            self.platform, transport=PublicTransport(), trust_env=False
        )

    def client_metadata(self):
        key = client_key()
        if not get_settings().debug and not get_settings().bluesky_client_id:
            raise HTTPException(503, "Configure BLUESKY_CLIENT_ID to the public metadata URL")
        if not key and not get_settings().debug:
            raise HTTPException(503, "Configure BLUESKY_PRIVATE_KEY for confidential OAuth")
        parts = urlsplit(self.client_id)
        client_origin = (
            f"{parts.scheme}://{parts.netloc}"
            if parts.scheme and parts.netloc
            else "https://draftva.com"
        )
        metadata = {
            "client_id": self.client_id,
            "client_name": "draftva",
            "client_uri": client_origin,
            "redirect_uris": [self.redirect_base_url],
            "scope": "atproto transition:generic",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "application_type": "web",
            "dpop_bound_access_tokens": True,
            "token_endpoint_auth_method": "private_key_jwt" if key else "none",
        }
        if key:
            metadata.update(
                token_endpoint_auth_signing_alg="ES256",
                jwks={
                    "keys": [
                        {
                            **jwk(key),
                            "kid": get_settings().bluesky_key_id,
                            "use": "sig",
                            "alg": "ES256",
                        }
                    ]
                },
            )
        return metadata

    async def _oauth_request(
        self, client, method, url, *, account=None, oauth=None, token=None, **kwargs
    ):
        metadata = oauth or dict(account.account_metadata.get("oauth", {}))
        private = serialization.load_pem_private_key(
            decrypt_token(metadata["encrypted_dpop_key"]).encode(), password=None
        )
        if account:
            token = decrypt_token(account.encrypted_access_token)
        headers = dict(kwargs.pop("headers", {}))
        headers.pop("Authorization", None)
        if token:
            headers["Authorization"] = f"DPoP {token}"
        origin = str(httpx.URL(url).copy_with(path="/", query=None, fragment=None))
        nonces = dict(metadata.get("nonces", {}))
        for _ in range(2):
            claims = {
                "jti": secrets.token_urlsafe(24),
                "iat": int(time.time()),
                "htm": method.upper(),
                "htu": str(httpx.URL(url).copy_with(query=None, fragment=None)),
            }
            if origin in nonces:
                claims["nonce"] = nonces[origin]
            if token:
                claims["ath"] = b64(hashlib.sha256(token.encode()).digest())
            headers["DPoP"] = jwt(
                private, {"typ": "dpop+jwt", "alg": "ES256", "jwk": jwk(private)}, claims
            )
            response = await client.request(method, url, headers=headers, **kwargs)
            nonce = response.headers.get("DPoP-Nonce")
            if nonce:
                nonces[origin] = nonce
                metadata["nonces"] = nonces
                if account:
                    account.account_metadata = {**account.account_metadata, "oauth": metadata}
            if response.status_code not in {400, 401} or not nonce:
                return response
            if response.json().get(
                "error"
            ) != "use_dpop_nonce" and "use_dpop_nonce" not in response.headers.get(
                "www-authenticate", ""
            ):
                return response
        return response

    def _client_auth(self, metadata):
        key = client_key()
        data = {"client_id": self.client_id}
        if key:
            now = int(time.time())
            data.update(
                client_assertion_type="urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion=jwt(
                    key,
                    {"alg": "ES256", "kid": get_settings().bluesky_key_id},
                    {
                        "iss": self.client_id,
                        "sub": self.client_id,
                        "aud": metadata["issuer"],
                        "jti": secrets.token_urlsafe(24),
                        "iat": now,
                        "exp": now + 60,
                    },
                ),
            )
        return data

    async def build_auth_url(self, workspace_id, state, **opts):
        self.client_metadata()
        identifier = opts.get("identifier")
        if not identifier or any(char in identifier for char in "/?#@"):
            raise HTTPException(422, "A Bluesky handle is required for OAuth discovery")
        client = await self._get_client()
        try:
            resolved = await client.get(
                "https://bsky.social/xrpc/com.atproto.identity.resolveHandle",
                params={"handle": identifier},
            )
            resolved.raise_for_status()
            did = resolved.json()["did"]
            if did.startswith("did:plc:"):
                did_url = "https://plc.directory/" + did
            elif did.startswith("did:web:") and ":" not in did[8:]:
                did_url = "https://" + did[8:] + "/.well-known/did.json"
            else:
                raise HTTPException(422, "Unsupported Bluesky identity document")
            document = await client.get(did_url)
            document.raise_for_status()
            if document.json().get("id") != did:
                raise HTTPException(422, "Bluesky identity document mismatch")
            pds = next(
                (
                    s["serviceEndpoint"]
                    for s in document.json().get("service", [])
                    if s.get("type") == "AtprotoPersonalDataServer"
                ),
                None,
            )
            if not pds or urlsplit(pds).scheme != "https":
                raise HTTPException(422, "Bluesky identity has no HTTPS data server")
            pds = pds.rstrip("/")
            resource = await client.get(pds + "/.well-known/oauth-protected-resource")
            resource.raise_for_status()
            if resource.json().get("resource") != pds:
                raise HTTPException(422, "OAuth resource mismatch")
            issuer = resource.json()["authorization_servers"][0]
            if urlsplit(issuer).scheme != "https":
                raise HTTPException(422, "OAuth issuer must use HTTPS")
            discovery = await client.get(
                issuer.rstrip("/") + "/.well-known/oauth-authorization-server"
            )
            discovery.raise_for_status()
            server = discovery.json()
            if server.get("issuer") != issuer or "ES256" not in server.get(
                "dpop_signing_alg_values_supported", []
            ):
                raise HTTPException(422, "OAuth issuer/DPoP discovery mismatch")
            for field in (
                "authorization_endpoint",
                "token_endpoint",
                "pushed_authorization_request_endpoint",
            ):
                if urlsplit(server.get(field, "")).scheme != "https":
                    raise HTTPException(422, "Incomplete HTTPS OAuth discovery")
            dpop = ec.generate_private_key(ec.SECP256R1())
            pem = dpop.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            ).decode()
            metadata = {
                "issuer": issuer,
                "pds_url": pds,
                "did": did,
                "handle": identifier,
                "token_endpoint": server["token_endpoint"],
                "revocation_endpoint": server.get("revocation_endpoint"),
                "encrypted_dpop_key": encrypt_token(pem),
            }
            par = await self._oauth_request(
                client,
                "POST",
                server["pushed_authorization_request_endpoint"],
                oauth=metadata,
                data={
                    **self._client_auth(metadata),
                    "response_type": "code",
                    "redirect_uri": self.redirect_base_url,
                    "state": state,
                    "scope": "atproto transition:generic",
                    "code_challenge": opts["code_challenge"],
                    "code_challenge_method": "S256",
                    "login_hint": identifier,
                },
            )
            if par.status_code >= 400:
                logger.warning("Bluesky authorization request rejected (HTTP %s)", par.status_code)
                raise HTTPException(
                    502, "Bluesky authorization could not start. Please try connecting again"
                )
            record = opts.get("state_record")
            if not record or not opts.get("db"):
                raise HTTPException(422, "OAuth state persistence is required")
            record.encrypted_metadata = encrypt_token(json.dumps(metadata))
            opts["db"].add(record)
            opts["db"].commit()
            return AuthStart(
                auth_url=server["authorization_endpoint"]
                + "?"
                + urlencode(
                    {"client_id": self.client_id, "request_uri": par.json()["request_uri"]}
                ),
                state=state,
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def handle_callback(self, workspace_id, params, state, **opts):
        metadata = opts.get("oauth_metadata", {})
        if not params.get("code") or not metadata or params.get("iss") != metadata.get("issuer"):
            raise HTTPException(400, "OAuth code and matching issuer are required")
        client = await self._get_client()
        try:
            response = await self._oauth_request(
                client,
                "POST",
                metadata["token_endpoint"],
                oauth=metadata,
                data={
                    **self._client_auth(metadata),
                    "grant_type": "authorization_code",
                    "code": params["code"],
                    "redirect_uri": self.redirect_base_url,
                    "code_verifier": opts["code_verifier"],
                },
            )
            response.raise_for_status()
            tokens = response.json()
            if (
                tokens.get("sub") != metadata["did"]
                or tokens.get("token_type", "").lower() != "dpop"
            ):
                raise HTTPException(400, "Bluesky OAuth subject/token type mismatch")

            avatar_url = None
            display_name = metadata["handle"]
            try:
                prof_resp = await self._oauth_request(
                    client,
                    "GET",
                    f"{metadata['pds_url']}/xrpc/app.bsky.actor.getProfile",
                    oauth=metadata,
                    token=tokens.get("access_token"),
                    params={"actor": metadata["did"]},
                    headers={"Authorization": f"DPoP {tokens.get('access_token')}"},
                )
                if prof_resp.status_code == 200:
                    prof_data = prof_resp.json()
                    avatar_url = prof_data.get("avatar")
                    if prof_data.get("displayName"):
                        display_name = f"{prof_data['displayName']} (@{metadata['handle']})"
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not fetch Bluesky actor profile on callback: %s", exc)

            return ConnectedAccount(
                workspace_id=workspace_id,
                platform="bluesky",
                external_account_id=metadata["did"],
                display_name=display_name,
                account_type="profile",
                encrypted_access_token=encrypt_token(tokens["access_token"]),
                encrypted_refresh_token=encrypt_token(tokens.get("refresh_token")),
                token_expires_at=datetime.now(UTC)
                + timedelta(seconds=tokens.get("expires_in", 300)),
                granted_scopes=tokens.get("scope", "atproto").split(),
                status="active",
                account_metadata={
                    "did": metadata["did"],
                    "handle": metadata["handle"],
                    "pds_url": metadata["pds_url"],
                    "avatar": avatar_url,
                    "avatar_url": avatar_url,
                    "oauth": metadata,
                },
            )
        finally:
            if self._http_client is None:
                await client.aclose()

    async def refresh_tokens(self, account):
        metadata = dict(account.account_metadata.get("oauth", {}))
        if not metadata:
            raise RuntimeError("Reconnect this account using official OAuth")
        client = await self._get_client()
        try:
            response = await self._oauth_request(
                client,
                "POST",
                metadata["token_endpoint"],
                oauth=metadata,
                data={
                    **self._client_auth(metadata),
                    "grant_type": "refresh_token",
                    "refresh_token": decrypt_token(account.encrypted_refresh_token),
                },
            )
            response.raise_for_status()
            tokens = response.json()
            if tokens.get("sub", account.external_account_id) != account.external_account_id:
                raise RuntimeError("OAuth refresh subject mismatch")
            account.encrypted_access_token = encrypt_token(tokens["access_token"])
            account.encrypted_refresh_token = encrypt_token(
                tokens.get("refresh_token") or decrypt_token(account.encrypted_refresh_token)
            )
            account.token_expires_at = datetime.now(UTC) + timedelta(
                seconds=tokens.get("expires_in", 300)
            )
            account.account_metadata = {**account.account_metadata, "oauth": metadata}
            return account
        finally:
            if self._http_client is None:
                await client.aclose()

    async def revoke(self, account):
        metadata = dict(account.account_metadata.get("oauth", {}))
        if not metadata.get("revocation_endpoint"):
            raise RuntimeError(
                "Authorization server does not expose revocation; revoke access at your server"
            )
        client = await self._get_client()
        try:
            response = await self._oauth_request(
                client,
                "POST",
                metadata["revocation_endpoint"],
                oauth=metadata,
                data={
                    **self._client_auth(metadata),
                    "token": decrypt_token(account.encrypted_refresh_token)
                    or decrypt_token(account.encrypted_access_token),
                },
            )
            response.raise_for_status()
        finally:
            if self._http_client is None:
                await client.aclose()
