"""Pagination for Meta account edges, constrained to the official API host."""

from urllib.parse import urlsplit


async def graph_items(client, response):
    items = []
    visited = set()
    while True:
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise TypeError("Invalid Meta account edge response")
        items.extend(data["data"])
        next_url = data.get("paging", {}).get("next")
        if not next_url:
            return items
        parsed = urlsplit(next_url)
        if (
            parsed.scheme != "https"
            or parsed.hostname != "graph.facebook.com"
            or parsed.username
            or parsed.password
            or parsed.port not in {None, 443}
            or next_url in visited
        ):
            raise RuntimeError("Invalid Meta pagination URL")
        visited.add(next_url)
        response = await client.get(next_url)
