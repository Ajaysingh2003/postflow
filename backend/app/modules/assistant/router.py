"""FastAPI router for AI assistant features, platform profiles, and voice training."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_user,
    get_current_workspace,
    require_content_access,
)
from app.db.session import get_db
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

router = APIRouter(
    prefix="/assistant",
    tags=["assistant"],
    dependencies=[Depends(require_content_access)],
)


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
    output_dict, issues, run_record = await execute_feature(
        workspace_id=workspace.id,
        user_id=user.id,
        feature_id=feature_id,
        input_data=payload.input_data,
        platform=payload.platform,
        voice_profile_id=payload.voice_profile_id,
        db=db,
    )
    return ExecuteFeatureResponse(
        feature_id=feature_id,
        platform=run_record.platform,
        output=output_dict,
        tokens_used=run_record.tokens_used,
        validation_issues=[i.model_dump() for i in issues],
    )


@router.post("/voice-profiles", response_model=VoiceProfileResponse, status_code=status.HTTP_201_CREATED)
def create_voice_profile_endpoint(
    payload: VoiceProfileCreate,
    user: User = Depends(get_current_user),
    workspace: Workspace = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> VoiceProfile:
    """Manually create a voice profile for the workspace."""
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
            .where(VoiceProfile.workspace_id == workspace.id)
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
