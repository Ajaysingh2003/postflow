#!/usr/bin/env python3
"""Verify rendered SEO on a running preview/production build. No credentials required."""

import argparse
import importlib.util
import json
import pathlib
import sys
import urllib.parse

spec = importlib.util.spec_from_file_location(
    "seo_audit", pathlib.Path(__file__).with_name("audit-seo.py")
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
p = argparse.ArgumentParser()
p.add_argument("--base", default="http://localhost:3000")
p.add_argument("--audit", default="docs/seo/audit-after.json")
a = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
rows = json.loads((root / a.audit).read_text())
manifest = json.loads((root / "src/lib/seo/routes.generated.json").read_text())
paths = {r["path"] for r in manifest}
errors = []
by_path = {r["route"]: r for r in rows}
for path in paths:
    r = by_path[path]
    if r["status"] != 200 or not r["indexable"] or r["issues"]:
        errors.append([path, "page", r["status"], r["issues"]])
    if r["canonical"].rstrip("/") != (
        "https://draftva.com" + ("" if path == "/" else path)
    ):
        errors.append([path, "canonical", r["canonical"]])
    if not r["structured_data"] or any(x.get("invalid") for x in r["structured_data"]):
        errors.append([path, "missing/invalid JSON-LD"])
    for field in [
        "og:title",
        "og:description",
        "og:type",
        "og:url",
        "og:image",
        "twitter:card",
    ]:
        if not r.get("meta", {}).get(field):
            errors.append([path, "missing social tag", field])
    for href in set(r["links"]):
        if not href or href.startswith(("mailto:", "tel:")):
            continue
        url = urllib.parse.urlparse(
            urllib.parse.urljoin("https://draftva.com" + path, href)
        )
        if url.netloc != "draftva.com":
            continue
        target = url.path or "/"
        if target not in by_path:
            result = m.fetch(a.base, target)
            if result["status"] >= 400:
                errors.append([path, href, "broken destination", result["status"]])
        elif by_path[target]["status"] >= 400:
            errors.append([path, href, "error destination"])
        if (
            url.fragment
            and target in by_path
            and url.fragment not in by_path[target]["ids"]
        ):
            errors.append([path, href, "missing fragment"])
    for img in r["images"]:
        if "alt" not in img or not (img.get("width") and img.get("height")):
            errors.append([path, "image attributes", img.get("src")])
        src = img.get("src", "")
        if src.startswith("/_next/image"):
            src = urllib.parse.parse_qs(urllib.parse.urlparse(src).query)["url"][0]
        if (
            src.startswith("/")
            and not (root / "public" / urllib.parse.unquote(src).lstrip("/")).exists()
        ):
            errors.append([path, "missing image", src])
# Every canonical page must be reachable through crawlable rendered links from home.
reachable = {"/"}
while True:
    before = len(reachable)
    for source in reachable.copy():
        for href in by_path[source]["links"]:
            u = urllib.parse.urlparse(
                urllib.parse.urljoin("https://draftva.com" + source, href)
            )
            if u.netloc == "draftva.com" and u.path in paths:
                reachable.add(u.path)
    if len(reachable) == before:
        break
for orphan in sorted(paths - reachable):
    errors.append([orphan, "orphan marketing page"])
for path in [
    "/missing-page-for-seo-check",
    "/product/not-a-feature",
    "/anything/schedule",
]:
    r = m.fetch(a.base, path)
    if r["status"] != 404:
        errors.append([path, "expected real 404", r["status"]])
for source, target in {
    "/terms-of-service/": "/terms",
    "/privacy-policy/": "/privacy",
    "/cookie-policy/": "/cookies",
    "/sub-processors/": "/subprocessors",
    "/pricing/": "/pricing",
}.items():
    r = m.fetch(a.base, source)
    if r["status"] != 308 or urllib.parse.urlparse(r["redirect"] or "").path != target:
        errors.append([source, "wrong redirect", r["status"], r["redirect"]])
    if m.fetch(a.base, target)["status"] != 200:
        errors.append([source, "redirect chain or failing target"])
for path in ["/login", "/dashboard", "/settings/billing", "/onboarding"]:
    r = m.fetch(a.base, path)
    if "noindex" not in (r["x_robots"] or ""):
        errors.append([path, "missing X-Robots-Tag"])
(root / "docs/seo/verification.json").write_text(
    json.dumps({"canonical_pages": len(paths), "errors": errors}, indent=2) + "\n"
)
print(json.dumps({"canonical_pages": len(paths), "errors": errors}, indent=2))
sys.exit(bool(errors))
