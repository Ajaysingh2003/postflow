import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_workspace, require_content_access
from app.core.security import as_utc
from app.db.session import get_db
from app.modules.channels.adapters.reddit import RedditAdapter
from app.modules.channels.models import ConnectedAccount, SubredditProfile
from app.modules.workspaces.models import Workspace

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/channels/reddit",
    tags=["reddit"],
    dependencies=[Depends(require_content_access)],
)


class RedditPreviewRequest(BaseModel):
    subreddit: str = Field(..., description="Target subreddit name, e.g. 'programming'")
    title: str = Field(..., max_length=300, description="Post title")
    body: str = Field(default="", max_length=40000, description="Post Markdown body")
    post_type: Literal["text", "link"] = "text"
    url: str | None = Field(default=None, description="External URL or media asset URL")
    flair_id: str | None = Field(default=None, description="Selected flair template ID")


def _get_workspace_reddit_account(
    db: Session, workspace_id: str, account_id: str
) -> ConnectedAccount:
    account = db.scalar(
        select(ConnectedAccount).where(
            ConnectedAccount.id == account_id,
            ConnectedAccount.workspace_id == workspace_id,
            ConnectedAccount.platform == "reddit",
        )
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reddit account not found in current workspace",
        )
    if account.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reddit account is {account.status}; please reconnect",
        )
    return account


@router.get("/{account_id}/subreddits/{name}")
async def get_subreddit_profile(
    account_id: str,
    name: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return fresh community requirements for the account's editor and assistant."""
    account = _get_workspace_reddit_account(db, workspace.id, account_id)
    clean_name = name.strip().removeprefix("r/").lower()
    if not re.fullmatch(r"[a-z0-9_]{2,21}", clean_name):
        raise HTTPException(422, "Enter a valid subreddit name")
    profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == clean_name))
    if (
        not profile
        or not profile.fetched_at
        or as_utc(profile.fetched_at) < datetime.now(UTC) - timedelta(hours=24)
    ):
        profile = await RedditAdapter().refresh_subreddit_profile(db, account, clean_name)
    return {
        "name": profile.name,
        "rules": profile.rules,
        "allowed_post_types": profile.allowed_post_types,
        "flair_required": profile.flair_required,
        "available_flairs": profile.available_flairs,
        "title_requirements": profile.title_requirements,
        "fetched_at": profile.fetched_at,
    }


@router.post("/{account_id}/preview")
def generate_reddit_preview(
    account_id: str,
    payload: RedditPreviewRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate a Reddit-style post preview payload for frontend rendering.
    """
    account = _get_workspace_reddit_account(db, workspace.id, account_id)
    clean_sub = payload.subreddit.strip().removeprefix("r/").lower()
    sub_profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == clean_sub))

    adapter = RedditAdapter()
    return adapter.generate_preview(
        payload=payload.model_dump(),
        subreddit_profile=sub_profile,
        author_name=account.display_name or "u/your_user",
    )
