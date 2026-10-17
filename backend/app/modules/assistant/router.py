"""FastAPI router for AI assistant features, platform profiles, and voice training."""

from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    get_current_workspace,
    require_content_access,
)
from app.db.session import get_db
from app.modules.assistant.brand import (
    BRAND_KIND,
    BrandCreate,
    BrandResponse,
    BrandUpdate,
    activate_brand,
    brand_response,
    check_profile_capacity,
    create_brand,
    find_brand,
    require_brand_access,
    save_brand,
)
from app.modules.assistant.conversations import execute_turn
from app.modules.assistant.models import AssistantRun, VoiceProfile
from app.modules.assistant.registry import assistant_registry
from app.modules.assistant.schemas import (
    AssistantProfileResponse,
    AssistantRunResponse,
    ExecuteFeatureRequest,
    ExecuteFeatureResponse,
    FeatureInfoResponse,
    VoiceProfileCreate,
    VoiceProfileResponse,
    VoiceProfileTrainInput,
)
from app.modules.assistant.service import execute_feature, train_voice_profile
from app.modules.identity.models import User, Workspace
from app.modules.workspaces.models import WorkspaceMembership

router = APIRouter(
    prefix="/assistant",
    tags=["assistant"],
    dependencies=[Depends(require_content_access)],
)


