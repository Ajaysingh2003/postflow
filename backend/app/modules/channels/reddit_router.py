import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_workspace, require_content_access
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


class RedditReplyRequest(BaseModel):
    parent_id: str = Field(..., description="Fullname of the comment or post to reply to (e.g. t1_abc or t3_xyz)")
    text: str = Field(..., min_length=1, max_length=10000, description="Markdown reply text")


class RedditPreviewRequest(BaseModel):
    subreddit: str = Field(..., description="Target subreddit name, e.g. 'programming'")
    title: str = Field(..., max_length=300, description="Post title")
    body: str = Field(default="", max_length=40000, description="Post Markdown body")
    post_type: str = Field(default="text", description="Post type: text, link, image, or video")
    url: str | None = Field(default=None, description="External URL or media asset URL")
    flair_id: str | None = Field(default=None, description="Selected flair template ID")


def _get_workspace_reddit_account(db: Session, workspace_id: str, account_id: str) -> ConnectedAccount:
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


@router.get("/{account_id}/inbox")
async def get_reddit_inbox_comments(
    account_id: str,
    limit: int = Query(default=25, ge=1, le=100),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Fetch recent comment inbox notifications and direct replies for the connected Reddit account.
    """
    account = _get_workspace_reddit_account(db, workspace.id, account_id)
    adapter = RedditAdapter()
    return await adapter.fetch_comments(account, external_post_id=None, limit=limit)


@router.get("/{account_id}/posts/{post_id}/comments")
async def get_reddit_post_comments(
    account_id: str,
    post_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Fetch comments on a specific published Reddit post by post ID.
    """
    account = _get_workspace_reddit_account(db, workspace.id, account_id)
    adapter = RedditAdapter()
    return await adapter.fetch_comments(account, external_post_id=post_id, limit=limit)


@router.post("/{account_id}/comments/reply")
async def post_reddit_reply(
    account_id: str,
    payload: RedditReplyRequest,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Submit a manual reply from the SaaS dashboard to a Reddit comment or submission.
    """
    account = _get_workspace_reddit_account(db, workspace.id, account_id)
    adapter = RedditAdapter()
    return await adapter.post_comment_reply(account, parent_id=payload.parent_id, text=payload.text)


@router.get("/{account_id}/conversations/search")
async def search_reddit_conversations(
    account_id: str,
    q: str = Query(..., min_length=2, description="Search keyword or topic"),
    subreddit: str | None = Query(default=None, description="Optional target subreddit filter"),
    sort: str = Query(default="relevance", description="Sort: relevance, hot, top, new, comments"),
    time_filter: str = Query(default="week", description="Time filter: hour, day, week, month, year, all"),
    limit: int = Query(default=15, ge=1, le=50),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Discover active discussions and conversations relevant to keywords or topics.
    """
    account = _get_workspace_reddit_account(db, workspace.id, account_id)
    adapter = RedditAdapter()
    return await adapter.search_discussions(
        account,
        query=q,
        subreddit=subreddit,
        sort=sort,
        time_filter=time_filter,
        limit=limit,
    )


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
    clean_sub = payload.subreddit.strip().lstrip("r/").lower()
    sub_profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == clean_sub))

    adapter = RedditAdapter()
    return adapter.generate_preview(
        payload=payload.model_dump(),
        subreddit_profile=sub_profile,
        author_name=account.display_name or "u/your_user",
    )
