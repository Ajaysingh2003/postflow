from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_current_user, get_current_workspace, require_content_access
from app.db.session import get_db
from app.modules.channels.models import ConnectedAccount
from app.modules.channels.registry import channel_registry
from app.modules.content.models import ContentTemplate, Post, PostVariant, PostVariantMedia
from app.modules.content.schemas import (
    HomeSummary,
    PostCreate,
    PostLibraryItem,
    PostLibraryPage,
    PostResponse,
    PostUpdate,
    PostVariantCreate,
    PostVariantResponse,
    PostVariantUpdate,
    TemplateCreate,
    TemplateResponse,
)
from app.modules.identity.models import User, Workspace
from app.modules.media.models import MediaAsset
from app.modules.workspaces.models import WorkspaceMembership

router = APIRouter(tags=["content"], dependencies=[Depends(require_content_access)])


def _account(db, workspace_id, platform, account_id):
    channel_registry.require(platform)
    if account_id:
        account = db.scalar(
            select(ConnectedAccount).where(
                ConnectedAccount.id == account_id,
                ConnectedAccount.workspace_id == workspace_id,
                ConnectedAccount.platform == platform,
            )
        )
        if account is None:
            raise HTTPException(404, "Connected account not found in this workspace/platform")


def _media(db, workspace_id, variant, ids):
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "Duplicate media attachments")
    assets = [
        db.scalar(
            select(MediaAsset).where(
                MediaAsset.id == aid,
                MediaAsset.workspace_id == workspace_id,
                MediaAsset.status == "ready",
            )
        )
        for aid in ids
    ]
    if any(asset is None for asset in assets):
        raise HTTPException(422, "Attachments must be ready assets in this workspace")
    # Keep existing links: inserting replacements before orphan deletion violates
    # the unique variant/asset constraint on every save of an attached draft.
    existing = {link.media_asset_id: link for link in variant.media_links}
    links = []
    for i, asset in enumerate(assets):
        link = existing.get(asset.id) or PostVariantMedia(media_asset_id=asset.id)
        link.order_index = i
        link.alt_text = asset.alt_text
        links.append(link)
    variant.media_links = links


def _variant(db, workspace_id, variant_id):
    variant = db.scalar(
        select(PostVariant)
        .join(Post)
        .where(PostVariant.id == variant_id, Post.workspace_id == workspace_id)
        .with_for_update()
    )
    if variant is None:
        raise HTTPException(404, "Variant not found")
    return variant


def _editable(variant):
    if (
        variant.status not in {"draft", "failed", "rejected"}
        or (variant.publish_state or {}).get("outcome_unknown")
        or (variant.publish_state or {}).get("thread_ids")
        or (variant.publish_state or {}).get("thread_posts")
    ):
        raise HTTPException(409, "Cancel the schedule or reconcile publication before editing")


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
        _account(db, workspace.id, v_in.platform, v_in.connected_account_id)
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
        _media(db, workspace.id, variant, v_in.media_asset_ids)

    db.commit()
    db.refresh(post)
    return post


@router.get("/posts", response_model=list[PostResponse])
def list_posts(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    variant_status: str | None = Query(default=None),
    connected_account_id: str | None = Query(default=None),
) -> list[Post]:
    query = select(Post).where(Post.workspace_id == workspace.id)
    conditions = []
    if variant_status:
        conditions.append(PostVariant.status.in_(variant_status.split(",")))
    if connected_account_id:
        conditions.append(PostVariant.connected_account_id == connected_account_id)
    if conditions:
        from sqlalchemy import and_

        query = query.where(Post.variants.any(and_(*conditions)))
    return list(
        db.scalars(
            query.options(selectinload(Post.variants).selectinload(PostVariant.media_links))
            .order_by(Post.updated_at.desc(), Post.id.asc())
            .offset(offset)
            .limit(limit)
        )
    )


