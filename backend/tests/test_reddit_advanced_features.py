import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.main import app
from app.modules.assistant.service import execute_feature
from app.modules.channels.adapters.reddit import REDDIT_OAUTH_API_BASE, RedditAdapter
from app.modules.channels.models import ConnectedAccount, SubredditProfile
from app.modules.channels.oauth import encrypt_token
from app.modules.content.models import Post, PostVariant
from app.modules.identity.models import PasswordCredential, SessionToken, User
from app.modules.workspaces.models import Workspace, WorkspaceMembership


@pytest.fixture
def reddit_env():
    user_id = str(uuid4())
    ws_id = str(uuid4())
    raw_token = f"tok_reddit_adv_{uuid4().hex}"

    with SessionLocal.begin() as db:
        user = User(
            id=user_id,
            email=f"reddit_power_user_{uuid4().hex[:8]}@example.com",
            name="Reddit Power User",
            email_verified=True,
            is_active=True,
        )
        ws = Workspace(
            id=ws_id,
            name="Reddit Workspace",
            slug=f"reddit-ws-{uuid4().hex[:8]}",
            owner_user_id=user_id,
        )
        cred = PasswordCredential(user_id=user_id, password_hash="hash")
        mem = WorkspaceMembership(workspace_id=ws_id, user_id=user_id, role="owner")
        session = SessionToken(
            user_id=user_id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        account = ConnectedAccount(
            workspace_id=ws_id,
            platform="reddit",
            external_account_id="t2_reddit_test_user",
            display_name="u/reddit_pro_poster",
            account_type="profile",
            encrypted_access_token=encrypt_token("reddit_token_xyz"),
            encrypted_refresh_token=encrypt_token("reddit_refresh_xyz"),
            token_expires_at=datetime.now(UTC) + timedelta(hours=2),
            granted_scopes=["identity", "submit", "read", "mysubreddits", "flair"],
            status="active",
        )
        sub = SubredditProfile(
            name="programming",
            display_name="r/programming",
            rules=[
                {"short_name": "No Spam", "description": "High-quality technical content only."}
            ],
            allowed_post_types=["text", "link", "image", "video"],
            flair_required=True,
            available_flairs=[{"id": "flair_tech", "text": "Architecture"}],
            title_requirements={"max_length": 300},
            fetched_at=datetime.now(UTC),
        )
        db.add_all([user, ws, cred, mem, session, account, sub])

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
        "account_id": account.id,
    }


def test_reddit_adapter_media_capabilities():
    adapter = RedditAdapter(client_id="cid", client_secret="csec")
    assert adapter.capabilities.supports_media is False
    assert adapter.capabilities.supports_video is False
    assert "video/mp4" in adapter.capabilities.supported_media_types
    assert adapter.capabilities.max_media_count == 0


def test_editor_loads_cached_community_rules_without_provider_call(reddit_env, monkeypatch):
    async def unexpected_refresh(*args):
        raise AssertionError("A fresh cache must not call Reddit")

    monkeypatch.setattr(RedditAdapter, "refresh_subreddit_profile", unexpected_refresh)
    response = reddit_env["client"].get(
        f"/api/v1/channels/reddit/{reddit_env['account_id']}/subreddits/programming",
        headers=reddit_env["headers"],
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["flair_required"] is True
    assert data["available_flairs"] == [{"id": "flair_tech", "text": "Architecture"}]
    assert data["rules"][0]["short_name"] == "No Spam"


def test_editor_refreshes_stale_community_requirements(reddit_env, monkeypatch):
    with SessionLocal.begin() as db:
        profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == "programming"))
        profile.fetched_at = datetime.now(UTC) - timedelta(days=2)
    called = []

    async def refresh(self, db, account, name):
        called.append((account.id, name))
        profile = db.scalar(select(SubredditProfile).where(SubredditProfile.name == name))
        profile.fetched_at = datetime.now(UTC)
        profile.available_flairs = [{"id": "new", "text": "Updated"}]
        db.commit()
        return profile

    monkeypatch.setattr(RedditAdapter, "refresh_subreddit_profile", refresh)
    response = reddit_env["client"].get(
        f"/api/v1/channels/reddit/{reddit_env['account_id']}/subreddits/programming",
        headers=reddit_env["headers"],
    )
    assert response.status_code == 200
    assert called == [(reddit_env["account_id"], "programming")]
    assert response.json()["available_flairs"][0]["id"] == "new"


def test_editor_community_lookup_is_account_scoped_and_validated(reddit_env):
    root = "/api/v1/channels/reddit"
    client, headers = reddit_env["client"], reddit_env["headers"]
    assert client.get(f"{root}/{uuid4()}/subreddits/programming", headers=headers).status_code == 404
    assert client.get(f"{root}/{reddit_env['account_id']}/subreddits/invalid-name", headers=headers).status_code == 422
    with SessionLocal.begin() as db:
        db.get(ConnectedAccount, reddit_env["account_id"]).status = "needs_reauth"
    assert client.get(f"{root}/{reddit_env['account_id']}/subreddits/programming", headers=headers).status_code == 400


