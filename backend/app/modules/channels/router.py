import json
import logging
import urllib.parse
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import (
    get_current_user,
    get_current_workspace,
    membership_for,
    require_roles,
)
from app.db.session import get_db
from app.modules.channels.base import Capabilities
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import (
    create_oauth_state,
    decrypt_token,
    disconnect_account,
    encrypt_token,
    generate_pkce_pair,
    refresh_account_tokens,
    verify_and_consume_oauth_state,
)
from app.modules.channels.registry import channel_registry
from app.modules.channels.schemas import (
    AuthStartResponse,
    CallbackRequest,
    CapabilitiesListResponse,
    ConnectedAccountResponse,
    ConnectRequest,
    DisconnectResponse,
    TargetListResponse,
)
from app.modules.channels.support import require_credentials
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("/bluesky/client-metadata")
def bluesky_client_metadata():
    return channel_registry.require("bluesky").client_metadata()


@router.get("/capabilities", response_model=CapabilitiesListResponse)
def get_all_capabilities() -> CapabilitiesListResponse:
    """List capabilities and posting rules for all supported platforms."""
    return CapabilitiesListResponse(platforms=channel_registry.get_all_capabilities())


@router.get("/capabilities/{platform}", response_model=Capabilities)
def get_platform_capabilities(platform: str) -> Capabilities:
    """Get posting rules and capabilities for a specific platform."""
    adapter = channel_registry.require(platform)
    return adapter.capabilities


@router.get("/accounts", response_model=list[ConnectedAccountResponse])
def list_connected_accounts(
    platform: str | None = Query(default=None),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[ConnectedAccountResponse]:
    """List all connected accounts in the current workspace."""
    stmt = select(ConnectedAccount).where(ConnectedAccount.workspace_id == workspace.id)
    if platform:
        stmt = stmt.where(ConnectedAccount.platform == platform.lower())
    stmt = stmt.order_by(ConnectedAccount.created_at.desc())
    accounts = list(db.scalars(stmt))
    return [ConnectedAccountResponse.model_validate(acc) for acc in accounts]


@router.get("/accounts/{account_id}", response_model=ConnectedAccountResponse)
def get_connected_account(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ConnectedAccountResponse:
    """Retrieve details for a single connected account."""
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == account_id,
            ConnectedAccount.workspace_id == workspace.id,
        )
    )
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return ConnectedAccountResponse.model_validate(account)


@router.get("/accounts/{account_id}/capabilities", response_model=Capabilities)
def account_capabilities(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == account_id, ConnectedAccount.workspace_id == workspace.id
        )
    )
    if account is None:
        raise HTTPException(404, "Account not found")
    adapter = channel_registry.require(account.platform)
    hook = getattr(adapter, "account_capabilities", None)
    return hook(account) if hook else adapter.capabilities


