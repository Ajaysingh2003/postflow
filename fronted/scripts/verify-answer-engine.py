#!/usr/bin/env python3
"""Check public answer content and entity markup in raw server HTML (no JS/session)."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://draftva.com"


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.ids = set()
        self.nodes = []
        self.script = None
        self.blocked = 0
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "script":
            self.script = "" if attrs.get("type") == "application/ld+json" else None
        if tag in ("script", "style", "svg"):
            self.blocked += 1

    def handle_data(self, data):
        if self.script is not None:
            self.script += data
        elif not self.blocked:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            parsed = json.loads(self.script)
            self.nodes.extend(parsed.get("@graph", [parsed]))
            self.script = None
        if tag in ("script", "style", "svg"):
            self.blocked = max(0, self.blocked - 1)


def request(base, path):
    req = urllib.request.Request(
        base.rstrip("/") + path,
        headers={"User-Agent": "OAI-SearchBot"},
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.status, response.headers, response.read().decode("utf-8")


def verify(base, path):
    errors = []
    status, headers, html = request(base, path)
    if status != 200:
        errors.append("public page did not return 200")
    if "noindex" in headers.get("X-Robots-Tag", ""):
        errors.append("public page is noindex")
    if '<https://draftva.com/llms.txt>; rel="describedby"' not in headers.get("Link", ""):
        errors.append("public discovery header missing")
    page = Page()
    page.feed(html)
    if page.h1_count != 1:
        errors.append(f"expected one H1, got {page.h1_count}")
    url = ORIGIN + ("/" if path == "/" else path)
    nodes = {node.get("@id"): node for node in page.nodes}
    entity = nodes.get(f"{url}#webpage", {})
    if entity.get("isPartOf", {}).get("@id") != ORIGIN + "/#website":
        errors.append("page is not linked to the canonical website entity")
    if entity.get("url") != url:
        errors.append("page entity URL differs from canonical URL")
    if ORIGIN + "/#organization" not in nodes:
        errors.append("organization entity missing")
    text = normalize(" ".join(page.text))
    count = 0
    for node in page.nodes:
        if node.get("@type") != "FAQPage":
            continue
        for question in node.get("mainEntity", []):
            count += 1
            if normalize(question["name"]) not in text:
                errors.append("schema question missing from HTML text: " + question["name"])
            if normalize(question["acceptedAnswer"]["text"]) not in text:
                errors.append("schema answer missing from HTML text: " + question["name"])
            anchor = urllib.parse.urlparse(question["@id"]).fragment
            if anchor not in page.ids:
                errors.append("question fragment missing: " + anchor)
    needs_answers = path in ("/", "/about", "/pricing") or path.startswith("/product/")
    if needs_answers and not count:
        errors.append("product/company page has no answers")
    return {"path": path, "questions": count, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:3000")
    parser.add_argument("--output", default="docs/seo/answer-engine-verification.json")
    args = parser.parse_args()
    paths = [item["path"] for item in json.loads((ROOT / "src/lib/seo/routes.generated.json").read_text())]
    with ThreadPoolExecutor(max_workers=3) as pool:
        pages = list(pool.map(lambda path: verify(args.base, path), paths))
    errors = []
    status, headers, guide = request(args.base, "/llms.txt")
    if status != 200 or not headers.get_content_type() == "text/plain":
        errors.append("llms.txt must return 200 text/plain")
    linked = [urllib.parse.urlparse(link).path for link in re.findall(r"\]\((https://draftva\.com[^)]+)\)", guide)]
    if sorted(linked) != sorted(paths):
        errors.append("llms.txt links differ from canonical public pages")
    robots = request(args.base, "/robots.txt")[2]
    for path in ("/dashboard", "/settings", "/api", "/login", "/invitations"):
        if f"Disallow: {path}\n" not in robots:
            errors.append("private robots exclusion missing: " + path)
    result = {
        "base_url": args.base,
        "rendering": "server HTML without JavaScript",
        "canonical_pages": len(pages),
        "answer_pages": sum(page["questions"] > 0 for page in pages),
        "questions": sum(page["questions"] for page in pages),
        "pages": pages,
        "errors": errors,
    }
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    return bool(errors or any(page["errors"] for page in pages))


if __name__ == "__main__":
    raise SystemExit(main())