@pytest.mark.anyio
async def test_reddit_media_post_validation():
    adapter = RedditAdapter()

    class MockPayload:
        def __init__(self, payload: dict[str, Any]) -> None:
            self.payload = payload

    issues = await adapter.validate(
        MockPayload(
            {"subreddit": "programming", "title": "Architecture Diagram", "post_type": "image"}
        )
    )
    assert any(i.code == "unsupported_post_type" for i in issues)

    issues_valid = await adapter.validate(
        MockPayload(
            {
                "subreddit": "programming",
                "title": "Architecture Diagram",
                "post_type": "image",
                "media_url": "https://example.com/assets/diagram.png",
            }
        )
    )
    assert any(i.code == "unsupported_post_type" for i in issues_valid)


@pytest.mark.anyio
async def test_reddit_media_publish_kind_link():
    mock_responses = {
        f"{REDDIT_OAUTH_API_BASE}/api/submit": httpx.Response(
            status_code=200,
            json={
                "json": {
                    "errors": [],
                    "data": {
                        "id": "t3_imgpost123",
                        "url": "https://reddit.com/r/programming/comments/imgpost123",
                    },
                }
            },
        )
    }

    def transport_handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url in mock_responses:
            return mock_responses[url]
        return httpx.Response(status_code=404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(transport_handler))
    adapter = RedditAdapter(http_client=mock_client)

    account = ConnectedAccount(
        workspace_id="ws_1",
        platform="reddit",
        encrypted_access_token=encrypt_token("tok_reddit"),
        status="active",
    )

    class MockPayload:
        def __init__(self, payload: dict[str, Any]) -> None:
            self.payload = payload

    var = MockPayload(
        {
            "subreddit": "programming",
            "title": "Distributed Queues Visualized",
            "post_type": "link",
            "url": "https://cdn.example.com/diagram.png",
            "flair_id": "flair_tech",
        }
    )

    res = await adapter.publish(account, var)
    assert res.success is True
    assert res.external_post_id == "t3_imgpost123"


def test_reddit_post_preview_generation(reddit_env):
    client = reddit_env["client"]
    headers = reddit_env["headers"]
    acc_id = reddit_env["account_id"]

    res = client.post(
        f"/api/v1/channels/reddit/{acc_id}/preview",
        headers=headers,
        json={
            "subreddit": "programming",
            "title": "Scaling Distributed Workers",
            "body": "Detailed breakdown of queue partitioning and Redis locks.",
            "post_type": "text",
            "flair_id": "flair_tech",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["platform"] == "reddit"
    assert data["subreddit"] == "r/programming"
    assert data["title"] == "Scaling Distributed Workers"
    assert data["flair"]["text"] == "Architecture"
    assert data["mock_upvotes"] == 1


def test_reddit_inbox_reply_and_listening_are_not_exposed(reddit_env):
    client, headers, account = reddit_env["client"], reddit_env["headers"], reddit_env["account_id"]
    for path in (
        f"/api/v1/channels/reddit/{account}/inbox",
        f"/api/v1/channels/reddit/{account}/conversations/search?q=topic",
    ):
        assert client.get(path, headers=headers).status_code == 404
    assert (
        client.post(
            f"/api/v1/channels/reddit/{account}/comments/reply",
            headers=headers,
            json={"parent_id": "t1_other", "text": "reply"},
        ).status_code
        == 404
    )


@pytest.mark.anyio
async def test_new_reddit_ai_assistant_features(reddit_env):
    ws_id = reddit_env["workspace_id"]
    user_id = reddit_env["user_id"]

    with SessionLocal() as db:
        # 1. Community Fit Score
        out_fit, _, run_fit = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_community_fit_score",
            input_data={
                "subreddit": "programming",
                "title": "How we scaled background queue processing without locks",
                "body": "Here is an in-depth breakdown of our architectural benchmarks...",
            },
            db=db,
        )
        assert "fit_score" in out_fit
        assert "tone_alignment" in out_fit
        assert run_fit.platform == "reddit"

        # 2. Best Posting Times
        out_times, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_best_posting_times",
            input_data={
                "subreddit": "programming",
                "timezone": "America/New_York",
                "topic": "Tech Architecture",
            },
            db=db,
        )
        assert "recommended_windows" in out_times
        assert "peak_activity_days" in out_times

        # 3. AI Reply Suggestion
        out_reply, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_ai_reply_suggestion",
            input_data={
                "parent_comment": "Does this approach handle network partitions gracefully?",
                "post_title": "Architecture breakdown",
                "tone": "helpful",
            },
            db=db,
        )
        assert "suggestions" in out_reply
        assert len(out_reply["suggestions"]) > 0

        # 4. Relative Community Discovery
        out_disc, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_community_discovery",
            input_data={
                "topic": "FastAPI and distributed job queues",
                "niche": "Backend Engineering",
            },
            db=db,
        )
        assert "recommended_subreddits" in out_disc
        assert len(out_disc["recommended_subreddits"]) > 0

        # 5. Multi-Community Adaptation
        for name in ("programming", "webdev"):
            if db.scalar(select(SubredditProfile).where(SubredditProfile.name == name)) is None:
                db.add(
                    SubredditProfile(
                        name=name,
                        rules=[],
                        allowed_post_types=["text", "link"],
                        flair_required=False,
                        available_flairs=[],
                        title_requirements={"max_length": 300},
                        fetched_at=datetime.now(UTC),
                    )
                )
        db.commit()
        out_adapt, _, _ = await execute_feature(
            workspace_id=ws_id,
            user_id=user_id,
            feature_id="reddit_multi_community_adapt",
            validation_context={"programming": {"flair_id": "flair_tech"}},
            input_data={
                "base_message": "We built an async queue system that handles 50,000 tasks per second with zero locking.",
                "target_subreddits": ["programming", "webdev"],
            },
            db=db,
        )
        assert "adapted_posts" in out_adapt
        assert len(out_adapt["adapted_posts"]) > 0


