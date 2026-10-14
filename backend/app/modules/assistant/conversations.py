"""Private, persistent writing conversations and idempotent, context-aware turns."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_current_workspace, require_content_access
from app.db.session import get_db
from app.modules.assistant.models import AssistantConversation, AssistantTurn
from app.modules.assistant.schemas import ExecuteFeatureRequest, ExecuteFeatureResponse
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace, WorkspaceMembership

router = APIRouter(
    prefix="/assistant/conversations",
    tags=["assistant"],
    dependencies=[Depends(require_content_access)],
)


class ChatContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_text: str = Field(default="", max_length=10000)
    origin_scope: str = Field(default="", max_length=2000)
    account_name: str = Field(default="", max_length=240)
    draft_id: str | None = Field(default=None, max_length=36)


class ChatCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(default_factory=lambda: str(uuid4()), min_length=36, max_length=36)
    title: str = Field(min_length=1, max_length=160)
    platform: str = Field(max_length=32)
    connected_account_id: str | None = None
    context: ChatContext = Field(default_factory=ChatContext)


class ContinueChat(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prompt: str = Field(min_length=3, max_length=10000)
    request_id: str = Field(min_length=36, max_length=36)


def owned_chat(db, workspace_id, user_id, conversation_id):
    chat = db.scalar(
        select(AssistantConversation).where(
            AssistantConversation.id == conversation_id,
            AssistantConversation.workspace_id == workspace_id,
            AssistantConversation.user_id == user_id,
        )
    )
    if chat is None:
        raise HTTPException(404, "Conversation not found")
    return chat


def summary(chat, include_context=False):
    return {
        "id": chat.id,
        "title": chat.title,
        "platform": chat.platform,
        "connected_account_id": chat.connected_account_id,
        "context": chat.context
        if include_context
        else {"account_name": chat.context.get("account_name", "")},
        "turn_count": chat.turn_count,
        "created_at": chat.created_at.replace(tzinfo=UTC),
        "updated_at": chat.updated_at.replace(tzinfo=UTC),
    }


@router.post("", status_code=201)
def create_chat(
    payload: ChatCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    channel_registry.require(payload.platform)
    db.scalar(select(Workspace).where(Workspace.id == workspace.id).with_for_update())
    existing = db.get(AssistantConversation, payload.id)
    if existing:
        return summary(owned_chat(db, workspace.id, user.id, payload.id), True)
    if payload.connected_account_id:
        account = db.scalar(
            select(ConnectedAccount).where(
                ConnectedAccount.id == payload.connected_account_id,
                ConnectedAccount.workspace_id == workspace.id,
                ConnectedAccount.platform == payload.platform,
            )
        )
        if account is None:
            raise HTTPException(404, "Connected account not found in this workspace/platform")
    chat = AssistantConversation(
        **payload.model_dump(exclude={"context"}),
        context={
            **payload.context.model_dump(),
            "connected_account_id": payload.connected_account_id,
        },
        workspace_id=workspace.id,
        user_id=user.id,
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return summary(chat, True)


@router.get("")
def list_chats(
    search: str = Query(default="", max_length=160),
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=30, ge=1, le=50),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    query = select(AssistantConversation).where(
        AssistantConversation.workspace_id == workspace.id,
        AssistantConversation.user_id == user.id,
        AssistantConversation.turn_count > 0,
    )
    if search.strip():
        query = query.where(AssistantConversation.title.icontains(search.strip(), autoescape=True))
    chats = list(
        db.scalars(
            query.order_by(AssistantConversation.updated_at.desc(), AssistantConversation.id.desc())
            .offset(cursor)
            .limit(limit + 1)
        )
    )
    return {
        "items": [summary(chat) for chat in chats[:limit]],
        "next_cursor": cursor + limit if len(chats) > limit else None,
    }


@router.get("/{conversation_id}")
def read_chat(
    conversation_id: str,
    cursor: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    membership: WorkspaceMembership = Depends(require_content_access),
    db: Session = Depends(get_db),
):
    chat = owned_chat(db, workspace.id, user.id, conversation_id)
    query = select(AssistantTurn).where(AssistantTurn.conversation_id == chat.id)
    if cursor:
        query = query.where(AssistantTurn.sequence < cursor)
    turns = list(db.scalars(query.order_by(AssistantTurn.sequence.desc()).limit(limit + 1)))
    page = list(reversed(turns[:limit]))
    original_account_id = chat.context.get("connected_account_id")
    original_account = (
        db.get(ConnectedAccount, original_account_id) if original_account_id else None
    )
    account_available = not original_account_id or (
        original_account is not None and original_account.status == "active"
    )
    return {
        **summary(chat, True),
        "can_continue": membership.role in {"owner", "admin", "editor"} and account_available,
        "continue_notice": None
        if account_available
        else "Reconnect this account or start a new conversation to use another channel.",
        "turns": [
            {
                "id": turn.id,
                "request_id": turn.request_id,
                "sequence": turn.sequence,
                "prompt": turn.prompt,
                "original_text": turn.original_text,
                "response_data": turn.response_data,
                "status": turn.status,
                "error": turn.error,
                "created_at": turn.created_at.replace(tzinfo=UTC),
            }
            for turn in page
        ],
        "next_cursor": page[0].sequence if len(turns) > limit else None,
    }


def output_text(output):
    if isinstance(output.get("rewritten_text"), str):
        return output["rewritten_text"]
    tweets = output.get("tweets")
    return (
        "\n\n".join(tweets)
        if isinstance(tweets, list) and all(isinstance(text, str) for text in tweets)
        else ""
    )


async def execute_turn(db, workspace_id, user_id, feature_id, payload, llm=None):
    from app.modules.assistant.service import execute_feature

    if (
        not payload.request_id
        or not payload.conversation_id
        or not payload.conversation_prompt.strip()
    ):
        raise HTTPException(422, "Conversation ID, request ID and prompt are required")
    if feature_id not in {"rewrite_with_tone", "x_thread_writer"}:
        raise HTTPException(422, "This feature is not a writing conversation")
    if len(json.dumps(payload.model_dump())) > 80000:
        raise HTTPException(413, "Conversation input is too large")
    db.scalar(select(Workspace).where(Workspace.id == workspace_id).with_for_update())
    chat = owned_chat(db, workspace_id, user_id, payload.conversation_id)
    if (
        payload.platform != chat.platform
        or payload.connected_account_id != chat.connected_account_id
    ):
        raise HTTPException(422, "Use the conversation’s original channel and account")
    if payload.connected_account_id:
        account = db.get(ConnectedAccount, payload.connected_account_id)
        if account is None or account.workspace_id != workspace_id or account.status != "active":
            raise HTTPException(
                409, "Reconnect this account or start a new conversation to use another channel"
            )
    request_data = {"feature_id": feature_id, **payload.model_dump()}
    prior = db.scalar(
        select(AssistantTurn).where(
            AssistantTurn.conversation_id == chat.id, AssistantTurn.request_id == payload.request_id
        )
    )
    if prior:
        if prior.request_data != request_data:
            raise HTTPException(409, "This message ID was already used for another request")
        if prior.status == "succeeded":
            return prior.response_data
        raise HTTPException(
            409,
            "This message is still running or already finished. Refresh the conversation before retrying.",
        )
    now = datetime.now(UTC)
    running = list(
        db.scalars(
            select(AssistantTurn).where(
                AssistantTurn.conversation_id == chat.id, AssistantTurn.status == "running"
            )
        )
    )
    for turn in running:
        if turn.created_at.replace(tzinfo=UTC) > now - timedelta(minutes=5):
            raise HTTPException(409, "Wait for the current reply before sending another message")
        turn.status = "failed"
        turn.error = "This response was interrupted. Send a new message to continue."
    previous = list(
        reversed(
            list(
                db.scalars(
                    select(AssistantTurn)
                    .where(
                        AssistantTurn.conversation_id == chat.id,
                        AssistantTurn.status == "succeeded",
                    )
                    .order_by(AssistantTurn.sequence.desc())
                    .limit(6)
                )
            )
        )
    )
    history = []
    for turn in previous:
        history.extend(
            [
                {"role": "user", "content": turn.prompt[:2000]},
                {
                    "role": "assistant",
                    "content": json.dumps(turn.response_data.get("output", {}), ensure_ascii=False)[
                        :5000
                    ],
                },
            ]
        )
    chat.turn_count += 1
    chat.updated_at = now
    turn = AssistantTurn(
        conversation_id=chat.id,
        request_id=payload.request_id,
        sequence=chat.turn_count,
        prompt=payload.conversation_prompt,
        original_text=payload.conversation_source,
        request_data=request_data,
        response_data={},
        status="running",
    )
    db.add(turn)
    db.commit()
    try:
        output, issues, record = await execute_feature(
            workspace_id,
            user_id,
            feature_id,
            payload.input_data,
            platform=chat.platform,
            voice_profile_id=payload.voice_profile_id,
            db=db,
            llm=llm,
            connected_account_id=payload.connected_account_id,
            validation_context=payload.validation_context,
            writing_instructions=payload.writing_instructions,
            output_language=payload.output_language,
            conversation_history=history,
        )
        response = ExecuteFeatureResponse(
            feature_id=feature_id,
            platform=record.platform,
            output=output,
            tokens_used=record.tokens_used,
            validation_issues=[issue.model_dump() for issue in issues],
        ).model_dump()
        turn.response_data = response
        turn.status = "succeeded"
        chat.updated_at = datetime.now(UTC)
        db.commit()
        return response
    except (Exception, asyncio.CancelledError) as exc:
        db.rollback()
        turn.status = "failed"
        turn.error = (
            str(exc.detail)[:500]
            if isinstance(exc, HTTPException)
            else "The assistant couldn’t finish this reply. Please retry."
        )
        chat.updated_at = datetime.now(UTC)
        db.add(turn)
        db.commit()
        raise


@router.post("/{conversation_id}/messages", response_model=ExecuteFeatureResponse)
async def continue_chat(
    conversation_id: str,
    payload: ContinueChat,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    chat = owned_chat(db, workspace.id, user.id, conversation_id)
    # A retry reuses exactly the original request, even if another turn finished meanwhile.
    prior = db.scalar(
        select(AssistantTurn).where(
            AssistantTurn.conversation_id == chat.id, AssistantTurn.request_id == payload.request_id
        )
    )
    if prior:
        if prior.prompt != payload.prompt:
            raise HTTPException(409, "This message ID was already used for another prompt")
        request = dict(prior.request_data)
    else:
        last = db.scalar(
            select(AssistantTurn)
            .where(AssistantTurn.conversation_id == chat.id)
            .order_by(AssistantTurn.sequence.desc())
        )
        if last is None:
            raise HTTPException(422, "Send the first message from its draft context")
        request = dict(last.request_data)
        successful = db.scalar(
            select(AssistantTurn)
            .where(AssistantTurn.conversation_id == chat.id, AssistantTurn.status == "succeeded")
            .order_by(AssistantTurn.sequence.desc())
        )
        source = (
            output_text(successful.response_data.get("output", {}))
            if successful
            else chat.context.get("source_text", "")
        )
        request.update(
            request_id=payload.request_id,
            conversation_prompt=payload.prompt,
            conversation_source=source,
        )
        request["input_data"] = {
            **request["input_data"],
            "text": (source or payload.prompt)[:10000],
        }
        if request["feature_id"] == "rewrite_with_tone":
            request["input_data"]["tone"] = payload.prompt
        else:
            request["writing_instructions"] = payload.prompt[:2000]
    feature = request.pop("feature_id")
    return await execute_turn(
        db, workspace.id, user.id, feature, ExecuteFeatureRequest.model_validate(request)
    )
