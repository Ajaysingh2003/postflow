"""Comprehensive test suite for Phase 5: Publishing Pipeline.
Covers:
- Scheduling & Pre-flight validation (including Reddit cached subreddit rules)
- Idempotency guard (no double-posting)
- Isolation (variant failures never block other variants)
- Retry with exponential backoff on transient errors
- Fatal errors & Max retries cutoff
- Auth errors & marking account 'needs_reauth'
- Per-platform rate limiter
- Audit attempt logs in publish_attempts
- Background jobs: dispatch_due, refresh_subreddit_profiles, fetch_metrics_job
"""

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.jobs.runner import (
    dispatch_due_async,
)
from app.main import app
from app.modules.channels.base import (
    AccountMetrics,
    AuthStart,
    Capabilities,
    Issue,
    Metrics,
    PublishResult,
    Target,
)
from app.modules.channels.models import ConnectedAccount, SubredditProfile
from app.modules.channels.oauth import encrypt_token
from app.modules.channels.registry import channel_registry
from app.modules.content.models import Post, PostVariant
from app.modules.identity.models import PasswordCredential, SessionToken, User
from app.modules.publishing.models import PublishAttempt
from app.modules.publishing.rate_limiter import PlatformRateLimiter, RatePolicy
from app.modules.publishing.service import (
    publish_variant_job,
    validate_variant,
)
from app.modules.workspaces.models import Workspace, WorkspaceMembership


class ControllableMockAdapter:
    """Mock platform adapter with configurable publish behaviors."""

    def __init__(
        self,
        platform: str = "pipeline_mock",
        display_name: str = "Pipeline Mock",
        max_text_length: int = 280,
    ) -> None:
        self.platform = platform
        self.capabilities = Capabilities(
            platform=platform,
            display_name=display_name,
            max_text_length=max_text_length,
            supports_media=True,
            max_media_count=4,
            requires_target=False,
            supports_account_metrics=True,
        )
        self.publish_count = 0
        self.should_fail_retryable = False
        self.should_fail_fatal = False
        self.should_fail_auth = False
        self.should_raise_exception = False
        self.fail_refresh = False

    async def build_auth_url(self, workspace_id: str, state: str, **opts: Any) -> AuthStart:
        return AuthStart(auth_url=f"https://mock.test/auth?state={state}", state=state)

    async def handle_callback(
        self, workspace_id: str, params: dict[str, Any], state: str, **opts: Any
    ) -> ConnectedAccount:
        return ConnectedAccount(
            workspace_id=workspace_id,
            platform=self.platform,
            external_account_id=params.get("id", "ext_mock_1"),
            display_name="Mock Account",
            encrypted_access_token=encrypt_token("tok_123"),
            status="active",
        )

    async def refresh_tokens(self, account: ConnectedAccount) -> ConnectedAccount:
        if self.fail_refresh:
            raise ValueError("Token refresh rejected by mock platform")
        account.encrypted_access_token = encrypt_token("refreshed_tok")
        account.token_expires_at = datetime.now(UTC) + timedelta(hours=2)
        account.status = "active"
        return account

    async def revoke(self, account: ConnectedAccount) -> None:
        pass

    async def list_targets(self, account: ConnectedAccount) -> list[Target]:
        return []

    async def validate(self, variant: Any, **opts: Any) -> list[Issue]:
        issues: list[Issue] = []
        payload = getattr(variant, "payload", {})
        text = payload.get("text", "")
        if len(text) > self.capabilities.max_text_length:
            issues.append(
                Issue(
                    field="text",
                    message=f"Text length {len(text)} exceeds limit {self.capabilities.max_text_length}",
                    severity="error",
                    code="text_too_long",
                )
            )
        return issues

    async def publish(self, account: ConnectedAccount, variant: Any) -> PublishResult:
        self.publish_count += 1
        if self.should_raise_exception:
            raise RuntimeError("Network socket disconnect during publish")

        if self.should_fail_auth:
            return PublishResult(
                success=False,
                error_message="401 Unauthorized: The access token has expired or is invalid.",
                is_retryable=False,
                raw_response={"error": "invalid_grant", "status": 401},
            )

        if self.should_fail_fatal:
            return PublishResult(
                success=False,
                error_message="400 Bad Request: Invalid parameter target_id.",
                is_retryable=False,
                raw_response={"error": "bad_request", "status": 400},
            )

        if self.should_fail_retryable:
            return PublishResult(
                success=False,
                error_message="429 Too Many Requests: Rate limit exceeded. Try again later.",
                is_retryable=True,
                raw_response={"error": "rate_limited", "status": 429},
            )

        ext_id = f"post_{self.platform}_{uuid4().hex[:8]}"
        return PublishResult(
            success=True,
            external_post_id=ext_id,
            external_url=f"https://mock.test/p/{ext_id}",
            raw_response={"id": ext_id, "status": "ok"},
        )

    async def delete_post(self, account: ConnectedAccount, external_post_id: str) -> None:
        pass

    async def fetch_metrics(
        self,
        account: ConnectedAccount,
        external_post_id: str,
        context: dict[str, Any] | None = None,
    ) -> Metrics:
        return Metrics(impressions=250, reach=200, likes=15, comments=3)

    async def fetch_account_metrics(self, account: ConnectedAccount) -> AccountMetrics:
        return AccountMetrics(followers_count=850, profile_views=120, impressions=5000)


