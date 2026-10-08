"""Read live Meta insights without letting one unsupported metric hide all others."""

from typing import Any

import httpx


def count(value: Any) -> int | None:
    # Missing values, breakdown dictionaries and booleans are not numeric counts.
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
        return int(value)
    return None


def insight_values(data: dict) -> dict[str, int]:
    result = {}
    for item in data.get("data", []):
        value = count((item.get("total_value") or {}).get("value"))
        if value is None:
            samples = item.get("values") or []
            # Account requests explicitly cover one day; media metrics are lifetime.
            # Do not add overlapping unique-user counts across periods.
            value = count(samples[-1].get("value")) if samples else None
        if value is not None and isinstance(item.get("name"), str):
            result[item["name"]] = value
    return result


def _error(response: httpx.Response) -> dict:
    try:
        return response.json().get("error", {})
    except (ValueError, AttributeError):
        return {}


def _invalid_metric(response: httpx.Response) -> bool:
    error = _error(response)
    message = str(error.get("message", "")).lower()
    return error.get("code") == 100 and "metric" in message


def _notice(response: httpx.Response, platform: str, permissions: str | None) -> str:
    code = _error(response).get("code")
    if code == 190 or response.status_code == 401:
        return f"Reconnect {platform}: the access token cannot read insights."
    if code in {10, 200} or response.status_code == 403:
        permission = permissions or (
            "read_insights and pages_read_engagement, and the Page ANALYZE task"
            if platform == "Facebook"
            else "instagram_business_manage_insights for a professional account"
        )
        return f"{platform} insights require {permission}. Check access or reconnect."
    if code in {4, 17, 32, 613, 80001} or response.status_code == 429:
        return f"{platform} has limited insights requests. Try again later."
    return f"Some {platform} insights are unavailable for this account or content type."


async def fetch_insights(
    client: httpx.AsyncClient,
    url: str,
    params: dict,
    metrics: list[str],
    platform: str,
    permissions: str | None = None,
) -> tuple[dict[str, int], str | None]:
    async def request(names: list[str]) -> httpx.Response:
        return await client.get(url, params={**params, "metric": ",".join(names)})

    values = {}
    try:
        response = await request(metrics)
        if response.status_code == 200:
            values = insight_values(response.json())
            missing = set(metrics) - values.keys()
            notice = (
                f"Some {platform} insights have no data yet or are unavailable for this content."
                if missing
                else None
            )
            return values, notice
        if not _invalid_metric(response) or len(metrics) == 1:
            return {}, _notice(response, platform, permissions)

        values = {}
        notice = None
        # Only invalid metric errors justify extra requests. Auth/permission/rate
        # failures stop immediately, rather than multiplying calls to Meta.
        for metric in metrics:
            response = await request([metric])
            if response.status_code == 200:
                values.update(insight_values(response.json()))
            else:
                notice = _notice(response, platform, permissions)
                if not _invalid_metric(response):
                    break
        if set(metrics) - values.keys() and not notice:
            notice = (
                f"Some {platform} insights have no data yet or are unavailable for this content."
            )
        return values, notice
    except httpx.RequestError:
        return values, f"{platform} insights could not be reached. Try again later."


def coverage(values: dict[str, int], notice: str | None, **extras: Any) -> dict:
    return {
        **extras,
        "metrics_status": "partial" if values else "unavailable",
        "available_metrics": sorted(values),
        "metrics_notice": notice,
    }
