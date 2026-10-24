import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.billing import catalog
from app.modules.billing.models import Plan


class FakeRedis:
    def __init__(self):
        self.data, self.now = {}, 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def get(self, key):
        value, expires = self.data.get(key, (None, 0))
        return value if expires > self.now else None

    async def set(self, key, value, *, nx=False, ex):
        if nx and await self.get(key) is not None:
            return False
        self.data[key] = value, self.now + ex
        return True

    async def delete(self, key):
        self.data.pop(key, None)

    async def eval(self, script, count, key, token):
        if await self.get(key) == token:
            await self.delete(key)


def product(product_id, cycle="quarterly", amount=4321, currency="USD"):
    return {
        "product_id": product_id,
        "is_recurring": True,
        "private_delivery": "must-not-reach-the-browser",
        "price": {
            "type": "recurring_price",
            "price": amount,
            "currency": currency,
            "payment_frequency_count": 3 if cycle == "quarterly" else 1,
            "payment_frequency_interval": "Year" if cycle == "annually" else "Month",
            "discount_bps": 0,
            "tax_inclusive": False,
        },
    }


@pytest.fixture
def provider(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "dodo_api_key", "isolated-provider-key")
    monkeypatch.setattr(settings, "billing_catalog_timeout_seconds", 1)
    documents = {}
    for plan in catalog.PLAN_CODES:
        for cycle in catalog.CYCLES:
            product_id = f"pdt_{plan}_{cycle}"
            field = f"dodo_product_{plan}" + (f"_{cycle}" if cycle != "monthly" else "")
            monkeypatch.setattr(settings, field, product_id)
            documents[product_id] = product(product_id, cycle)
    redis = FakeRedis()
    state = SimpleNamespace(
        settings=settings, redis=redis, documents=documents, calls=[], active=0, peak=0, status=200
    )

    async def handler(request):
        assert request.headers["Authorization"] == "Bearer isolated-provider-key"
        product_id = request.url.path.rsplit("/", 1)[-1]
        state.calls.append(product_id)
        state.active += 1
        state.peak = max(state.active, state.peak)
        await asyncio.sleep(0.005)
        state.active -= 1
        return httpx.Response(
            state.status,
            json=documents[product_id]
            if state.status == 200
            else {"message": "private-provider-error"},
        )

    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(catalog, "connection", lambda settings: redis)
    monkeypatch.setattr(
        catalog,
        "httpx",
        SimpleNamespace(
            AsyncClient=lambda **kwargs: httpx.AsyncClient(transport=transport, **kwargs),
            HTTPError=httpx.HTTPError,
        ),
    )
    return state


@pytest.mark.parametrize(
    "currency,minor,expected,decimals",
    [
        ("USD", 1234, 12.34, 2),
        ("INR", 45000, 450, 2),
        ("JPY", 1250, 1250, 0),
        ("KWD", 1234, 1.234, 3),
    ],
)
def test_normalizes_provider_minor_units_without_exposing_private_product_fields(
    currency, minor, expected, decimals
):
    price = catalog.normalize_product(
        product("selected", amount=minor, currency=currency), "selected", "starter", "quarterly"
    )
    assert price["amount"] == expected and price["currency_decimals"] == decimals
    assert price["interval"] == "quarter"
    assert "private_delivery" not in price and "product_id" not in price


@pytest.mark.parametrize(
    "mutation",
    [
        lambda p: p.update(product_id="wrong"),
        lambda p: p.update(is_recurring=False),
        lambda p: p["price"].update(type="usage_based_price"),
        lambda p: p["price"].update(payment_frequency_count=6),
        lambda p: p["price"].update(payment_frequency_count=True),
        lambda p: p["price"].update(price=-1),
        lambda p: p["price"].update(price="2400"),
        lambda p: p["price"].update(currency="invalid"),
        lambda p: p["price"].update(discount_bps=10001),
    ],
)
def test_invalid_or_mismatched_products_never_become_prices(mutation):
    value = product("selected")
    mutation(value)
    with pytest.raises(ValueError):
        catalog.normalize_product(value, "selected", "starter", "quarterly")


@pytest.mark.anyio
async def test_shared_cache_collapses_concurrent_requests_and_expires_price_changes(provider):
    results = await asyncio.gather(*(catalog.get_prices(provider.settings) for _ in range(6)))
    assert len(provider.calls) == 9
    assert provider.peak <= 3
    assert all(result["starter"]["monthly"]["amount"] == 43.21 for result in results)
    provider.documents["pdt_starter_monthly"]["price"]["price"] = 1577
    assert (await catalog.get_prices(provider.settings))["starter"]["monthly"]["amount"] == 43.21
    provider.redis.now += 61
    assert (await catalog.get_prices(provider.settings))["starter"]["monthly"]["amount"] == 15.77
    assert len(provider.calls) == 18