def test_one_to_many_multi_community_post_flow(reddit_env):
    client = reddit_env["client"]
    headers = reddit_env["headers"]
    acc_id = reddit_env["account_id"]

    # Submit a single message to multiple communities in one go with tailored variants
    res = client.post(
        "/api/v1/publishing/reddit/multi-community-post",
        headers=headers,
        json={
            "account_id": acc_id,
            "title": "Scaling Asynchronous Workers",
            "base_text": "Complete guide on distributed architecture, Redis leases, and worker auto-scaling.",
            "subreddits": ["programming", "webdev"],
            "adapted_variants": [
                {
                    "subreddit": "programming",
                    "title": "Lessons learned scaling asynchronous distributed queues in Python",
                    "body": "Here is an architectural breakdown of queue isolation and rate limits.",
                    "recommended_flair": "flair_tech",
                    "post_type": "text",
                },
                {
                    "subreddit": "webdev",
                    "title": "How we designed multi-platform social dispatch with zero cascading failures",
                    "body": "A deep dive into decoupled webhook workers and Redis rate limiters.",
                    "recommended_flair": None,
                    "post_type": "text",
                },
            ],
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["variants_count"] == 2
    assert len(data["variants"]) == 2
    assert {v["subreddit"] for v in data["variants"]} == {"programming", "webdev"}


def test_team_approval_workflow(reddit_env):
    client = reddit_env["client"]
    headers = reddit_env["headers"]
    ws_id = reddit_env["workspace_id"]
    acc_id = reddit_env["account_id"]
    user_id = reddit_env["user_id"]

    with SessionLocal() as db:
        post = Post(
            workspace_id=ws_id, author_id=user_id, title="Needs Approval", base_text="Body content"
        )
        db.add(post)
        db.flush()
        variant = PostVariant(
            post_id=post.id,
            connected_account_id=acc_id,
            platform="reddit",
            payload={"subreddit": "programming", "title": "Draft post", "body": "Draft body"},
            status="draft",
            idempotency_key=f"apprv_{uuid4().hex}",
        )
        db.add(variant)
        db.commit()
        var_id = variant.id

    # 1. Submit for approval
    res_sub = client.post(
        f"/api/v1/publishing/variants/{var_id}/submit-for-approval", headers=headers
    )
    assert res_sub.status_code == 200
    assert res_sub.json()["status"] == "pending_approval"

    # 2. Scheduling while pending approval is blocked
    res_sched_blocked = client.post(
        f"/api/v1/publishing/variants/{var_id}/schedule",
        headers=headers,
        json={"scheduled_time": (datetime.now(UTC) + timedelta(hours=2)).isoformat()},
    )
    assert res_sched_blocked.status_code == 400
    assert "pending team approval" in res_sched_blocked.json()["detail"]

    # 3. Reject variant
    res_rej = client.post(
        f"/api/v1/publishing/variants/{var_id}/reject",
        headers=headers,
        json={"reason": "Please remove marketing jargon and add technical trade-offs."},
    )
    assert res_rej.status_code == 200
    assert res_rej.json()["status"] == "rejected"
    assert "marketing jargon" in res_rej.json()["reason"]

    # 4. Approve variant
    res_app = client.post(f"/api/v1/publishing/variants/{var_id}/approve", headers=headers)
    assert res_app.status_code == 200
    assert res_app.json()["status"] == "approved"
