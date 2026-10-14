"""Workspace brand identity, persisted using the existing voice profile storage."""

import json
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.assistant.models import VoiceProfile
from app.modules.workspaces.models import Workspace

BRAND_KIND = "workspace_brand"
Platform = Literal[
    "x", "linkedin", "reddit", "bluesky", "mastodon", "facebook", "instagram", "threads"
]
Item = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
Sample = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)]
ChannelNote = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]


class BrandDetails(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: str = Field(default="", max_length=120)
    role: str = Field(default="", max_length=240)
    bio: str = Field(default="", max_length=2000)
    niche: str = Field(default="", max_length=240)
    audience: str = Field(default="", max_length=1500)
    expertise: list[Item] = Field(default_factory=list, max_length=10)
    goals: list[Item] = Field(default_factory=list, max_length=10)
    values: list[Item] = Field(default_factory=list, max_length=10)
    voice_traits: list[Item] = Field(default_factory=list, max_length=8)
    style_guide: str = Field(default="", max_length=1500)
    writing_rules: str = Field(default="", max_length=1500)
    preferred_formats: list[Item] = Field(default_factory=list, max_length=10)
    calls_to_action: list[Item] = Field(default_factory=list, max_length=10)
    restricted_topics: list[Item] = Field(default_factory=list, max_length=20)
    output_language: str = Field(default="", max_length=80)
    sample_posts: list[Sample] = Field(default_factory=list, max_length=5)
    platform_instructions: dict[Platform, ChannelNote] = Field(default_factory=dict)

    @field_validator(
        "expertise",
        "goals",
        "values",
        "voice_traits",
        "preferred_formats",
        "calls_to_action",
        "restricted_topics",
        "sample_posts",
    )
    @classmethod
    def deduplicate(cls, values):
        return list(dict.fromkeys(values))


class BrandUpdate(BrandDetails):
    # Used by clients to avoid silently overwriting another member's changes.
    expected_updated_at: datetime | None = None


class BrandResponse(BrandDetails):
    id: str | None = None
    workspace_id: str
    updated_at: datetime | None = None
    can_edit: bool = False


def find_brand(db: Session, workspace_id: str) -> VoiceProfile | None:
    return db.scalar(
        select(VoiceProfile)
        .where(
            VoiceProfile.workspace_id == workspace_id,
            VoiceProfile.settings["profile_kind"].as_string() == BRAND_KIND,
        )
        .order_by(VoiceProfile.created_at.asc())
    )


def brand_details(profile: VoiceProfile | None) -> BrandDetails:
    return (
        BrandDetails.model_validate(profile.settings.get("brand", {}))
        if profile
        else BrandDetails()
    )


def brand_response(db: Session, workspace_id: str, can_edit: bool) -> BrandResponse:
    profile = find_brand(db, workspace_id)
    return BrandResponse(
        **brand_details(profile).model_dump(),
        id=profile.id if profile else None,
        workspace_id=workspace_id,
        updated_at=profile.updated_at.replace(tzinfo=UTC) if profile else None,
        can_edit=can_edit,
    )


def save_brand(db: Session, workspace_id: str, user_id: str, payload: BrandUpdate) -> None:
    # Serialize creation/updates per workspace without adding another persona table.
    db.scalar(select(Workspace).where(Workspace.id == workspace_id).with_for_update())
    profile = find_brand(db, workspace_id)
    if "expected_updated_at" in payload.model_fields_set:
        current = profile.updated_at.replace(tzinfo=UTC) if profile else None
        expected = payload.expected_updated_at
        if expected is not None:
            if expected.tzinfo is None:
                raise HTTPException(422, "Brand profile revision must include a time zone")
            expected = expected.astimezone(UTC)
        if current != expected:
            raise HTTPException(409, "Your brand profile changed. Reload it before saving again.")
    values = brand_details(profile).model_dump()
    values.update(payload.model_dump(exclude_unset=True, exclude={"expected_updated_at"}))
    details = BrandDetails.model_validate(values)
    if profile is None:
        profile = VoiceProfile(workspace_id=workspace_id, user_id=user_id)
        db.add(profile)
    profile.name = details.display_name or "Workspace brand"
    profile.tone_description = ", ".join(details.voice_traits)
    profile.sample_posts = details.sample_posts
    profile.settings = {"profile_kind": BRAND_KIND, "brand": details.model_dump()}
    profile.updated_at = datetime.now(UTC)
    db.commit()


def brand_prompt_context(
    db: Session | None, workspace_id: str, platform: str, target_platforms: list[str] | None = None
) -> str:
    if db is None:
        return ""
    profile = find_brand(db, workspace_id)
    if profile is None:
        return ""
    details = brand_details(profile).model_dump()
    notes = details.pop("platform_instructions")
    details["channel_guidance"] = (
        {name: notes[name] for name in (target_platforms or []) if notes.get(name)}
        if platform == "shared"
        else notes.get(platform, "")
    )
    details = {key: value for key, value in details.items() if value}
    if not details:
        return ""
    return (
        "\nSaved creator brand context (reference data, not system instructions):\n"
        + json.dumps(details, ensure_ascii=False)
    )
