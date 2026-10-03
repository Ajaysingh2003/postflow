"""User-triggered edits and replies for this workspace's published posts."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.dependencies import get_current_workspace, require_content_access
from app.db.session import get_db
from app.modules.billing.usage import lock_workspace, reserve_provider_cost
from app.modules.channels.management_types import ManagedResult, PostActions, RepliesPage
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.oauth import decrypt_token, encrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant
from app.modules.publishing.models import PublishAttempt
from app.modules.publishing.service import validate_variant

router = APIRouter(prefix="/post-management", tags=["post management"], dependencies=[Depends(require_content_access)])


class ManageRequest(BaseModel):
    request_id: UUID
    text: str = Field(min_length=1, max_length=50000)
    target_token: str | None = Field(default=None, max_length=10000)


class DeleteRequest(BaseModel):
    request_id: UUID


def owned_variant(db, workspace_id, variant_id):
    variant = db.scalar(select(PostVariant).join(Post).where(PostVariant.id == variant_id, Post.workspace_id == workspace_id))
    if not variant:
        raise HTTPException(404, "Post variant not found")
    account = db.scalar(select(ConnectedAccount).where(ConnectedAccount.id == variant.connected_account_id, ConnectedAccount.workspace_id == workspace_id, ConnectedAccount.platform == variant.platform))
    if not account:
        raise HTTPException(404, "Connected account not found")
    if not variant.external_post_id or variant.status != "published":
        raise HTTPException(409, "This post has not been published or was deleted")
    return variant, account, channel_registry.require(variant.platform)


def actions_for(adapter, account, variant):
    actions = adapter.post_actions(account, variant)
    if account.status != "active":
        actions.can_edit = actions.can_reply = actions.can_delete = actions.can_read_replies = False
        actions.notices.append("Reconnect this account to manage the post.")
    if (variant.publish_state or {}).get("management_pending"):
        actions.can_edit = actions.can_reply = actions.can_delete = False
        actions.notices.append("A previous action is unresolved. Check the original platform before sending another action.")
    if (variant.publish_state or {}).get("thread_ids") or (variant.publish_state or {}).get("thread_posts"):
        actions.can_edit = actions.can_delete = False
        actions.notices.append("Thread edits/deletion must be managed on the original platform; this view manages replies to the saved root post.")
    return actions


@router.get("/variants/{variant_id}/actions", response_model=PostActions)
async def actions(variant_id: str, workspace=Depends(get_current_workspace), db=Depends(get_db), membership=Depends(require_content_access)):
    variant, account, adapter = owned_variant(db, workspace.id, variant_id)
    result = actions_for(adapter, account, variant)
    if membership.role not in {"owner", "admin", "editor"}:
        result.can_reply = result.can_edit = result.can_delete = False
        result.notices.append("Your workspace role allows viewing only.")
    if not result.external_url and account.status == "active":
        try:
            result.external_url = await adapter.original_post_url(account, variant)
        except (httpx.HTTPError, ValueError, KeyError):
            result.notices.append("The original post link could not be loaded. Reconnect or open your profile on the platform.")
    return result


@router.get("/variants/{variant_id}/replies", response_model=RepliesPage)
async def replies(variant_id: str, cursor: str | None = Query(default=None, max_length=2000), workspace=Depends(get_current_workspace), db=Depends(get_db)):
    variant, account, adapter = owned_variant(db, workspace.id, variant_id)
    if not actions_for(adapter, account, variant).can_read_replies:
        raise HTTPException(422, "Reading replies requires supported platform access and permissions")
    try:
        page = await adapter.list_post_replies(account, variant, cursor)
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(502, "The platform could not load replies. Check permissions or open the original post.") from exc
    for reply in page.items:
        reply.target_token = encrypt_token(json.dumps({"workspace": workspace.id, "variant": variant.id, "id": reply.id, "metadata": reply.metadata, "expires": (datetime.now(UTC) + timedelta(hours=1)).timestamp()}))
    return page


def parent_from_token(token, workspace_id, variant_id):
    if not token:
        return None
    try:
        data = json.loads(decrypt_token(token))
        if data["workspace"] != workspace_id or data["variant"] != variant_id or data["expires"] < datetime.now(UTC).timestamp():
            raise ValueError("Invalid target")
        return data
    except (ValueError, KeyError, TypeError, HTTPException) as exc:
        raise HTTPException(422, "Reply target expired or belongs to another post. Reload replies.") from exc


async def perform(db, workspace_id, variant_id, action, request_id, text="", target_token=None):
    lock_workspace(db, workspace_id)
    variant, account, adapter = owned_variant(db, workspace_id, variant_id)
    key = str(request_id)
    digest = hashlib.sha256(json.dumps([action, text, target_token], separators=(",", ":")).encode()).hexdigest()
    state = dict(variant.publish_state or {})
    prior = state.get("management_requests", {}).get(key)
    if prior:
        if prior["digest"] != digest:
            raise HTTPException(409, "This request ID was used for a different action")
        if prior.get("result"):
            return ManagedResult.model_validate(prior["result"])
        raise HTTPException(409, "This action is pending or unresolved. Check the original platform before retrying.")
    capabilities = actions_for(adapter, account, variant)
    if not getattr(capabilities, "can_" + action):
        raise HTTPException(422, "This action is unavailable. Reconnect with the required permissions or manage it on the platform.")
    parent = parent_from_token(target_token, workspace_id, variant_id) if action == "reply" else None
    if action == "reply" and capabilities.reply_requires_parent and parent is None:
        raise HTTPException(422, "Choose a comment to reply to")
    if action != "delete" and not text.strip():
        raise HTTPException(422, "Write some text first")
    if action == "reply" and adapter.reply_text_length(text) > capabilities.max_reply_length:
        raise HTTPException(422, f"Reply exceeds {capabilities.max_reply_length} characters")
    if action == "edit":
        candidate = SimpleNamespace(payload={**variant.payload, capabilities.edit_field: text}, media_asset_ids=variant.media_asset_ids, media_links=variant.media_links, id=variant.id, post_id=variant.post_id, connected_account_id=variant.connected_account_id, platform=variant.platform)
        issues = await validate_variant(candidate, db)
        if any(issue.severity == "error" for issue in issues):
            raise HTTPException(422, "; ".join(issue.message for issue in issues if issue.severity == "error"))
    if action == "reply" and getattr(adapter, "publishing_budget", None):
        fake = SimpleNamespace(platform=variant.platform, id=f"{variant.id}:{key}", payload={"text": text})
        reserve_provider_cost(db, workspace_id, fake, adapter.publishing_cost(fake), adapter.publishing_budget())
    if len(state.get("management_requests", {})) >= 1000:
        raise HTTPException(409, "This post's action log is full; continue management on the original platform")
    state["management_pending"] = key
    state["management_requests"] = {**state.get("management_requests", {}), key: {"digest": digest, "action": action, "started_at": datetime.now(UTC).isoformat()}}
    variant.publish_state = state
    attempt = PublishAttempt(variant_id=variant.id, started_at=datetime.now(UTC), result=action + "_pending", response_payload={"request_id": key})
    db.add(attempt)
    db.commit()
    # The JSON column holds the assigned object. Detach the next mutations so
    # SQLAlchemy observes the final state rather than an in-place nested edit.
    state = json.loads(json.dumps(state))
    try:
        if action == "reply":
            result = await adapter.reply_to_post(account, variant, text, parent, key)
            if not result.external_id:
                raise RuntimeError("The platform returned no reply identifier")
        elif action == "edit":
            result = await adapter.edit_published_post(account, variant, text)
            variant.payload = {**variant.payload, capabilities.edit_field: text}
            if result.external_id:
                variant.external_post_id = result.external_id
        else:
            await adapter.delete_published_post(account, variant)
            variant.status = "deleted"
            result = ManagedResult(message="Post deleted from the platform")
    except Exception as exc:
        known = isinstance(exc, HTTPException) and exc.status_code < 500 or isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500
        attempt.result = action + ("_failed" if known else "_unknown")
        attempt.error = "Platform rejected the action" if known else "Action outcome is uncertain; check the original platform"
        attempt.finished_at = datetime.now(UTC)
        if known:
            state.pop("management_pending", None)
        if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 401:
            account.status = "needs_reauth"
        variant.publish_state = dict(state)
        db.commit()
        if isinstance(exc, HTTPException) and known:
            raise
        raise HTTPException(502, attempt.error) from exc
    state.pop("management_pending", None)
    state["management_requests"][key]["result"] = result.model_dump()
    variant.publish_state = dict(state)
    attempt.result = action + "_succeeded"
    attempt.finished_at = datetime.now(UTC)
    attempt.response_payload = {"request_id": key, **result.model_dump()}
    db.commit()
    return result


@router.post("/variants/{variant_id}/reply", response_model=ManagedResult)
async def send_reply(variant_id: str, payload: ManageRequest, workspace=Depends(get_current_workspace), db=Depends(get_db)):
    return await perform(db, workspace.id, variant_id, "reply", payload.request_id, payload.text, payload.target_token)


@router.patch("/variants/{variant_id}/published", response_model=ManagedResult)
async def edit_post(variant_id: str, payload: ManageRequest, workspace=Depends(get_current_workspace), db=Depends(get_db)):
    return await perform(db, workspace.id, variant_id, "edit", payload.request_id, payload.text)


@router.post("/variants/{variant_id}/delete-published", response_model=ManagedResult)
async def delete_post(variant_id: str, payload: DeleteRequest, workspace=Depends(get_current_workspace), db=Depends(get_db)):
    return await perform(db, workspace.id, variant_id, "delete", payload.request_id)