@router.get("/brand-profile", response_model=BrandResponse)
def get_brand_profile(
    membership: WorkspaceMembership = Depends(require_content_access),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> BrandResponse:
    return brand_response(db, workspace.id, membership.role in {"owner", "admin", "editor"})


@router.patch("/brand-profile", response_model=BrandResponse)
def update_brand_profile(
    payload: BrandUpdate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
    profile_id: str | None = Query(default=None, max_length=36),
) -> BrandResponse:
    save_brand(db, workspace.id, user.id, payload, profile_id)
    return brand_response(db, workspace.id, True)


@router.post("/brand-profiles", response_model=BrandResponse, status_code=201)
def add_brand_profile(
    payload: BrandCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    create_brand(db, workspace.id, user.id, payload.name)
    return brand_response(db, workspace.id, True)


@router.post("/brand-profiles/{profile_id}/activate", response_model=BrandResponse)
def switch_brand_profile(
    profile_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    activate_brand(db, workspace.id, profile_id)
    return brand_response(db, workspace.id, True)


@router.patch("/brand-profiles/{profile_id}/name", response_model=BrandResponse)
def rename_brand_profile(
    profile_id: str,
    payload: BrandCreate,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func

    from app.modules.billing.usage import lock_workspace

    lock_workspace(db, workspace.id)
    require_brand_access(db, workspace.id)
    profile = find_brand(db, workspace.id, profile_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "A profile name is required")
    if db.scalar(
        select(VoiceProfile.id).where(
            VoiceProfile.workspace_id == workspace.id,
            VoiceProfile.id != profile_id,
            func.lower(VoiceProfile.name) == name.lower(),
        )
    ):
        raise HTTPException(409, "A profile with this name already exists")
    profile.name = name
    profile.settings = {**profile.settings, "profile_name": name}
    db.commit()
    return brand_response(db, workspace.id, True)


@router.delete("/brand-profiles/{profile_id}", response_model=BrandResponse)
def remove_brand_profile(
    profile_id: str,
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    from app.modules.billing.usage import lock_workspace

    lock_workspace(db, workspace.id)
    profile = find_brand(db, workspace.id, profile_id)
    db.delete(profile)
    db.commit()
    return brand_response(db, workspace.id, True)


@router.post("/brand-profiles/{profile_id}/train", response_model=BrandResponse)
async def train_existing_brand(
    profile_id: str,
    payload: BrandUpdate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    from app.modules.assistant.brand import brand_details

    require_brand_access(db, workspace.id)
    profile = find_brand(db, workspace.id, profile_id)
    details = brand_details(profile)
    if not details.sample_posts:
        raise HTTPException(422, "Save at least one writing sample before training")
    revision = profile.updated_at
    if payload.expected_updated_at and payload.expected_updated_at != revision.replace(tzinfo=UTC):
        raise HTTPException(409, "Your brand profile changed. Reload it before training again.")
    output, _, _ = await execute_feature(
        workspace.id,
        user.id,
        "voice_profile_training",
        {"sample_posts": details.sample_posts},
        platform="shared",
        db=db,
    )
    # The provider call commits its credit reservation; recheck the profile revision
    # under the workspace lock before applying anything to this profile.
    db.expire_all()
    save_brand(
        db,
        workspace.id,
        user.id,
        BrandUpdate(
            style_guide=output.get("tone_description", "")[:1500],
            voice_traits=[
                value[:240] for value in output.get("style_keywords", []) if value.strip()
            ][:8],
            writing_rules="\n".join(output.get("rules", []))[:1500],
            expected_updated_at=revision.replace(tzinfo=UTC),
        ),
        profile_id,
    )
    return brand_response(db, workspace.id, True)


@router.get("/features", response_model=list[FeatureInfoResponse])
def list_features(
    platform: str | None = Query(default=None, description="Optional filter by platform name"),
) -> list[FeatureInfoResponse]:
    """List all available assistant features, optionally filtered by destination platform."""
    features = assistant_registry.list_features(platform)
    return [
        FeatureInfoResponse(
            id=f.id,
            name=f.name,
            description=f.description,
            platforms=f.platforms,
            input_schema=f.input_schema.model_json_schema(),
        )
        for f in features
    ]


@router.get("/profiles", response_model=list[AssistantProfileResponse])
def list_profiles() -> list[AssistantProfileResponse]:
    """List all platform-specific assistant profiles with style guidelines and limits."""
    profiles = assistant_registry.list_profiles()
    return [
        AssistantProfileResponse(
            platform=p.platform,
            display_name=p.display_name,
            system_instructions=p.system_instructions,
            style_guidelines=p.style_guidelines,
            character_limit=p.character_limit,
            feature_ids=p.feature_ids,
        )
        for p in profiles
    ]


@router.post("/features/{feature_id}/run", response_model=ExecuteFeatureResponse)
async def run_feature_endpoint(
    feature_id: str,
    payload: ExecuteFeatureRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ExecuteFeatureResponse:
    """Execute an AI assistant feature with schema validation, adapter checking, and usage tracking."""
    if payload.conversation_id:
        return ExecuteFeatureResponse.model_validate(
            await execute_turn(db, workspace.id, user.id, feature_id, payload)
        )
    if payload.request_id:
        raise HTTPException(422, "A conversation ID is required for this message")
    output_dict, issues, run_record = await execute_feature(
        workspace_id=workspace.id,
        user_id=user.id,
        feature_id=feature_id,
        input_data=payload.input_data,
        platform=payload.platform,
        voice_profile_id=payload.voice_profile_id,
        db=db,
        connected_account_id=payload.connected_account_id,
        validation_context=payload.validation_context,
        writing_instructions=payload.writing_instructions,
        output_language=payload.output_language,
    )
    return ExecuteFeatureResponse(
        feature_id=feature_id,
        platform=run_record.platform,
        output=output_dict,
        tokens_used=run_record.tokens_used,
        validation_issues=[i.model_dump() for i in issues],
    )


@router.post(
    "/voice-profiles", response_model=VoiceProfileResponse, status_code=status.HTTP_201_CREATED
)
def create_voice_profile_endpoint(
    payload: VoiceProfileCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VoiceProfile:
    """Manually create a voice profile for the workspace."""
    if payload.settings.get("profile_kind") == BRAND_KIND:
        raise HTTPException(422, "Use brand profile settings to update your workspace brand")
    check_profile_capacity(db, workspace.id)
    profile = VoiceProfile(
        workspace_id=workspace.id,
        user_id=user.id,
        name=payload.name,
        tone_description=payload.tone_description,
        sample_posts=payload.sample_posts,
        settings=payload.settings,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/voice-profiles", response_model=list[VoiceProfileResponse])
def list_voice_profiles_endpoint(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[VoiceProfile]:
    """List all voice profiles created for the active workspace."""
    return list(
        db.scalars(
            select(VoiceProfile)
            .where(
                VoiceProfile.workspace_id == workspace.id,
                (VoiceProfile.settings["profile_kind"].as_string().is_(None))
                | (VoiceProfile.settings["profile_kind"].as_string() != BRAND_KIND),
            )
            .order_by(VoiceProfile.created_at.desc())
        )
    )


@router.post("/voice-profiles/train", response_model=VoiceProfileResponse)
async def train_voice_profile_endpoint(
    payload: VoiceProfileTrainInput,
    name: str = Query(default="Trained Voice", max_length=120),
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VoiceProfile:
    """Train a new voice profile from past creator posts."""
    return await train_voice_profile(
        workspace_id=workspace.id,
        user_id=user.id,
        name=name,
        sample_posts=payload.sample_posts,
        db=db,
    )


@router.get("/runs", response_model=list[AssistantRunResponse])
def list_assistant_runs_endpoint(
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[AssistantRun]:
    """List execution history and token usage for the workspace."""
    return list(
        db.scalars(
            select(AssistantRun)
            .where(AssistantRun.workspace_id == workspace.id)
            .order_by(AssistantRun.created_at.desc())
            .limit(100)
        )
    )


@router.post("/features/{feature_id}/stream")
async def stream_feature(
    feature_id: str,
    payload: ExecuteFeatureRequest,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
):
    import json

    from fastapi import HTTPException
    from fastapi.responses import StreamingResponse

    if payload.conversation_id or payload.request_id:
        raise HTTPException(422, "Use the conversation message endpoint for saved chats")

    async def events():
        yield 'event: progress\ndata: {"status":"validating_and_generating"}\n\n'
        try:
            output, issues, record = await execute_feature(
                workspace.id,
                user.id,
                feature_id,
                payload.input_data,
                platform=payload.platform,
                voice_profile_id=payload.voice_profile_id,
                db=db,
                connected_account_id=payload.connected_account_id,
                validation_context=payload.validation_context,
                writing_instructions=payload.writing_instructions,
                output_language=payload.output_language,
            )
            yield (
                "event: complete\ndata: "
                + json.dumps(
                    {
                        "output": output,
                        "tokens_used": record.tokens_used,
                        "validation_issues": [i.model_dump() for i in issues],
                    }
                )
                + "\n\n"
            )
        except HTTPException as exc:
            yield (
                "event: error\ndata: "
                + json.dumps({"status": exc.status_code, "detail": exc.detail})
                + "\n\n"
            )
        except Exception:  # noqa: BLE001
            yield 'event: error\ndata: {"status":502,"detail":"Assistant provider request failed"}\n\n'

    return StreamingResponse(
        events(), media_type="text/event-stream", headers={"Cache-Control": "no-store"}
    )
