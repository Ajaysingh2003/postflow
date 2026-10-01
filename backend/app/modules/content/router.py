from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_current_workspace, require_content_access
from app.db.session import get_db
from app.modules.content.models import Post, PostVariant
from app.modules.content.schemas import (
    PostCreate,
    PostResponse,
    PostUpdate,
)
from app.modules.identity.models import User, Workspace

router = APIRouter(tags=["content"], dependencies=[Depends(require_content_access)])


def _post(db: Session, workspace_id: str, post_id: str, lock: bool = False) -> Post:
    query = select(Post).where(Post.id == post_id, Post.workspace_id == workspace_id)
    post = db.scalar(query.with_for_update() if lock else query)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/posts", response_model=PostResponse, status_code=201)
def create_post(
    payload: PostCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> Post:
    text = payload.base_text or payload.content or ""
    post = Post(
        workspace_id=workspace.id,
        author_id=user.id,
        title=payload.title,
        base_text=text,
        status=payload.status,
    )
    db.add(post)
    db.flush()

    for v_in in payload.variants:
        variant = PostVariant(
            post_id=post.id,
            connected_account_id=v_in.connected_account_id,
            platform=v_in.platform,
            payload=v_in.payload,
            scheduled_time=v_in.scheduled_time,
            status="draft",
            idempotency_key=v_in.idempotency_key or str(uuid4()),
        )
        db.add(variant)

    db.commit()
    db.refresh(post)
    return post


@router.get("/posts", response_model=list[PostResponse])
def list_posts(
    workspace: Workspace = Depends(get_current_workspace), db: Session = Depends(get_db)
) -> list[Post]:
    return list(
        db.scalars(
            select(Post)
            .where(Post.workspace_id == workspace.id)
            .order_by(Post.updated_at.desc())
            .limit(200)
        )
    )


@router.get("/posts/{post_id}", response_model=PostResponse)
def get_post(
    post_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> Post:
    return _post(db, workspace.id, post_id)


@router.patch("/posts/{post_id}", response_model=PostResponse)
def update_post(
    post_id: str,
    payload: PostUpdate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> Post:
    post = _post(db, workspace.id, post_id, lock=True)
    if payload.title is not None:
        post.title = payload.title
    if payload.status is not None:
        post.status = payload.status
    new_text = payload.base_text if payload.base_text is not None else payload.content
    if new_text is not None:
        post.base_text = new_text

    db.commit()
    db.refresh(post)
    return post


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(
    post_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> None:
    post = _post(db, workspace.id, post_id)
    db.delete(post)
    db.commit()