@router.get("/posts/summary", response_model=dict[str, int])
def post_summary(
    connected_account_id: str | None = Query(default=None),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    query = (
        select(PostVariant.status, func.count(PostVariant.id))
        .join(Post, PostVariant.post_id == Post.id)
        .where(Post.workspace_id == workspace.id)
        .group_by(PostVariant.status)
    )
    if connected_account_id:
        query = query.where(PostVariant.connected_account_id == connected_account_id)
    return dict(db.execute(query).all())


@router.get("/posts/library", response_model=PostLibraryPage)
def post_library(
    category: Literal["posts", "scheduled", "drafts"] = Query(default="posts"),
    connected_account_id: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> PostLibraryPage:
    """Postflow's own variants only; browsing never reads a platform timeline."""
    categories = {
        "posts": ("published",),
        "scheduled": ("scheduled", "publishing"),
        "drafts": ("draft", "failed", "rejected"),
    }
    conditions = [Post.workspace_id == workspace.id]
    if connected_account_id:
        conditions.append(PostVariant.connected_account_id == connected_account_id)
    statuses = dict(
        db.execute(
            select(PostVariant.status, func.count(PostVariant.id))
            .join(Post, PostVariant.post_id == Post.id)
            .where(*conditions)
            .group_by(PostVariant.status)
        ).all()
    )
    counts = {
        key: sum(statuses.get(status, 0) for status in values) for key, values in categories.items()
    }
    # Page variants, not parent posts: multiple destinations cannot change page size
    # or expose another account's payload. Media relationships are loaded in bulk.
    rows = db.execute(
        select(PostVariant, Post.title, Post.base_text)
        .join(Post, PostVariant.post_id == Post.id)
        .where(*conditions, PostVariant.status.in_(categories[category]))
        .options(selectinload(PostVariant.media_links))
        .order_by(PostVariant.updated_at.desc(), PostVariant.id.asc())
        .offset(offset)
        .limit(limit)
    ).all()
    return PostLibraryPage(
        items=[
            PostLibraryItem(
                **PostVariantResponse.model_validate(variant).model_dump(),
                title=title,
                base_text=base_text,
            )
            for variant, title, base_text in rows
        ],
        counts=counts,
        total=counts[category],
        next_offset=offset + limit if offset + limit < counts[category] else None,
    )


@router.get("/posts/home", response_model=HomeSummary)
def workspace_home(
    response: Response,
    workspace: Workspace = Depends(get_current_workspace),
    membership: WorkspaceMembership = Depends(require_content_access),
    db: Session = Depends(get_db),
) -> HomeSummary:
    from app.modules.content.home import home_summary

    response.headers["Cache-Control"] = "private, no-store"
    return home_summary(
        db,
        workspace,
        membership.role in {"owner", "admin", "editor"},
        can_manage_channels=membership.role in {"owner", "admin"},
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
    if any(v.status in {"scheduled", "publishing", "published"} for v in post.variants):
        raise HTTPException(409, "Active/published posts cannot be edited")
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


@router.post("/posts/{post_id}/variants", response_model=PostVariantResponse, status_code=201)
def add_variant(
    post_id: str,
    payload: PostVariantCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    _post(db, workspace.id, post_id, lock=True)
    _account(db, workspace.id, payload.platform, payload.connected_account_id)

    def replay():
        existing = db.scalar(
            select(PostVariant).where(PostVariant.idempotency_key == payload.idempotency_key)
        )
        if existing and (
            existing.post_id != post_id
            or existing.platform != payload.platform
            or existing.connected_account_id != payload.connected_account_id
        ):
            raise HTTPException(409, "This request key belongs to another variant")
        return existing

    if payload.idempotency_key:
        existing = replay()
        if existing:
            return existing
    variant = PostVariant(
        post_id=post_id,
        connected_account_id=payload.connected_account_id,
        platform=payload.platform,
        payload=payload.payload,
        status="draft",
        idempotency_key=payload.idempotency_key or str(uuid4()),
    )
    db.add(variant)
    _media(db, workspace.id, variant, payload.media_asset_ids)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if payload.idempotency_key and (existing := replay()):
            return existing
        raise
    db.refresh(variant)
    return variant


@router.patch("/variants/{variant_id}", response_model=PostVariantResponse)
def edit_variant(
    variant_id: str,
    payload: PostVariantUpdate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    variant = _variant(db, workspace.id, variant_id)
    _editable(variant)
    if "connected_account_id" in payload.model_fields_set:
        _account(db, workspace.id, variant.platform, payload.connected_account_id)
        variant.connected_account_id = payload.connected_account_id
    if payload.payload is not None:
        variant.payload = payload.payload
    if payload.media_asset_ids is not None:
        _media(db, workspace.id, variant, payload.media_asset_ids)
    variant.status = "draft"
    variant.publish_state = {}
    db.commit()
    db.refresh(variant)
    return variant


@router.delete("/variants/{variant_id}", status_code=204)
def delete_variant(
    variant_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    variant = _variant(db, workspace.id, variant_id)
    _editable(variant)
    db.delete(variant)
    db.commit()


@router.post("/templates", response_model=TemplateResponse, status_code=201)
def create_template(
    payload: TemplateCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    template = ContentTemplate(workspace_id=workspace.id, **payload.model_dump())
    db.add(template)
    db.commit()
    return template


@router.get("/templates", response_model=list[TemplateResponse])
def list_templates(
    workspace: Workspace = Depends(get_current_workspace), db: Session = Depends(get_db)
):
    return list(
        db.scalars(select(ContentTemplate).where(ContentTemplate.workspace_id == workspace.id))
    )


@router.patch("/templates/{template_id}", response_model=TemplateResponse)
def edit_template(
    template_id: str,
    payload: TemplateCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    template = db.scalar(
        select(ContentTemplate).where(
            ContentTemplate.id == template_id, ContentTemplate.workspace_id == workspace.id
        )
    )
    if template is None:
        raise HTTPException(404, "Template not found")
    for key, value in payload.model_dump().items():
        setattr(template, key, value)
    db.commit()
    return template


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    template = db.scalar(
        select(ContentTemplate).where(
            ContentTemplate.id == template_id, ContentTemplate.workspace_id == workspace.id
        )
    )
    if template is None:
        raise HTTPException(404, "Template not found")
    db.delete(template)
    db.commit()


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(
    post_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> None:
    post = _post(db, workspace.id, post_id, lock=True)
    for variant in post.variants:
        _editable(variant)
    db.delete(post)
    db.commit()