@router.post("/{platform}/connect", response_model=AuthStartResponse)
async def start_oauth(
    platform: str,
    payload: ConnectRequest | None = None,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    _=Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> AuthStartResponse:
    """
    Start the official OAuth connection flow for a platform.
    Generates state and PKCE verifier, saving them securely.
    """
    adapter = channel_registry.require(platform)
    require_credentials(adapter, *getattr(adapter, "required_credentials", ()))
    options = dict(payload.options) if payload else {}
    redirect_uri = (payload.redirect_uri if payload else None) or get_settings().oauth_callback_url(
        platform
    )
    if (
        payload
        and payload.redirect_uri
        and payload.redirect_uri != get_settings().oauth_callback_url(platform)
    ):
        raise HTTPException(422, "OAuth redirect must match the configured callback")
    for key in (
        "db",
        "state_record",
        "workspace_id",
        "state",
        "redirect_uri",
        "code_verifier",
        "code_challenge",
    ):
        options.pop(key, None)

    # Enforce billing plan connected accounts quota
    from app.modules.billing.entitlements import check_connected_accounts_limit

    check_connected_accounts_limit(db, workspace.id)

    # Generate PKCE verifier if adapter / platform uses PKCE
    code_verifier, code_challenge = generate_pkce_pair()

    instance_domain = options.get("instance_domain")

    # Create CSRF-safe state record in db
    state_record, raw_state = create_oauth_state(
        db=db,
        workspace_id=workspace.id,
        user_id=user.id,
        platform=platform,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
        instance_domain=instance_domain,
    )

    # Ask the platform adapter to construct the official OAuth URL
    auth_start = await adapter.build_auth_url(
        workspace_id=workspace.id,
        state=raw_state,
        code_challenge=code_challenge,
        code_verifier=code_verifier,
        redirect_uri=redirect_uri,
        db=db,
        state_record=state_record,
        **options,
    )

    if auth_start.metadata.get("requested_scopes"):
        metadata = json.loads(decrypt_token(state_record.encrypted_metadata) or "{}")
        state_record.encrypted_metadata = encrypt_token(json.dumps({**metadata, "requested_scopes": auth_start.metadata["requested_scopes"]}))
        db.commit()
    return AuthStartResponse(auth_url=auth_start.auth_url, state=raw_state)


@router.post("/{platform}/callback", response_model=ConnectedAccountResponse)
async def handle_callback_post(
    platform: str,
    payload: CallbackRequest,
    db: Session = Depends(get_db),
) -> ConnectedAccountResponse:
    """
    Process OAuth callback from frontend or direct API exchange.
    Verifies and consumes state, then invokes adapter to exchange tokens.
    """
    if payload.error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth error: {payload.error} - {payload.error_description or ''}".strip(),
        )

    adapter = channel_registry.require(platform)

    # Verify and consume state (protects against replay and CSRF)
    state_record = verify_and_consume_oauth_state(db, platform, payload.state)

    membership = membership_for(db, state_record.workspace_id, state_record.user_id)
    if membership.role not in {"owner", "admin"}:
        raise HTTPException(403, "Channel administration permission was removed")
    params: dict[str, Any] = dict(payload.params)
    if payload.code:
        params["code"] = payload.code

    # Process tokens and account details via platform adapter
    account_from_adapter = await adapter.handle_callback(
        workspace_id=state_record.workspace_id,
        params=params,
        state=payload.state,
        code_verifier=state_record.code_verifier,
        redirect_uri=state_record.redirect_uri,
        instance_domain=state_record.instance_domain,
        oauth_metadata=json.loads(decrypt_token(state_record.encrypted_metadata) or "{}"),
        db=db,
    )

    # Check if this account already exists in the workspace
    existing = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.workspace_id == state_record.workspace_id,
            ConnectedAccount.platform == platform.lower(),
            ConnectedAccount.external_account_id == account_from_adapter.external_account_id,
        )
    )

    if existing:
        existing.display_name = account_from_adapter.display_name
        existing.account_type = account_from_adapter.account_type
        existing.encrypted_access_token = account_from_adapter.encrypted_access_token
        existing.encrypted_refresh_token = account_from_adapter.encrypted_refresh_token
        existing.token_expires_at = account_from_adapter.token_expires_at
        existing.granted_scopes = account_from_adapter.granted_scopes
        existing.account_metadata = account_from_adapter.account_metadata
        existing.status = "active"
        target_account = existing
    else:
        from app.modules.billing.entitlements import check_connected_accounts_limit

        check_connected_accounts_limit(db, state_record.workspace_id)
        account_from_adapter.workspace_id = state_record.workspace_id
        db.add(account_from_adapter)
        target_account = account_from_adapter

    db.commit()
    db.refresh(target_account)
    return ConnectedAccountResponse.model_validate(target_account)


@router.get("/{platform}/callback")
async def handle_callback_get(
    platform: str,
    request: Request,
    state: str = Query(...),
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    iss: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Handle direct GET callback redirects from OAuth providers."""
    query_params = dict(request.query_params)
    payload = CallbackRequest(
        code=code,
        state=state,
        error=error,
        error_description=error_description,
        params=query_params,
    )
    accept = request.headers.get("accept", "")
    is_browser = (
        "text/html" in accept
        or "application/xhtml+xml" in accept
        or not accept.startswith("application/json")
    )

    try:
        account_resp = await handle_callback_post(platform, payload, db)
        if is_browser:
            settings = get_settings()
            return RedirectResponse(
                url=f"{settings.frontend_url.rstrip('/')}/dashboard/channels?connected={platform}",
                status_code=302,
            )
        return account_resp
    except Exception as exc:
        if is_browser:
            settings = get_settings()
            err_detail = getattr(exc, "detail", str(exc))
            encoded_err = urllib.parse.quote(str(err_detail))
            return RedirectResponse(
                url=f"{settings.frontend_url.rstrip('/')}/dashboard/channels?error={encoded_err}",
                status_code=302,
            )
        raise


@router.post("/accounts/{account_id}/disconnect", response_model=DisconnectResponse)
@router.delete("/accounts/{account_id}", response_model=DisconnectResponse)
async def disconnect_channel_account(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    _=Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> DisconnectResponse:
    """Disconnect and revoke an account connection."""
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == account_id,
            ConnectedAccount.workspace_id == workspace.id,
        )
    )
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    adapter = channel_registry.get(account.platform)
    await disconnect_account(db, account, adapter)

    return DisconnectResponse(
        status="disconnected",
        account_id=account_id,
        message="Account successfully disconnected and revoked.",
    )


@router.get("/accounts/{account_id}/targets", response_model=TargetListResponse)
async def list_account_targets(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> TargetListResponse:
    """List sub-targets (Pages, subreddits) for a connected account."""
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == account_id,
            ConnectedAccount.workspace_id == workspace.id,
        )
    )
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    adapter = channel_registry.require(account.platform)
    targets = await adapter.list_targets(account)

    return TargetListResponse(
        account_id=account.id,
        platform=account.platform,
        targets=targets,
    )


@router.post("/accounts/{account_id}/refresh", response_model=ConnectedAccountResponse)
async def refresh_account(
    account_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    _=Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
) -> ConnectedAccountResponse:
    """Manually trigger token refresh for a connected account."""
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == account_id,
            ConnectedAccount.workspace_id == workspace.id,
        )
    )
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    adapter = channel_registry.require(account.platform)
    updated = await refresh_account_tokens(db, account, adapter)
    return ConnectedAccountResponse.model_validate(updated)