@pytest.fixture
def mock_adapter():
    adapter = ControllableMockAdapter(platform="pipe_mock")
    channel_registry.register(adapter)
    yield adapter
    channel_registry.unregister("pipe_mock")


@pytest.fixture
def test_setup():
    user_id = str(uuid4())
    ws_id = str(uuid4())
    raw_token = f"tok_{uuid4().hex}"

    with SessionLocal.begin() as db:
        user = User(
            id=user_id,
            email=f"publisher_{uuid4().hex[:8]}@example.com",
            name="Pipeline Tester",
            email_verified=True,
            is_active=True,
        )
        ws = Workspace(
            id=ws_id,
            name="Publishing Test Workspace",
            slug=f"pub-ws-{uuid4().hex[:8]}",
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


def create_test_post_and_variant(
    db,
    workspace_id: str,
    user_id: str,
    platform: str = "pipe_mock",
    payload: dict | None = None,
    status: str = "draft",
    attempt_count: int = 0,
    external_post_id: str | None = None,
    scheduled_time: datetime | None = None,
) -> tuple[Post, PostVariant, ConnectedAccount]:
    account = ConnectedAccount(
        workspace_id=workspace_id,
        platform=platform,
        external_account_id=f"ext_{uuid4().hex[:8]}",
        display_name="Mock Account",
        account_type="creator",
        encrypted_access_token=encrypt_token("access_123"),
        status="active",
    )
    db.add(account)
    db.flush()

    post = Post(
        workspace_id=workspace_id,
        author_id=user_id,
        title="Test Scheduling Post",
        base_text="Base text for publishing",
        status=status,
    )
    db.add(post)
    db.flush()

    variant = PostVariant(
        post_id=post.id,
        connected_account_id=account.id,
        platform=platform,
        payload=payload or {"text": "Publishing ready text"},
        scheduled_time=scheduled_time,
        status=status,
        attempt_count=attempt_count,
        external_post_id=external_post_id,
        idempotency_key=str(uuid4()),
    )
    db.add(variant)
    db.commit()
    db.refresh(post)
    db.refresh(variant)
    db.refresh(account)
    return post, variant, account


# ==============================================================================
# 1. Validation & Scheduling Tests
# ==============================================================================


@pytest.mark.anyio
async def test_validate_variant_success_and_failure(mock_adapter, test_setup):
    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            payload={"text": "Valid short text"},
        )
        issues = await validate_variant(variant, db)
        assert len(issues) == 0

        # Exceed max length
        variant.payload = {"text": "A" * 300}
        issues = await validate_variant(variant, db)
        assert len(issues) == 1
        assert issues[0].code == "text_too_long"


@pytest.mark.anyio
async def test_validate_reddit_cached_flair_requirement(test_setup):
    with SessionLocal() as db:
        # Create cached SubredditProfile requiring flair
        sub_profile = SubredditProfile(
            fetched_at=datetime.now(UTC),
            name="science",
            display_name="r/science",
            flair_required=True,
            allowed_post_types=["text", "link"],
            available_flairs=[{"id": "flair_1", "text": "Biology"}],
        )
        db.add(sub_profile)
        db.flush()

        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="reddit",
            payload={"subreddit": "science", "title": "New Discovery", "text": "Details here"},
        )

        # Missing flair_id should trigger error
        issues = await validate_variant(variant, db)
        flair_issues = [i for i in issues if i.code == "flair_required"]
        assert len(flair_issues) == 1
        assert "requires a post flair" in flair_issues[0].message

        # With flair_id provided, validation succeeds
        variant.payload["flair_id"] = "flair_1"
        issues2 = await validate_variant(variant, db)
        assert len([i for i in issues2 if i.code == "flair_required"]) == 0


