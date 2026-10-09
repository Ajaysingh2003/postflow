"""Connection management and OAuth 2.1 authorization for MCP clients."""

import re
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_current_workspace, membership_for
from app.core.security import token_hash, utcnow
from app.db.session import get_db
from app.modules.agents.models import AgentAuthorization, AgentClient, AgentConnection
from app.modules.agents.security import EDIT_ROLES, SCOPES, challenge, secret
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace

router = APIRouter(prefix="/agents", tags=["agents"])
oauth_router = APIRouter(tags=["agent OAuth"])


def origin() -> str:
    return get_settings().mcp_url.removesuffix("/mcp")


def secure_response(data: dict, status_code: int = 200):
    return JSONResponse(
        data, status_code=status_code, headers={"Cache-Control": "no-store", "Pragma": "no-cache"}
    )


def oauth_error(message: str, error: str = "invalid_request", status_code: int = 400):
    return secure_response({"error": error, "error_description": message}, status_code)


def callback(uri: str, **params) -> str:
    parts = urlsplit(uri)
    query = "&".join(
        filter(None, [parts.query, urlencode({k: v for k, v in params.items() if v is not None})])
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))


def validate_redirect(uri: str):
    parts = urlsplit(uri)
    if (
        not parts.hostname
        or parts.username
        or parts.password
        or parts.fragment
        or parts.scheme not in {"http", "https"}
        or (parts.scheme == "http" and parts.hostname not in {"localhost", "127.0.0.1", "::1"})
    ):
        raise HTTPException(400, "Redirect URIs must use HTTPS, or HTTP on a loopback address")


class Registration(BaseModel):
    client_name: str = Field(default="MCP client", min_length=1, max_length=160)
    redirect_uris: list[str] = Field(min_length=1, max_length=10)
    token_endpoint_auth_method: str = "none"
    grant_types: list[str] = Field(default_factory=lambda: ["authorization_code", "refresh_token"])
    response_types: list[str] = Field(default_factory=lambda: ["code"])


@oauth_router.get("/.well-known/oauth-authorization-server")
def authorization_metadata():
    base = origin()
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "revocation_endpoint": f"{base}/oauth/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none"],
        "code_challenge_methods_supported": ["S256"],
        "scopes_supported": list(SCOPES),
    }


@oauth_router.post("/oauth/register")
def register_client(payload: Registration, db: Session = Depends(get_db)):
    if (
        payload.token_endpoint_auth_method != "none"
        or set(payload.grant_types) - {"authorization_code", "refresh_token"}
        or payload.response_types != ["code"]
    ):
        return oauth_error("Use the authorization-code flow with PKCE", "invalid_client_metadata")
    for uri in payload.redirect_uris:
        if len(uri) > 2048:
            return oauth_error("Redirect URI is too long", "invalid_redirect_uri")
        validate_redirect(uri)
    client = AgentClient(name=payload.client_name, redirect_uris=payload.redirect_uris)
    db.add(client)
    db.commit()
    return secure_response(
        {
            **payload.model_dump(),
            "client_id": client.id,
            "client_id_issued_at": int(datetime.now(UTC).timestamp()),
            "scope": " ".join(SCOPES),
        },
        201,
    )


@oauth_router.get("/oauth/authorize")
def authorize(
    client_id: str,
    redirect_uri: str,
    code_challenge: str,
    response_type: str = "code",
    code_challenge_method: str = "S256",
    scope: str = "postflow:read",
    resource: str | None = None,
    state: str | None = Query(default=None, max_length=2048),
    db: Session = Depends(get_db),
):
    client = db.get(AgentClient, client_id)
    if not client or redirect_uri not in client.redirect_uris:
        return oauth_error("Unregistered client or redirect URI")
    if (
        response_type != "code"
        or code_challenge_method != "S256"
        or not re.fullmatch(r"[A-Za-z0-9_-]{43}", code_challenge)
    ):
        return oauth_error("PKCE with S256 is required")
    scopes = list(dict.fromkeys(scope.split()))
    if not scopes or set(scopes) - SCOPES.keys() or "postflow:read" not in scopes:
        return oauth_error(
            "Choose supported Postflow scopes, including postflow:read", "invalid_scope"
        )
    if resource is not None and resource != get_settings().mcp_url:
        return oauth_error("Resource must match the Postflow MCP URL", "invalid_target")
    nonce = secret()
    db.add(
        AgentAuthorization(
            request_hash=token_hash(nonce),
            client_id=client.id,
            redirect_uri=redirect_uri,
            code_challenge=code_challenge,
            scopes=scopes,
            state=state,
            resource=get_settings().mcp_url,
            expires_at=utcnow() + timedelta(minutes=10),
        )
    )
    db.commit()
    url = (
        get_settings().frontend_url.rstrip("/")
        + "/dashboard/agents/authorize?"
        + urlencode({"request": nonce})
    )
    return RedirectResponse(url, status_code=302, headers={"Cache-Control": "no-store"})