def test_endpoint_prices_come_from_dodo_but_limits_are_read_fresh_from_sql(client, provider):
    first = client.get("/api/v1/billing/plans")
    assert first.status_code == 200
    assert first.headers["cache-control"] == "no-store"
    assert first.json()["starter"]["billing_cycles"]["monthly"]["amount"] == 43.21
    with SessionLocal.begin() as db:
        row = db.scalar(select(Plan).where(Plan.code == "starter"))
        if row is None:
            row = Plan(code="starter", name="Starter", active=True)
            db.add(row)
        row.limits = {"ai_credits": 123}
    second = client.get("/api/v1/billing/plans")
    assert second.json()["starter"]["limits"]["ai_credits"] == 123
    assert len(provider.calls) == 9
    assert "private-provider" not in second.text and "isolated-provider-key" not in second.text


@pytest.mark.parametrize("status", [401, 404, 429, 500])
def test_provider_errors_are_redacted_and_negatively_cached_without_fallback_prices(
    client, provider, status
):
    provider.status = status
    first = client.get("/api/v1/billing/plans")
    assert first.status_code == 503
    assert "Retry-After" in first.headers
    assert "private-provider-error" not in first.text
    reads = len(provider.calls)
    second = client.get("/api/v1/billing/plans")
    assert second.status_code == 503 and len(provider.calls) == reads


@pytest.mark.anyio
async def test_cache_identity_changes_with_product_mapping_provider_mode_and_key(provider):
    settings = provider.settings
    original = catalog.cache_key(settings, catalog.product_bindings(settings))
    for update in (
        {"dodo_api_key": "another-key"},
        {"dodo_api_base": "https://test.dodopayments.com/another-mode"},
        {"dodo_product_starter": "other-product"},
    ):
        changed = settings.model_copy(update=update)
        assert catalog.cache_key(changed, catalog.product_bindings(changed)) != original
    assert "isolated-provider-key" not in original


@pytest.mark.anyio
async def test_malformed_cached_snapshot_is_replaced_and_foreign_lock_is_not_deleted(provider):
    key = catalog.cache_key(provider.settings, catalog.product_bindings(provider.settings))
    await provider.redis.set(key, json.dumps({"starter": {}}), ex=60)
    prices = await catalog.get_prices(provider.settings)
    assert len(prices) == 3 and len(provider.calls) == 9
    await provider.redis.set(key + ":lock", "new-owner", ex=60)
    await provider.redis.eval(catalog.RELEASE, 1, key + ":lock", "expired-owner")
    assert await provider.redis.get(key + ":lock") == "new-owner"


@pytest.mark.anyio
async def test_redis_outage_and_missing_config_never_trigger_uncached_provider_fanout(
    provider, monkeypatch
):
    class UnavailableRedis(FakeRedis):
        async def get(self, key):
            raise RedisConnectionError("sensitive-connection-string")

    monkeypatch.setattr(catalog, "connection", lambda settings: UnavailableRedis())
    with pytest.raises(HTTPException) as failure:
        await catalog.get_prices(provider.settings)
    assert failure.value.status_code == 503 and not provider.calls
    for update in (
        {"dodo_api_key": None},
        {"dodo_product_pro_quarterly": None},
        {"dodo_product_pro": "pdt_starter_monthly"},
    ):
        with pytest.raises(HTTPException):
            await catalog.get_prices(provider.settings.model_copy(update=update))
    assert not provider.calls


@pytest.mark.anyio
async def test_waiting_for_another_worker_is_bounded_without_releasing_its_lock(
    provider, monkeypatch
):
    key = catalog.cache_key(provider.settings, catalog.product_bindings(provider.settings))
    await provider.redis.set(key + ":lock", "another-worker", ex=60)
    ticks = iter([0, 10])
    monkeypatch.setattr(catalog, "time", SimpleNamespace(monotonic=lambda: next(ticks)))
    with pytest.raises(HTTPException) as failure:
        await catalog.get_prices(provider.settings)
    assert failure.value.status_code == 503 and not provider.calls
    assert await provider.redis.get(key + ":lock") == "another-worker"


@pytest.mark.anyio
async def test_provider_timeout_does_not_cache_partial_prices_and_releases_the_lease(
    provider, monkeypatch
):
    async def timeout(settings, products):
        raise TimeoutError("upstream")

    monkeypatch.setattr(catalog, "fetch_prices", timeout)
    with pytest.raises(HTTPException):
        await catalog.get_prices(provider.settings)
    key = catalog.cache_key(provider.settings, catalog.product_bindings(provider.settings))
    assert await provider.redis.get(key) is None
    assert await provider.redis.get(key + ":lock") is None
    assert await provider.redis.get(key + ":error") == "1"
