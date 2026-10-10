"""Comprehensive test suite for Phase 6: AI Assistant.
Covers:
- Feature registry and per-platform profiles (X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook, Instagram, Shared)
- Execution of platform-specific features (threads, hooks, carousels, rules check, graphemes, CW, Reels, etc.)
- Output validation through platform adapters
- Untrusted URL safety sanitization
- Voice profile creation, training, and prompt injection
- Usage and token logging in assistant_runs
"""

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.db.session import SessionLocal
from app.main import app
from app.modules.assistant.base import LLMResponse
from app.modules.assistant.schemas import RewriteWithToneInput, XThreadWriterInput
from app.modules.assistant.service import (
    execute_feature,
    fetch_untrusted_url_content,
    train_voice_profile,
)
from app.modules.channels.models import SubredditProfile
from app.modules.identity.models import PasswordCredential, SessionToken, User
from app.modules.workspaces.models import Workspace, WorkspaceMembership


@pytest.mark.anyio
@pytest.mark.parametrize("text", ["a", "hi", "test"])
@pytest.mark.parametrize("platform", ["x", "linkedin"])
async def test_short_current_drafts_reach_the_assistant_provider(test_setup, text, platform):
    class CapturingLLM:
        async def generate_structured(self, messages, response_model):
            self.messages = messages
            return response_model(rewritten_text="A useful post", notes="Fixed punctuation"), LLMResponse(content="", total_tokens=3)

    llm = CapturingLLM()
    with SessionLocal() as db:
        output, issues, run = await execute_feature(
            workspace_id=test_setup["workspace_id"], user_id=test_setup["user_id"],
            feature_id="rewrite_with_tone", input_data={"text": text, "tone": "Polish"},
            platform=platform, db=db, llm=llm,
        )
    assert text in llm.messages[1].content
    assert output["rewritten_text"] == "A useful post"
    assert output["notes"] == "Fixed punctuation"
    assert "never in rewritten_text" in llm.messages[1].content
    assert not issues
    assert run.status == "succeeded"
    assert run.tokens_used == 3


@pytest.mark.parametrize("schema", [RewriteWithToneInput, XThreadWriterInput])
def test_assistant_still_rejects_empty_input(schema):
    assert schema(text="a").text == "a"
    with pytest.raises(ValidationError):
        schema(text="")


@pytest.mark.anyio
async def test_account_writing_preferences_reach_provider_and_preserve_validation(test_setup):
    class CapturingLLM:
        async def generate_structured(self, messages, response_model):
            self.messages = messages
            return response_model(rewritten_text="A clear, useful post"), LLMResponse(content="", total_tokens=12)

    llm = CapturingLLM()
    with SessionLocal() as db:
        output, issues, run = await execute_feature(
            workspace_id=test_setup["workspace_id"], user_id=test_setup["user_id"],
            feature_id="rewrite_with_tone", input_data={"text": "Please improve this draft", "tone": "Direct"},
            platform="x", db=db, llm=llm, writing_instructions="Avoid clichés", output_language="Hindi",
        )
    assert output["rewritten_text"] == "A clear, useful post"
    assert not issues
    assert "Hindi" in llm.messages[1].content
    assert "Avoid" in llm.messages[1].content
    assert "untrusted" in llm.messages[0].content
    assert run.tokens_used == 12


