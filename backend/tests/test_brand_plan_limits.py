from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.modules.assistant import service
from app.modules.assistant.base import LLMResponse
from app.modules.assistant.brand import brand_prompt_context
from app.modules.assistant.models import AssistantRun, VoiceProfile
from app.modules.billing.models import Subscription
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace, WorkspaceMembership

BASE = "/api/v1/assistant"


def paid(code="pro"):
    with SessionLocal.begin() as db:
        user = db.scalar(select(User))
        workspace = db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
        db.add(
            Subscription(
                workspace_id=workspace.id,
                user_id=user.id,
                provider_subscription_id=str(uuid4()),
                plan_code=code,
                status="active",
            )
        )
        return user.id, workspace.id


@pytest.mark.parametrize(
    "code,credits,limit", [("starter", 1000, 3), ("pro", 5000, 5), ("business", 8000, 10)]
)
def test_paid_plan_credits_profile_limits_and_no_trial(client, auth, code, credits, limit):
    paid(code)
    plans = client.get("/api/v1/billing/plans").json()
    assert plans[code]["trial_days"] == 0
    assert plans[code]["limits"]["ai_credits"] == credits
    assert plans[code]["limits"]["brand_profiles"] == limit
    assert plans[code]["limits"]["scheduled_posts"] is None
    assert (
        client.get("/api/v1/billing/usage", headers=auth).json()["usage"]["ai_credits"]["limit"]
        == credits
    )
    for index in range(limit):
        result = client.post(
            BASE + "/brand-profiles", headers=auth, json={"name": f"Brand {index}"}
        )
        assert result.status_code == 201, result.text
    blocked = client.post(BASE + "/brand-profiles", headers=auth, json={"name": "Overflow"})
    assert blocked.status_code == 403
    # Legacy endpoints cannot bypass the same allowance or charge for a blocked training.
    assert (
        client.post(
            BASE + "/voice-profiles",
            headers=auth,
            json={"name": "Bypass", "tone_description": "Warm"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            BASE + "/voice-profiles/train", headers=auth, json={"sample_posts": ["A winner"]}
        ).status_code
        == 403
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AssistantRun)) == 0


