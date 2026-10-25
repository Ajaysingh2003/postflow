#!/usr/bin/env python3
"""Audit rendered HTML without browser sessions or credentials. Standard library only."""

import argparse
import concurrent.futures
import json
import pathlib
import re
import urllib.error
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.robots = ""
        self.meta = {}
        self.headings = []
        self.images = []
        self.links = []
        self.ids = []
        self.structured = []
        self.capture = None
        self.text = ""
        self.jsonld = False
        self.svg_depth = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "svg":
            self.svg_depth += 1
        if a.get("id"):
            self.ids.append(a["id"])
        if (tag == "title" and not self.svg_depth) or re.fullmatch("h[1-6]", tag):
            self.capture = tag
            self.text = ""
        if tag == "meta":
            self.meta[a.get("property") or a.get("name", "")] = a.get("content", "")
            if a.get("name") == "description":
                self.description = a.get("content", "")
            if a.get("name") == "robots":
                self.robots = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href", "")
        if tag == "img":
            self.images.append(a)
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag == "script" and a.get("type") == "application/ld+json":
            self.jsonld = True
            self.text = ""

    def handle_data(self, data):
        if self.capture or self.jsonld:
            self.text += data

    def handle_endtag(self, tag):
        if tag == "svg":
            self.svg_depth -= 1
        if tag == self.capture:
            value = re.sub(r"\s+", " ", self.text).strip()
            if tag == "title":
                self.title = value
            else:
                self.headings.append([int(tag[1]), value])
            self.capture = None
        if tag == "script" and self.jsonld:
            try:
                self.structured.append(json.loads(self.text))
            except ValueError:
                self.structured.append({"invalid": True})
            self.jsonld = False


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


opener = urllib.request.build_opener(NoRedirect)


def fetch(base, route):
    req = urllib.request.Request(base + route, headers={"User-Agent": "Twitterbot/1.0"})
    try:
        response = opener.open(req, timeout=90)
    except urllib.error.HTTPError as e:
        response = e
    doc = Document()
    doc.feed(response.read().decode("utf-8", errors="replace"))
    issues = []
    if response.status == 200:
        if not doc.title:
            issues.append("missing title")
        if len(doc.title) > 60:
            issues.append("title >60")
        if not doc.description:
            issues.append("missing description")
        if len(doc.description) > 155:
            issues.append("description >155")
        if not doc.canonical:
            issues.append("missing canonical")
        if len([h for h in doc.headings if h[0] == 1]) != 1:
            issues.append("H1 count !=1")
        previous = 0
        for level, _ in doc.headings:
            if previous and level > previous + 1:
                issues.append("skipped heading level")
                break
            previous = level
        if any("alt" not in img for img in doc.images):
            issues.append("missing image alt")
        if any(
            not (img.get("width") and img.get("height"))
            and "position:absolute" not in img.get("style", "")
            for img in doc.images
        ):
            issues.append("image dimensions missing")
    return {
        "route": route,
        "status": response.status,
        "redirect": response.headers.get("Location"),
        "title": doc.title,
        "description": doc.description,
        "h1": [h[1] for h in doc.headings if h[0] == 1],
        "canonical": doc.canonical,
        "indexable": response.status == 200 and "noindex" not in doc.robots,
        "robots": doc.robots,
        "issues": issues,
        "headings": doc.headings,
        "images": doc.images,
        "links": doc.links,
        "ids": doc.ids,
        "structured_data": doc.structured,
        "x_robots": response.headers.get("X-Robots-Tag"),
        "meta": doc.meta,
    }


def routes():
    pages = []
    for path in sorted((ROOT / "src/app").rglob("page.tsx")):
        parts = [
            p
            for p in path.relative_to(ROOT / "src/app").parts[:-1]
            if not p.startswith("(")
        ]
        parts = [
            "product" if p == "[product]" else "schedule" if p == "[schedule]" else p
            for p in parts
        ]
        route = "/" + "/".join(parts)
        pages.append((route, str(path.relative_to(ROOT))))
    return pages


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:3000")
    parser.add_argument("--output", default="docs/seo/audit-before")
    args = parser.parse_args()
    inventory = routes()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(
            pool.map(
                lambda r: fetch(args.base, r[0].replace("/[[...section]]", "")),
                inventory,
            )
        )
    for row, (_, source) in zip(results, inventory):
        row["source"] = source
    for field in ["title", "description"]:
        for row in results:
            if (
                row[field]
                and sum(x[field] == row[field] for x in results if x["status"] == 200)
                > 1
                and row["status"] == 200
            ):
                row["issues"].append("duplicate " + field)
    output = ROOT / args.output
    output.with_suffix(".json").write_text(json.dumps(results, indent=2))

    def clean(value):
        return str(value).replace("|", "&#124;").replace("\n", " ")

    lines = [
        "# Rendered SEO route audit",
        "",
        f"Local test origin: `{args.base}`. Anonymous requests using Twitterbot user agent. Private-page redirects report the response before following it. Catch-all settings path represents all its sections.",
        "",
        "| Route | Status | Title | Meta description | H1 | Canonical | Indexable? | Issues |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in results:
        lines.append(
            "| "
            + " | ".join(
                map(
                    clean,
                    [
                        r["route"],
                        r["status"],
                        r["title"],
                        r["description"],
                        "; ".join(r["h1"]),
                        r["canonical"],
                        "yes" if r["indexable"] else "no",
                        "; ".join(r["issues"])
                        or (
                            ("redirect to " + r["redirect"])
                            if r["redirect"]
                            else "none"
                        ),
                    ],
                )
            )
            + " |"
        )
    output.with_suffix(".md").write_text("\n".join(lines) + "\n")
    print(
        json.dumps(
            {
                "routes": len(results),
                "statuses": {
                    s: sum(r["status"] == s for r in results)
                    for s in {r["status"] for r in results}
                },
                "issues": {
                    issue: sum(issue in r["issues"] for r in results)
                    for issue in {i for r in results for i in r["issues"]}
                },
            },
            indent=2,
        )
    )