def pending_request(db, nonce: str):
    authorization = db.scalar(
        select(AgentAuthorization)
        .where(
            AgentAuthorization.request_hash == token_hash(nonce),
            AgentAuthorization.expires_at > utcnow(),
            AgentAuthorization.consumed_at.is_(None),
            AgentAuthorization.code_hash.is_(None),
        )
        .with_for_update()
    )
    if not authorization:
        raise HTTPException(410, "This connection request has expired. Start again in your agent.")
    return authorization


@router.get("/authorization")
def authorization_request(
    request: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    authorization = pending_request(db, request)
    client = db.get(AgentClient, authorization.client_id)
    return secure_response(
        {
            "client_name": client.name,
            "redirect_origin": urlsplit(authorization.redirect_uri).netloc,
            "scopes": {scope: SCOPES[scope] for scope in authorization.scopes},
        }
    )


class Decision(BaseModel):
    request: str = Field(min_length=1, max_length=128)
    approve: bool


@router.post("/authorization")
def decide_authorization(
    payload: Decision,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    authorization = pending_request(db, payload.request)
    if not payload.approve:
        authorization.consumed_at = utcnow()
        db.commit()
        return secure_response(
            {
                "redirect_url": callback(
                    authorization.redirect_uri,
                    error="access_denied",
                    state=authorization.state,
                    iss=origin(),
                )
            }
        )
    member = membership_for(db, workspace.id, user.id)
    if set(authorization.scopes) - {"postflow:read"} and member.role not in EDIT_ROLES:
        raise HTTPException(403, "Editor role required for the requested permissions")
    code = secret()
    authorization.code_hash = token_hash(code)
    authorization.user_id = user.id
    authorization.workspace_id = workspace.id
    authorization.expires_at = utcnow() + timedelta(minutes=5)
    db.commit()
    return secure_response(
        {
            "redirect_url": callback(
                authorization.redirect_uri, code=code, state=authorization.state, iss=origin()
            )
        }
    )


def issue_tokens(connection: AgentConnection):
    access, refresh = "pf_agent_" + secret(), secret()
    connection.token_hash = token_hash(access)
    connection.refresh_hash = token_hash(refresh)
    connection.expires_at = utcnow() + timedelta(hours=1)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "expires_in": 3600,
        "scope": " ".join(connection.scopes),
    }


@oauth_router.post("/oauth/token")
async def exchange_token(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    client_id = str(form.get("client_id", ""))
    resource = form.get("resource")
    if resource is not None and resource != get_settings().mcp_url:
        return oauth_error("Resource does not match", "invalid_target")
    if form.get("grant_type") == "authorization_code":
        code = db.scalar(
            select(AgentAuthorization)
            .where(
                AgentAuthorization.code_hash == token_hash(str(form.get("code", ""))),
                AgentAuthorization.consumed_at.is_(None),
                AgentAuthorization.expires_at > utcnow(),
            )
            .with_for_update()
        )
        verifier = str(form.get("code_verifier", ""))
        if (
            not code
            or code.client_id != client_id
            or code.redirect_uri != form.get("redirect_uri")
            or not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier)
            or not secrets.compare_digest(challenge(verifier), code.code_challenge)
        ):
            return oauth_error("Invalid or expired authorization code", "invalid_grant")
        try:
            membership_for(db, code.workspace_id, code.user_id)
        except HTTPException:
            return oauth_error("Workspace access revoked", "invalid_grant")
        user = db.get(User, code.user_id)
        if not user or not user.is_active:
            return oauth_error("User access revoked", "invalid_grant")
        code.consumed_at = utcnow()
        client = db.get(AgentClient, client_id)
        connection = AgentConnection(
            user_id=code.user_id,
            workspace_id=code.workspace_id,
            client_id=client_id,
            name=client.name,
            scopes=code.scopes,
            resource=code.resource,
            grant_expires_at=utcnow() + timedelta(days=90),
        )
        data = issue_tokens(connection)
        db.add(connection)
    elif form.get("grant_type") == "refresh_token":
        connection = db.scalar(
            select(AgentConnection)
            .where(
                AgentConnection.refresh_hash == token_hash(str(form.get("refresh_token", ""))),
                AgentConnection.client_id == client_id,
                AgentConnection.revoked_at.is_(None),
                AgentConnection.grant_expires_at > utcnow(),
            )
            .with_for_update()
        )
        if not connection:
            return oauth_error("Invalid or expired refresh token", "invalid_grant")
        try:
            membership_for(db, connection.workspace_id, connection.user_id)
        except HTTPException:
            return oauth_error("Workspace access revoked", "invalid_grant")
        user = db.get(User, connection.user_id)
        if not user or not user.is_active:
            return oauth_error("User access revoked", "invalid_grant")
        requested = str(form.get("scope", "")).split()
        if requested and (
            "postflow:read" not in requested or not set(requested).issubset(connection.scopes)
        ):
            return oauth_error("Refresh cannot expand permissions", "invalid_scope")
        if requested:
            connection.scopes = requested
        data = issue_tokens(connection)
    else:
        return oauth_error("Unsupported grant type", "unsupported_grant_type")
    db.commit()
    return secure_response(data)


@oauth_router.post("/oauth/revoke")
async def revoke_token(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    hashed = token_hash(str(form.get("token", "")))
    connection = db.scalar(
        select(AgentConnection)
        .where(
            (AgentConnection.token_hash == hashed) | (AgentConnection.refresh_hash == hashed),
            AgentConnection.client_id == str(form.get("client_id", "")),
        )
        .with_for_update()
    )
    if connection:
        connection.revoked_at = utcnow()
        db.commit()
    return secure_response({})


def connection_data(connection):
    return {
        "id": connection.id,
        "name": connection.name,
        "scopes": connection.scopes,
        "created_at": connection.created_at.isoformat(),
        "expires_at": connection.grant_expires_at.isoformat(),
        "last_used_at": connection.last_used_at.isoformat() if connection.last_used_at else None,
        "kind": "oauth" if connection.client_id else "token",
    }


@router.get("/connections")
def connections(
    response: Response,
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    membership = membership_for(db, workspace.id, user.id)
    rows = db.scalars(
        select(AgentConnection)
        .where(
            AgentConnection.user_id == user.id,
            AgentConnection.workspace_id == workspace.id,
            AgentConnection.revoked_at.is_(None),
            AgentConnection.grant_expires_at > utcnow(),
        )
        .order_by(AgentConnection.created_at.desc())
        .limit(100)
    )
    return {
        "mcp_url": get_settings().mcp_url,
        "scopes": SCOPES,
        "can_write": membership.role in EDIT_ROLES,
        "connections": [connection_data(row) for row in rows],
    }


class TokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    scopes: list[str] = Field(default_factory=lambda: ["postflow:read"], min_length=1, max_length=4)


@router.post("/connections", status_code=201)
def create_connection(
    payload: TokenCreate,
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scopes = list(dict.fromkeys(payload.scopes))
    if set(scopes) - SCOPES.keys() or "postflow:read" not in scopes:
        raise HTTPException(422, "Choose supported scopes, including postflow:read")
    membership = membership_for(db, workspace.id, user.id)
    if set(scopes) - {"postflow:read"} and membership.role not in EDIT_ROLES:
        raise HTTPException(403, "Editor role required")
    count = db.scalar(
        select(func.count())
        .select_from(AgentConnection)
        .where(
            AgentConnection.user_id == user.id,
            AgentConnection.workspace_id == workspace.id,
            AgentConnection.revoked_at.is_(None),
            AgentConnection.grant_expires_at > utcnow(),
        )
    )
    if count >= 20:
        raise HTTPException(409, "Revoke an existing connection before creating another")
    raw = "pf_agent_" + secret()
    connection = AgentConnection(
        name=payload.name,
        scopes=scopes,
        user_id=user.id,
        workspace_id=workspace.id,
        token_hash=token_hash(raw),
        resource=get_settings().mcp_url,
        expires_at=utcnow() + timedelta(days=90),
        grant_expires_at=utcnow() + timedelta(days=90),
    )
    db.add(connection)
    db.commit()
    return secure_response({"connection": connection_data(connection), "token": raw}, 201)


@router.delete("/connections/{connection_id}")
def disconnect(
    connection_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    connection = db.scalar(
        select(AgentConnection)
        .where(
            AgentConnection.id == connection_id,
            AgentConnection.workspace_id == workspace.id,
            AgentConnection.user_id == user.id,
        )
        .with_for_update()
    )
    if not connection:
        raise HTTPException(404, "Agent connection not found")
    connection.revoked_at = utcnow()
    db.commit()
    return {"revoked": True}
