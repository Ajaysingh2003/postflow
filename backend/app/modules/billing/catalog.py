"""Public prices from configured Dodo products; workspace entitlements stay in SQL."""

import asyncio
import hashlib
import json
import logging
import secrets
import time
from decimal import Decimal
from typing import Literal
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictInt, TypeAdapter
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import Settings
from app.modules.billing.service import _api_headers

logger = logging.getLogger(__name__)
PLAN_CODES = ("starter", "pro", "business")
CYCLES = ("monthly", "quarterly", "annually")
ZERO_DECIMAL = frozenset(
    [
        "BIF",
        "CLP",
        "DJF",
        "GNF",
        "JPY",
        "KMF",
        "KRW",
        "PYG",
        "RWF",
        "UGX",
        "VND",
        "VUV",
        "XAF",
        "XOF",
        "XPF",
    ]
)
THREE_DECIMAL = frozenset(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"])
RELEASE = (
    "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0"
)


class CatalogPrice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: float = Field(ge=0, allow_inf_nan=False)
    amount_minor: StrictInt = Field(ge=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    currency_decimals: StrictInt = Field(ge=0, le=3)
    price_id: str
    interval: Literal["month", "quarter", "year"]
    payment_frequency_count: StrictInt = Field(gt=0)
    payment_frequency_interval: Literal["Month", "Year"]
    tax_inclusive: bool
    discount_bps: StrictInt = Field(ge=0, le=10000)


snapshot_type = TypeAdapter(dict[str, dict[str, CatalogPrice]])


def unavailable() -> HTTPException:
    return HTTPException(
        503, "Pricing is temporarily unavailable. Please try again.", headers={"Retry-After": "10"}
    )


def normalize_product(product: dict, product_id: str, plan: str, cycle: str) -> dict:
    if (
        not isinstance(product, dict)
        or product.get("product_id") != product_id
        or product.get("is_recurring") is not True
    ):
        raise ValueError("Invalid recurring product")
    price = product.get("price")
    if not isinstance(price, dict) or price.get("type") != "recurring_price":
        raise ValueError("Only fixed recurring prices are supported")
    count, unit = price.get("payment_frequency_count"), price.get("payment_frequency_interval")
    allowed = {
        "monthly": {(1, "Month")},
        "quarterly": {(3, "Month")},
        "annually": {(1, "Year"), (12, "Month")},
    }
    if type(count) is not int or (count, unit) not in allowed[cycle]:
        raise ValueError("Dodo product does not match its billing cycle")
    currency, minor = price.get("currency"), price.get("price")
    if not isinstance(currency, str) or type(minor) is not int or minor < 0:
        raise ValueError("Invalid amount or currency")
    decimals = 0 if currency in ZERO_DECIMAL else 3 if currency in THREE_DECIMAL else 2
    discount = price.get("discount_bps")
    if discount is None:
        legacy = price.get("discount") or 0
        if type(legacy) is not int or not 0 <= legacy <= 100:
            raise ValueError("Invalid product discount")
        discount = legacy * 100
    value = CatalogPrice(
        amount=float(Decimal(minor) / (10**decimals)),
        amount_minor=minor,
        currency=currency,
        currency_decimals=decimals,
        price_id=f"{plan}_{cycle}",
        interval={"monthly": "month", "quarterly": "quarter", "annually": "year"}[cycle],
        payment_frequency_count=count,
        payment_frequency_interval=unit,
        tax_inclusive=price.get("tax_inclusive") is True,
        discount_bps=discount,
    )
    return value.model_dump()


def product_bindings(settings: Settings) -> dict:
    if not settings.dodo_api_key:
        raise unavailable()
    products = {
        plan: {cycle: settings.dodo_product_id(plan, cycle) for cycle in CYCLES}
        for plan in PLAN_CODES
    }
    if any(not product for cycles in products.values() for product in cycles.values()):
        raise unavailable()
    # A mapping mistake must never advertise a different tier using the same product.
    if len({product for cycles in products.values() for product in cycles.values()}) != 9:
        raise unavailable()
    return products


def cache_key(settings: Settings, products: dict) -> str:
    identity = json.dumps([settings.dodo_api_base, settings.dodo_api_key, products], sort_keys=True)
    return "billing:prices:v1:" + hashlib.sha256(identity.encode()).hexdigest()


def connection(settings: Settings):
    return Redis.from_url(
        settings.redis_url, decode_responses=True, socket_connect_timeout=1, socket_timeout=1
    )


async def fetch_prices(settings: Settings, products: dict) -> dict:
    semaphore = asyncio.Semaphore(3)
    async with httpx.AsyncClient(timeout=5, follow_redirects=False) as client:

        async def fetch(plan, cycle, product_id):
            async with semaphore:
                response = await client.get(
                    f"{settings.dodo_api_base.rstrip('/')}/products/{quote(product_id, safe='')}",
                    headers=_api_headers(settings),
                )
                response.raise_for_status()
                return plan, cycle, normalize_product(response.json(), product_id, plan, cycle)

        tasks = [
            asyncio.create_task(fetch(plan, cycle, product))
            for plan, cycles in products.items()
            for cycle, product in cycles.items()
        ]
        try:
            async with asyncio.timeout(settings.billing_catalog_timeout_seconds):
                rows = await asyncio.gather(*tasks)
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    result = {plan: {} for plan in PLAN_CODES}
    for plan, cycle, price in rows:
        result[plan][cycle] = price
    return result


def decode_snapshot(raw: str) -> dict:
    values = snapshot_type.validate_json(raw)
    if set(values) != set(PLAN_CODES) or any(
        set(cycles) != set(CYCLES) for cycles in values.values()
    ):
        raise ValueError("Incomplete cached catalog")
    return {
        plan: {cycle: price.model_dump() for cycle, price in cycles.items()}
        for plan, cycles in values.items()
    }


async def get_prices(settings: Settings) -> dict:
    products = product_bindings(settings)
    key = cache_key(settings, products)
    lease = secrets.token_hex(16)
    try:
        async with connection(settings) as redis:
            deadline = time.monotonic() + settings.billing_catalog_timeout_seconds + 2
            while True:
                cached = await redis.get(key)
                if cached:
                    try:
                        return decode_snapshot(cached)
                    except ValueError:
                        await redis.delete(key)
                if await redis.get(key + ":error"):
                    raise unavailable()
                if await redis.set(
                    key + ":lock", lease, nx=True, ex=settings.billing_catalog_timeout_seconds + 5
                ):
                    break
                if time.monotonic() >= deadline:
                    raise unavailable()
                await asyncio.sleep(0.1)
            try:
                # Another worker may have filled the cache just before our lock.
                cached = await redis.get(key)
                if cached:
                    return decode_snapshot(cached)
                prices = await fetch_prices(settings, products)
                await redis.set(
                    key, json.dumps(prices), ex=settings.billing_catalog_cache_ttl_seconds
                )
                return prices
            except (httpx.HTTPError, TimeoutError, ValueError, TypeError, KeyError):
                logger.warning("Dodo pricing lookup failed; no fallback prices were returned")
                await redis.set(key + ":error", "1", ex=10)
                raise unavailable() from None
            finally:
                await redis.eval(RELEASE, 1, key + ":lock", lease)
    except RedisError:
        logger.warning("Dodo pricing cache unavailable")
        raise unavailable() from None