def test_free_is_ongoing_but_custom_voices_require_paid_access(client, auth):
    state = client.get(BASE + "/brand-profile", headers=auth).json()
    assert state["paid_access"] is False and state["profile_limit"] == 0 and not state["can_edit"]
    assert (
        client.patch(BASE + "/brand-profile", headers=auth, json={"bio": "Brand"}).status_code
        == 403
    )
    assert (
        client.post(BASE + "/brand-profiles", headers=auth, json={"name": "Brand"}).status_code
        == 403
    )
    assert (
        client.post(
            BASE + "/voice-profiles",
            headers=auth,
            json={"name": "Brand", "tone_description": "Warm"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            BASE + "/features/voice_profile_training/run",
            headers=auth,
            json={"platform": "shared", "input_data": {"sample_posts": ["A sample"]}},
        ).status_code
        == 403
    )
    usage = client.get("/api/v1/billing/usage", headers=auth).json()
    assert usage["usage"]["plan_code"] == "free" and usage["usage"]["ai_credits"]["limit"] == 20


def test_switch_keeps_profile_facts_separate_and_downgrade_retains_data(client, auth):
    _, workspace = paid()
    first = client.post(BASE + "/brand-profiles", headers=auth, json={"name": "Personal"}).json()
    assert (
        client.patch(
            BASE + "/brand-profile",
            headers=auth,
            json={"bio": "I build bicycles", "sample_posts": ["Ride together."]},
        ).status_code
        == 200
    )
    second = client.post(BASE + "/brand-profiles", headers=auth, json={"name": "Studio"}).json()
    assert (
        client.patch(
            BASE + "/brand-profile", headers=auth, json={"bio": "We design homes"}
        ).status_code
        == 200
    )
    with SessionLocal() as db:
        context = brand_prompt_context(db, workspace, "x")
        assert "design homes" in context and "bicycles" not in context
    selected = client.post(BASE + f"/brand-profiles/{first['id']}/activate", headers=auth).json()
    assert selected["bio"] == "I build bicycles" and selected["sample_posts"] == ["Ride together."]
    assert selected["profile_name"] == "Personal"
    with SessionLocal.begin() as db:
        db.scalar(select(Subscription)).status = "expired"
    preserved = client.get(BASE + "/brand-profile", headers=auth).json()
    assert len(preserved["profiles"]) == 2 and not preserved["can_edit"]
    assert (
        client.post(BASE + f"/brand-profiles/{second['id']}/activate", headers=auth).status_code
        == 403
    )
    with SessionLocal() as db:
        assert brand_prompt_context(db, workspace, "x") == ""
        assert db.scalar(select(func.count()).select_from(VoiceProfile)) == 2


def test_profiles_are_workspace_scoped_and_read_only_members_cannot_switch(client, auth):
    user_id, workspace_id = paid()
    result = client.post(BASE + "/brand-profiles", headers=auth, json={"name": "Private"}).json()
    other_id = str(uuid4())
    with SessionLocal.begin() as db:
        db.add(Workspace(id=other_id, owner_user_id=user_id, name="Other", slug=str(uuid4())))
        db.flush()
        db.add(WorkspaceMembership(workspace_id=other_id, user_id=user_id, role="owner"))
        db.add(
            Subscription(
                workspace_id=other_id,
                user_id=user_id,
                provider_subscription_id=str(uuid4()),
                plan_code="pro",
                status="active",
            )
        )
    other = {**auth, "X-Workspace-ID": other_id}
    for action in ["activate", "train"]:
        assert (
            client.post(
                BASE + f"/brand-profiles/{result['id']}/{action}", headers=other, json={}
            ).status_code
            == 404
        )
    assert client.delete(BASE + f"/brand-profiles/{result['id']}", headers=other).status_code == 404
    assert (
        client.patch(
            BASE + f"/brand-profiles/{result['id']}/name", headers=other, json={"name": "No"}
        ).status_code
        == 404
    )
    with SessionLocal.begin() as db:
        db.scalar(
            select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id)
        ).role = "viewer"
    assert (
        client.post(BASE + f"/brand-profiles/{result['id']}/activate", headers=auth).status_code
        == 403
    )
    assert client.delete(BASE + f"/brand-profiles/{result['id']}", headers=auth).status_code == 403