@pytest.fixture
def test_setup():
    user_id = str(uuid4())
    ws_id = str(uuid4())
    raw_token = f"tok_assist_{uuid4().hex}"

    with SessionLocal.begin() as db:
        user = User(
            id=user_id,
            email=f"assistant_tester_{uuid4().hex[:8]}@example.com",
            name="Assistant Tester",
            email_verified=True,
            is_active=True,
        )
        ws = Workspace(
            id=ws_id,
            name="AI Assistant Test Workspace",
            slug=f"ai-ws-{uuid4().hex[:8]}",
            owner_user_id=user_id,
        )
        cred = PasswordCredential(user_id=user_id, password_hash="secret")
        mem = WorkspaceMembership(workspace_id=ws_id, user_id=user_id, role="owner")
        session = SessionToken(
            user_id=user_id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add_all([user, ws, cred, mem, session])

    client = TestClient(app)
    headers = {
        "Authorization": f"Bearer {raw_token}",
        "X-Workspace-ID": ws_id,
    }

    return {
        "client": client,
        "headers": headers,
        "user_id": user_id,
        "workspace_id": ws_id,
    }


# ==============================================================================
# 1. Registry & Profiles Listing Tests
# ==============================================================================


def test_list_assistant_profiles(test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    resp = client.get("/api/v1/assistant/profiles", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 8  # 7 platforms + shared

    platforms = {p["platform"] for p in data}
    expected = {"x", "linkedin", "reddit", "bluesky", "mastodon", "facebook", "instagram", "shared"}
    assert expected.issubset(platforms)

    # Verify X profile constraints
    x_prof = next(p for p in data if p["platform"] == "x")
    assert x_prof["character_limit"] == 280
    assert len(x_prof["style_guidelines"]) > 0
    assert "x_thread_writer" in x_prof["feature_ids"]


def test_list_features_filtering(test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    # All features
    resp_all = client.get("/api/v1/assistant/features", headers=headers)
    assert resp_all.status_code == 200
    all_feats = resp_all.json()
    assert len(all_feats) >= 30

    # Filtered by X (contains X-specific features + shared features)
    resp_x = client.get("/api/v1/assistant/features?platform=x", headers=headers)
    assert resp_x.status_code == 200
    x_feats = resp_x.json()
    x_feat_ids = {f["id"] for f in x_feats}
    assert "x_thread_writer" in x_feat_ids
    assert "x_hook_variants" in x_feat_ids
    assert "voice_profile_training" in x_feat_ids  # shared feature included
    assert "reddit_title_variants" not in x_feat_ids

    # Filtered by Reddit
    resp_red = client.get("/api/v1/assistant/features?platform=reddit", headers=headers)
    red_feat_ids = {f["id"] for f in resp_red.json()}
    assert "reddit_subreddit_rewrite" in red_feat_ids
    assert "reddit_self_promotion_safe" in red_feat_ids
    assert "x_thread_writer" not in red_feat_ids


# ==============================================================================
# 2. X Platform Features
# ==============================================================================


@pytest.mark.anyio
async def test_x_features_execution(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # 1. Thread writer
        out, _issues, run = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="x_thread_writer",
            input_data={
                "text": "A comprehensive guide on building scalable distributed backends with Python and FastAPI.",
                "max_tweets": 3,
            },
            db=db,
        )
        assert "tweets" in out
        assert len(out["tweets"]) > 0
        assert run.feature_id == "x_thread_writer"
        assert run.tokens_used > 0

        # 2. Hook variants
        out_hooks, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="x_hook_variants",
            input_data={"topic": "Microservices vs Monoliths in 2025", "count": 3},
            db=db,
        )
        assert len(out_hooks["hooks"]) == 3

        # 3. Single post compression
        out_comp, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="x_single_post_compression",
            input_data={
                "text": "Many software engineers believe that microservices solve team scaling issues, but in reality they introduce immense distributed complexity unless organizational boundaries align with service boundaries."
            },
            db=db,
        )
        assert "compressed_post" in out_comp
        assert out_comp["character_count"] > 0


# ==============================================================================
# 3. LinkedIn Platform Features
# ==============================================================================


@pytest.mark.anyio
async def test_linkedin_features_execution(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # 1. Long-form post
        out_long, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="linkedin_long_form",
            input_data={
                "topic": "Leadership lessons from scaling a SaaS startup",
                "key_points": ["Delegation", "Transparency", "Focus"],
            },
            db=db,
        )
        assert "hook" in out_long
        assert "body" in out_long
        assert "call_to_action" in out_long

        # 2. Carousel outline
        out_carousel, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="linkedin_carousel_outline",
            input_data={
                "topic": "5 System Design Fundamentals Every Engineer Should Know",
                "num_slides": 3,
            },
            db=db,
        )
        assert len(out_carousel["slides"]) == 3

        # 3. Poll generator
        out_poll, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="linkedin_poll_generator",
            input_data={"topic": "Preferred backend framework in 2025"},
            db=db,
        )
        assert "question" in out_poll
        assert len(out_poll["options"]) >= 2


# ==============================================================================
# 4. Reddit Platform Features & Subreddit Profile Injection
# ==============================================================================


@pytest.mark.anyio
async def test_reddit_features_with_cached_profile(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # Create a cached SubredditProfile
        sub = SubredditProfile(
            fetched_at=datetime.now(UTC),
            name="python",
            display_name="r/Python",
            rules=[
                {
                    "short_name": "No Spam",
                    "description": "Original high-quality technical content only.",
                }
            ],
            allowed_post_types=["text"],
            flair_required=True,
            available_flairs=[{"id": "flair_proj", "text": "Project Showcase"}],
        )
        db.add(sub)
        db.commit()

        # 1. Subreddit-aware rewrite (injects cached rules from SubredditProfile)
        out_rw, _, run = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_subreddit_rewrite",
            validation_context={"flair_id": "flair_proj"},
            input_data={
                "subreddit": "python",
                "draft": "Check out my new scheduling tool, it is the best on the market!",
            },
            db=db,
        )
        assert "title" in out_rw
        assert "body" in out_rw
        assert run.platform == "reddit"

        # 2. Rule compliance check
        out_chk, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_rule_compliance_check",
            input_data={
                "subreddit": "python",
                "title": "Showcase: Clean Architecture Tool",
                "body": "Open source breakdown of domain events.",
            },
            db=db,
        )
        assert "is_compliant" in out_chk
        assert "potential_risks" in out_chk

        # 3. Self-promotion safe rewrite
        out_safe, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_self_promotion_safe",
            validation_context={"subreddit": "python", "flair_id": "flair_proj"},
            input_data={
                "draft": "Buy our social media software now at discount!",
                "product_name": "draftva",
            },
            db=db,
        )
        assert "transparency_statement" in out_safe


