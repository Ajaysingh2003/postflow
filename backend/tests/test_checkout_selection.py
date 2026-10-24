import json
from types import SimpleNamespace

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.production import PreflightSettings
from app.modules.billing import service
from app.modules.billing.reconciliation import _plan_code
from app.modules.billing.schemas import CheckoutRequest


@pytest.mark.parametrize(
    "plan,legacy", [("starter", "STARTER"), ("pro", "PRO"), ("business", "AGENCY")]
)
@pytest.mark.parametrize(
    "cycle,legacy_cycle",
    [("monthly", "MONTHLY"), ("quarterly", "QUARTERLY"), ("annually", "YEARLY")],
)
def test_legacy_product_env_names_work_in_runtime_and_preflight(
    tmp_path, monkeypatch, plan, legacy, cycle, legacy_cycle
):
    key = f"PRODUCT_{legacy}_{legacy_cycle}"
    env = tmp_path / "products.env"
    env.write_text(f"{key}=pdt_legacy_fixture\n")
    monkeypatch.setenv(key, "pdt_legacy_fixture")
    settings = Settings(_env_file=env)
    assert settings.dodo_product_id(plan, cycle) == "pdt_legacy_fixture"
    preflight = PreflightSettings(_env_file=None, **{key.lower(): "pdt_legacy_fixture"})
    assert preflight.dodo_product_id(plan, cycle) == "pdt_legacy_fixture"


def test_canonical_product_config_takes_precedence_and_python_field_names_still_work(monkeypatch):
    monkeypatch.setenv("PRODUCT_STARTER_MONTHLY", "pdt_legacy")
    monkeypatch.setenv("DODO_PRODUCT_STARTER", "pdt_canonical")
    assert Settings(_env_file=None).dodo_product_id("starter") == "pdt_canonical"
    assert (
        Settings(_env_file=None, dodo_product_starter="pdt_explicit").dodo_product_id("starter")
        == "pdt_explicit"
    )


@pytest.mark.parametrize("plan", ["starter", "pro", "business"])
@pytest.mark.parametrize("cycle", ["monthly", "quarterly", "annually"])
def test_checkout_selects_the_exact_product_and_reconciliation_recognizes_it(
    client, auth, monkeypatch, plan, cycle
):
    settings = get_settings()
    monkeypatch.setattr(settings, "dodo_api_key", "fixture-key")
    suffix = "" if cycle == "monthly" else f"_{cycle}"
    monkeypatch.setattr(settings, f"dodo_product_{plan}{suffix}", f"pdt_{plan}_{cycle}")
    requests = []

    def checkout_provider(request):
        assert request.url.path == "/checkouts"
        assert request.headers["Authorization"] == "Bearer fixture-key"
        requests.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "checkout_url": "https://checkout.dodopayments.com/session",
                "session_id": "session",
            },
        )

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(
            transport=httpx.MockTransport(checkout_provider), **kwargs
        ),
    )
    payload = {"plan_code": plan, "billing_cycle": cycle}
    assert client.post("/api/v1/billing/checkout", json=payload).status_code == 401
    assert not requests
    response = client.post("/api/v1/billing/checkout", headers=auth, json=payload)
    assert response.status_code == 200, response.text
    assert requests[0]["product_cart"] == [{"product_id": f"pdt_{plan}_{cycle}", "quantity": 1}]
    assert requests[0]["metadata"]["plan_code"] == plan
    assert requests[0]["subscription_data"]["trial_period_days"] == 0
    assert (
        _plan_code(
            settings,
            SimpleNamespace(plan_code=plan),
            SimpleNamespace(product_id=f"pdt_{plan}_{cycle}", status="active"),
        )
        == plan
    )


def test_unconfigured_cycle_never_silently_buys_the_monthly_product(client, auth, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "dodo_api_key", "fixture-key")
    monkeypatch.setattr(settings, "dodo_product_pro", "pdt_monthly")
    monkeypatch.setattr(settings, "dodo_product_pro_annually", None)

    async def unexpected(*args):
        pytest.fail("Unconfigured or invalid checkout reached Dodo")

    monkeypatch.setattr(service, "create_checkout", unexpected)
    for payload in (
        {"plan_code": "pro", "billing_cycle": "annually"},
        {"plan_code": "free"},
        {"plan_code": "unknown"},
        {"plan_code": "pro", "billing_cycle": "annually", "price_id": "pro_monthly"},
    ):
        assert (
            client.post("/api/v1/billing/checkout", headers=auth, json=payload).status_code == 422
        )


def test_legacy_price_key_is_validated_and_preserves_selected_cycle():
    assert CheckoutRequest(plan_code="pro", price_id="pro_annually").billing_cycle == "annually"
    with pytest.raises(ValidationError):
        CheckoutRequest(plan_code="pro", price_id="business_monthly")
    settings = Settings(_env_file=None)
    assert settings.dodo_product_id("free") is None
    assert settings.dodo_product_id("unknown") is None
    assert settings.dodo_product_id("pro", "forever") is None