def test_training_updates_the_selected_profile_and_counts_one_credit(client, auth, monkeypatch):
    _, workspace = paid()

    class VoiceLLM:
        async def generate_structured(self, messages, response_model):
            assert "A real writing sample" in messages[1].content
            return response_model(
                tone_description="Short, direct sentences",
                style_keywords=["Clear"],
                rules=["Avoid filler"],
            ), LLMResponse(content="", total_tokens=25)

    monkeypatch.setattr(service, "default_llm_client", VoiceLLM())
    created = client.post(BASE + "/brand-profiles", headers=auth, json={"name": "Founder"}).json()
    saved = client.patch(
        BASE + "/brand-profile",
        headers=auth,
        json={"bio": "Founder facts", "sample_posts": ["A real writing sample"]},
    ).json()
    response = client.post(
        BASE + f"/brand-profiles/{created['id']}/train",
        headers=auth,
        json={"expected_updated_at": saved["updated_at"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["style_guide"] == "Short, direct sentences"
    assert response.json()["bio"] == "Founder facts" and response.json()["id"] == created["id"]
    assert (
        client.post(
            BASE + f"/brand-profiles/{created['id']}/train",
            headers=auth,
            json={"expected_updated_at": saved["updated_at"]},
        ).status_code
        == 409
    )
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AssistantRun)) == 1
        assert db.scalar(select(func.count()).select_from(VoiceProfile)) == 1
        assert "Short, direct sentences" in brand_prompt_context(db, workspace, "linkedin")


@pytest.mark.anyio
async def test_checkout_explicitly_disables_product_trials(monkeypatch):
    from app.core.config import Settings
    from app.modules.billing.service import create_checkout

    observed = []

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            observed.append(kwargs["json"])
            return httpx.Response(200, json={"checkout_url": "https://checkout.example.com/paid"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: Client())
    await create_checkout(
        Settings(dodo_api_key="test"),
        "product",
        "user",
        "workspace",
        "pro",
        "person@example.com",
        "Person",
    )
    assert observed[0]["subscription_data"]["trial_period_days"] == 0


def test_policy_migration_preserves_bonus_grants_and_other_limits(monkeypatch):
    import importlib.util
    from pathlib import Path

    import sqlalchemy as sa

    spec = importlib.util.spec_from_file_location(
        "plan_policy",
        Path(__file__).parents[1] / "migrations/versions/20261017_plan_brand_profiles.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    plans = sa.Table("plans", metadata, sa.Column("code", sa.String), sa.Column("limits", sa.JSON))
    subscriptions = sa.Table(
        "subscriptions",
        metadata,
        sa.Column("id", sa.String),
        sa.Column("workspace_id", sa.String),
        sa.Column("plan_code", sa.String),
        sa.Column("created_at", sa.DateTime),
    )
    grants = sa.Table(
        "entitlement_grants",
        metadata,
        sa.Column("workspace_id", sa.String),
        sa.Column("capability", sa.String),
        sa.Column("limit_value", sa.Integer),
        sa.Column("source", sa.String),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            plans.insert(),
            [
                {"code": "pro", "limits": {"ai_credits": 1000, "seats": 5, "scheduled_posts": 250}},
                {"code": "custom", "limits": {"ai_credits": 42}},
            ],
        )
        connection.execute(
            subscriptions.insert(),
            {
                "id": "subscription",
                "workspace_id": "workspace",
                "plan_code": "pro",
                "created_at": datetime.now(UTC),
            },
        )
        connection.execute(
            grants.insert(),
            [
                {
                    "workspace_id": "workspace",
                    "capability": "ai_credits",
                    "limit_value": 1000,
                    "source": "plan",
                },
                {
                    "workspace_id": "workspace",
                    "capability": "ai_credits",
                    "limit_value": 9000,
                    "source": "bonus",
                },
            ],
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        module.upgrade()
        limits = connection.scalar(sa.select(plans.c.limits).where(plans.c.code == "pro"))
        assert limits == {
            "ai_credits": 5000,
            "brand_profiles": 5,
            "seats": 5,
            "scheduled_posts": None,
        }
        assert (
            connection.scalar(sa.select(grants.c.limit_value).where(grants.c.source == "plan"))
            == 5000
        )
        assert (
            connection.scalar(sa.select(grants.c.limit_value).where(grants.c.source == "bonus"))
            == 9000
        )
        assert connection.scalar(sa.select(plans.c.limits).where(plans.c.code == "custom")) == {
            "ai_credits": 42
        }


def test_concurrent_profile_creation_cannot_exceed_postgres_allowance(client, auth):
    from concurrent.futures import ThreadPoolExecutor

    with SessionLocal() as db:
        if db.get_bind().dialect.name != "postgresql":
            pytest.skip("PostgreSQL row-lock concurrency check")
    _, workspace = paid("starter")
    for name in ["Personal", "Studio"]:
        assert (
            client.post(BASE + "/brand-profiles", headers=auth, json={"name": name}).status_code
            == 201
        )

    def create(name):
        return client.post(BASE + "/brand-profiles", headers=auth, json={"name": name}).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(create, ["Client one", "Client two"]))
    assert sorted(results) == [201, 403]
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(VoiceProfile)
                .where(VoiceProfile.workspace_id == workspace)
            )
            == 3
        )