def test_schedule_variant_api_success(mock_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    with SessionLocal() as db:
        post, variant, _ = create_test_post_and_variant(
            db, test_setup["workspace_id"], test_setup["user_id"], platform="pipe_mock"
        )
        variant_id = variant.id
        post_id = post.id

    future_time = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
    resp = client.post(
        f"/api/v1/publishing/variants/{variant_id}/schedule",
        json={"scheduled_time": future_time},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["variant_id"] == variant_id
    assert data["status"] == "scheduled"

    with SessionLocal() as db:
        v = db.scalar(select(PostVariant).where(PostVariant.id == variant_id))
        p = db.scalar(select(Post).where(Post.id == post_id))
        assert v.status == "scheduled"
        assert p.status == "scheduled"


def test_schedule_variant_api_validation_failure(mock_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            payload={"text": "X" * 350},  # exceeds 280
        )
        variant_id = variant.id

    resp = client.post(
        f"/api/v1/publishing/variants/{variant_id}/schedule",
        json={},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "issues" in resp.json()["detail"]


def test_cancel_variant_schedule_api(mock_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db, test_setup["workspace_id"], test_setup["user_id"], platform="pipe_mock"
        )
        variant.status = "scheduled"
        db.commit()
        variant_id = variant.id

    resp = client.post(
        f"/api/v1/publishing/variants/{variant_id}/cancel",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"

    # Canceling draft returns 400
    resp_bad = client.post(
        f"/api/v1/publishing/variants/{variant_id}/cancel",
        headers=headers,
    )
    assert resp_bad.status_code == 400


def test_schedule_post_api(mock_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    with SessionLocal() as db:
        post, _, _ = create_test_post_and_variant(
            db, test_setup["workspace_id"], test_setup["user_id"], platform="pipe_mock"
        )
        post_id = post.id

    resp = client.post(
        f"/api/v1/publishing/posts/{post_id}/schedule",
        json={},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "scheduled"


# ==============================================================================
# 2. Execution, Idempotency & Attempt Audit Logging
# ==============================================================================


@pytest.mark.anyio
async def test_publish_variant_job_success(mock_adapter, test_setup):
    with SessionLocal() as db:
        post, variant, _ = create_test_post_and_variant(
            db, test_setup["workspace_id"], test_setup["user_id"], platform="pipe_mock"
        )
        variant_id = variant.id

        attempt = await publish_variant_job(variant_id, db)
        assert attempt.result == "success"
        assert attempt.status_code == 200
        assert attempt.finished_at is not None

        db.refresh(variant)
        db.refresh(post)
        assert variant.status == "published"
        assert variant.external_post_id is not None
        assert variant.attempt_count == 1
        assert post.status == "published"
        assert mock_adapter.publish_count == 1


@pytest.mark.anyio
async def test_publish_variant_idempotency(mock_adapter, test_setup):
    """Calling publish on an already published variant must be a no-op."""
    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            status="published",
            external_post_id="post_existing_999",
        )
        variant_id = variant.id

        # Publish attempt should return success without calling adapter.publish
        attempt = await publish_variant_job(variant_id, db)
        assert attempt.result == "success"
        assert attempt.response_payload.get("idempotent_duplicate") is True
        assert mock_adapter.publish_count == 0  # Adapter was NOT called


# ==============================================================================
# 3. Isolation: One variant failure never blocks others
# ==============================================================================


@pytest.mark.anyio
async def test_publish_variant_isolation(mock_adapter, test_setup):
    """Failure of one variant never impairs or blocks another variant."""
    with SessionLocal() as db:
        post = Post(
            workspace_id=test_setup["workspace_id"],
            author_id=test_setup["user_id"],
            title="Multi-channel isolation post",
            base_text="Broadcast message",
            status="scheduled",
        )
        db.add(post)
        db.flush()

        # Variant A: Valid
        _, var_a, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            payload={"text": "Clean variant A"},
        )
        var_a.post_id = post.id

        # Variant B: Fails pre-validation (over length)
        _, var_b, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            payload={"text": "Z" * 400},
        )
        var_b.post_id = post.id
        db.commit()

        # Execute both
        attempt_a = await publish_variant_job(var_a.id, db)
        attempt_b = await publish_variant_job(var_b.id, db)

        assert attempt_a.result == "success"
        assert attempt_b.result == "fatal_error"

        db.refresh(var_a)
        db.refresh(var_b)
        assert var_a.status == "published"
        assert var_b.status == "failed"


# ==============================================================================
# 4. Retries with Exponential Backoff
# ==============================================================================


@pytest.mark.anyio
async def test_publish_variant_retryable_backoff(mock_adapter, test_setup):
    mock_adapter.should_fail_retryable = True

    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            attempt_count=0,
        )
        variant_id = variant.id

        attempt = await publish_variant_job(variant_id, db)
        assert attempt.result == "retryable_error"

        db.refresh(variant)
        assert variant.status == "scheduled"
        assert variant.attempt_count == 1
        sched = variant.scheduled_time
        if sched and sched.tzinfo is None:
            sched = sched.replace(tzinfo=UTC)
        assert sched > datetime.now(UTC)
        assert "Rate limit" in variant.last_error


@pytest.mark.anyio
async def test_publish_variant_max_retries_exceeded(mock_adapter, test_setup):
    mock_adapter.should_fail_retryable = True

    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            attempt_count=4,  # Next attempt is 5 (MAX_ATTEMPTS)
        )
        variant_id = variant.id

        attempt = await publish_variant_job(variant_id, db)
        assert attempt.result == "fatal_error"

        db.refresh(variant)
        assert variant.status == "failed"
        assert "Max retries (5) exceeded" in variant.last_error


# ==============================================================================
# 5. Auth Errors & Marking Account 'needs_reauth'
# ==============================================================================


@pytest.mark.anyio
async def test_publish_variant_auth_error(mock_adapter, test_setup):
    mock_adapter.should_fail_auth = True

    with SessionLocal() as db:
        _, variant, account = create_test_post_and_variant(
            db, test_setup["workspace_id"], test_setup["user_id"], platform="pipe_mock"
        )
        variant_id = variant.id

        attempt = await publish_variant_job(variant_id, db)
        assert attempt.result == "auth_error"

        db.refresh(variant)
        db.refresh(account)
        assert variant.status == "failed"
        assert account.status == "needs_reauth"
        assert "reconnect this account" in variant.last_error


# ==============================================================================
# 6. Shared Platform Rate Limiter
# ==============================================================================


@pytest.mark.anyio
async def test_platform_rate_limiter():
    custom_policy = {"tight_platform": RatePolicy(max_requests=2, window_seconds=60)}
    limiter = PlatformRateLimiter(policies=custom_policy)

    # 1st request: OK
    ok1, retry_after = await limiter.check_rate_limit("tight_platform", "acc_1")
    assert ok1 is True
    await limiter.record_request("tight_platform", "acc_1")

    # 2nd request: OK
    ok2, _ = await limiter.check_rate_limit("tight_platform", "acc_1")
    assert ok2 is True
    await limiter.record_request("tight_platform", "acc_1")

    # 3rd request: Exceeded limit
    ok3, retry_after = await limiter.check_rate_limit("tight_platform", "acc_1")
    assert ok3 is False
    assert retry_after > 0.0


# ==============================================================================
# 7. Background Jobs (dispatch_due, refresh_subreddit_profiles, fetch_metrics_job)
# ==============================================================================


@pytest.mark.anyio
async def test_dispatch_due_runner(mock_adapter, test_setup):
    with SessionLocal() as db:
        # Schedule variant in the past
        past_time = datetime.now(UTC) - timedelta(minutes=5)
        _, variant, _ = create_test_post_and_variant(
            db,
            test_setup["workspace_id"],
            test_setup["user_id"],
            platform="pipe_mock",
            status="scheduled",
            scheduled_time=past_time,
        )

        processed = await dispatch_due_async(db)
        assert processed == 1

        db.refresh(variant)
        assert variant.status == "published"


def test_scheduler_has_no_metrics_collection_job():
    import inspect

    from app.jobs import runner
    assert not hasattr(runner, "fetch_metrics_job_async")
    assert "fetch_metrics" not in inspect.getsource(runner.run)


# ==============================================================================
# 8. Attempt History REST API
# ==============================================================================


def test_publish_attempts_api(mock_adapter, test_setup):
    client = test_setup["client"]
    headers = test_setup["headers"]

    with SessionLocal() as db:
        _, variant, _ = create_test_post_and_variant(
            db, test_setup["workspace_id"], test_setup["user_id"], platform="pipe_mock"
        )
        variant_id = variant.id

        # Record a test attempt
        attempt = PublishAttempt(
            variant_id=variant_id,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            result="success",
            status_code=200,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        attempt_id = attempt.id

    resp = client.get(
        f"/api/v1/publishing/variants/{variant_id}/attempts",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == attempt_id
    assert data[0]["result"] == "success"

    resp_single = client.get(
        f"/api/v1/publishing/attempts/{attempt_id}",
        headers=headers,
    )
    assert resp_single.status_code == 200
    assert resp_single.json()["id"] == attempt_id