# ==============================================================================
# 5. Bluesky & Mastodon Features
# ==============================================================================


@pytest.mark.anyio
async def test_bluesky_and_mastodon_features(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # Bluesky short post
        out_bs, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="bluesky_short_post",
            input_data={
                "text": "Exploring the open AT Protocol and decentralized social media networks with #draftva."
            },
            db=db,
        )
        assert "post" in out_bs
        assert out_bs["grapheme_count"] <= 300

        # Mastodon post with CW
        out_mast, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="mastodon_post",
            input_data={
                "text": "Deep dive into database transaction isolation levels and race conditions.",
                "sensitive": True,
            },
            db=db,
        )
        assert "content" in out_mast
        assert "content_warning" in out_mast


# ==============================================================================
# 6. Instagram & Facebook Features
# ==============================================================================


@pytest.mark.anyio
async def test_instagram_and_facebook_features(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # Instagram Reel script
        out_reel, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="instagram_reel_script",
            input_data={"topic": "3 Productivity Hacks for Solo Developers", "target_seconds": 30},
            db=db,
        )
        assert "hook" in out_reel
        assert "visual_cues" in out_reel
        assert "voiceover_script" in out_reel

        # Facebook engagement questions
        out_fb, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="facebook_engagement_questions",
            validation_context={"page_id": "page1"},
            input_data={"topic": "Remote work habits", "count": 2},
            db=db,
        )
        assert len(out_fb["questions"]) >= 2


# ==============================================================================
# 7. Shared Features & Untrusted URL Protection
# ==============================================================================


@pytest.mark.anyio
async def test_shared_repurpose_and_untrusted_url(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    # Test untrusted URL fetch sanitization
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await fetch_untrusted_url_content("https://invalid.test.domain/page")

    with SessionLocal() as db:
        out_rep, _, run = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="repurpose_content",
            input_data={
                "source_text": "Announcing our new multi-channel scheduling engine built for high reliability.",
                "target_platforms": ["x", "linkedin"],
            },
            platform="shared",
            db=db,
        )
        assert "variants" in out_rep
        assert run.platform == "shared"


# ==============================================================================
# 8. Voice Profiles Training & REST Endpoints
# ==============================================================================


@pytest.mark.anyio
async def test_voice_profiles_training_and_injection(test_setup):
    ws_id = test_setup["workspace_id"]
    user_id = test_setup["user_id"]

    with SessionLocal() as db:
        # Train voice profile
        profile = await train_voice_profile(
            workspace_id=ws_id,
            user_id=user_id,
            name="Founder Voice",
            sample_posts=[
                "Most founders overcomplicate system design before finding product-market fit.",
                "Simplicity is not the lack of clutter; it is the presence of clarity.",
            ],
            db=db,
        )
        assert profile.id is not None
        assert profile.name == "Founder Voice"
        assert len(profile.tone_description) > 0

        # Execute rewrite using the trained voice profile ID
        out_rw, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="rewrite_with_tone",
            platform="x",
            input_data={
                "text": "We are releasing a new feature today for scheduling social media posts."
            },
            voice_profile_id=profile.id,
            db=db,
        )
        assert "rewritten_text" in out_rw


def test_assistant_rest_api(test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    # 1. Execute feature via REST
    resp_run = client.post(
        "/api/v1/assistant/features/x_single_post_compression/run",
        json={
            "input_data": {
                "text": "Architectures should be designed around clean bounded contexts rather than buzzwords."
            }
        },
        headers=headers,
    )
    assert resp_run.status_code == 200
    data_run = resp_run.json()
    assert data_run["feature_id"] == "x_single_post_compression"
    assert "compressed_post" in data_run["output"]
    assert data_run["tokens_used"] > 0

    # 2. Create voice profile via REST
    resp_vp = client.post(
        "/api/v1/assistant/voice-profiles",
        json={
            "name": "Executive Voice",
            "tone_description": "Authoritative and concise.",
            "sample_posts": ["Keep shipping."],
        },
        headers=headers,
    )
    assert resp_vp.status_code == 201
    vp_data = resp_vp.json()
    assert vp_data["name"] == "Executive Voice"

    # 3. List voice profiles
    resp_list = client.get("/api/v1/assistant/voice-profiles", headers=headers)
    assert resp_list.status_code == 200
    assert len(resp_list.json()) >= 1

    # 4. Audit runs history
    resp_runs = client.get("/api/v1/assistant/runs", headers=headers)
    assert resp_runs.status_code == 200
    runs = resp_runs.json()
    assert len(runs) >= 1
    assert runs[0]["feature_id"] == "x_single_post_compression"
