import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SEO_PAGES,
  seoMetadata,
  PRIVATE_METADATA,
  isPrivatePath,
  SITE_URL,
} from "../src/lib/seo/config";

describe("marketing metadata", () => {
  test("all canonical pages have unique concise titles/descriptions and social cards", () => {
    const titles = new Set();
    const descriptions = new Set();
    for (const [path, page] of Object.entries(SEO_PAGES)) {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeLessThanOrEqual(155);
      expect(titles.has(page.title)).toBe(false);
      titles.add(page.title);
      expect(descriptions.has(page.description)).toBe(false);
      descriptions.add(page.description);
      const metadata = seoMetadata(path);
      expect(metadata.alternates?.canonical).toBe(
        new URL(path, SITE_URL).toString(),
      );
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
      expect(metadata.openGraph).toMatchObject({
        type: "website",
        url: new URL(path, SITE_URL).toString(),
      });
      expect(metadata.robots).toMatchObject({ index: true, follow: true });
    }
  });
  test("all public page files explicitly declare metadata or a permanent redirect", () => {
    function inspect(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) {
          expect(entry.name.startsWith("[")).toBe(false);
          inspect(file);
        }
        if (entry.name === "page.tsx")
          expect(readFileSync(file, "utf8")).toMatch(
            /seoMetadata\(|permanentRedirect\(/,
          );
      }
    }
    inspect("src/app/(home)");
    inspect("src/app/(legal)");
  });
  test("private pages are noindex without a homepage canonical", () => {
    expect(PRIVATE_METADATA.robots).toMatchObject({ index: false });
    expect(PRIVATE_METADATA.alternates?.canonical).toBeNull();
    for (const path of [
      "/dashboard",
      "/dashboard/posts",
      "/api/trpc/user",
      "/login",
      "/settings/billing",
      "/invitations/accept",
    ])
      expect(isPrivatePath(path)).toBe(true);
    expect(isPrivatePath("/pricing")).toBe(false);
  });
});

import { canonicalRedirect } from "../src/lib/seo/redirects";
import {
  applicationSchema,
  pageStructuredData,
  serializeJsonLd,
} from "../src/lib/seo/structured-data";
import { PRICING_FAQS } from "../src/modules/billing/pricing-faqs";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";

test("redirects normalize production URLs in one hop and preserve queries", () => {
  expect(
    canonicalRedirect("http://www.draftva.com/terms-of-service/?ref=x"),
  ).toBe("https://draftva.com/terms?ref=x");
  expect(canonicalRedirect("https://draftva.com/pricing")).toBeNull();
  expect(canonicalRedirect("http://localhost:3000/pricing")).toBeNull();
  expect(canonicalRedirect("http://localhost:3000/privacy-policy/")).toBe(
    "http://localhost:3000/privacy",
  );
  expect(
    canonicalRedirect("http://internal:3000/pricing", "draftva.com", "https"),
  ).toBeNull();
  expect(
    canonicalRedirect("http://internal:3000/pricing", "draftva.com", "http"),
  ).toBe("https://draftva.com/pricing");
});
test("previous image URLs keep a direct permanent destination", () => {
  expect(canonicalRedirect("http://www.draftva.com/dashboard/home.png/")).toBe(
    "https://draftva.com/images/product/home-dashboard-preview.png",
  );
  expect(canonicalRedirect("http://localhost:3000/logo.jpg")).toBe(
    "http://localhost:3000/images/brand/draftva-logo.jpg",
  );
});
test("structured data uses actual catalog prices and omits unverified ratings", () => {
  const plans = {
    starter: {
      name: "Starter",
      billing_cycles: { monthly: { amount: 12.34, currency: "EUR" } },
    },
  };
  const app = applicationSchema(plans);
  expect(app.offers[0]).toMatchObject({ price: 12.34, priceCurrency: "EUR" });
  expect(app).not.toHaveProperty("aggregateRating");
  expect(applicationSchema()).not.toHaveProperty("offers");
  expect(
    applicationSchema({
      invalid: {
        name: "Invalid",
        billing_cycles: { monthly: { amount: NaN } },
      },
    }),
  ).not.toHaveProperty("offers");
  const graph = pageStructuredData("/pricing", plans)["@graph"];
  const faq = graph.find((x) => x["@type"] === "FAQPage");
  expect(faq.mainEntity.map((x) => x.name)).toEqual(
    PRICING_FAQS.filter((x) => x.includeInSchema).map((x) => x.question),
  );
  expect(JSON.parse(serializeJsonLd(graph))).toEqual(graph);
  expect(serializeJsonLd({ text: "</script><img src=x>" })).not.toContain("<");
  expect(pageStructuredData("/")["@graph"].map((x) => x["@type"])).toEqual([
    "Organization",
    "WebSite",
    "WebPage",
    "SoftwareApplication",
    "FAQPage",
  ]);
  expect(
    pageStructuredData("/privacy")
      ["@graph"].find((node) => node["@type"] === "BreadcrumbList")
      .itemListElement.map((x) => x.position),
  ).toEqual([1, 2, 3]);
});
test("generated sitemap contains every canonical marketing page and no private URLs", () => {
  const entries = sitemap();
  expect(entries.map((x) => new URL(x.url).pathname).sort()).toEqual(
    Object.keys(SEO_PAGES).sort(),
  );
  for (const entry of entries) {
    expect(isPrivatePath(new URL(entry.url).pathname)).toBe(false);
    expect(Number.isNaN(new Date(entry.lastModified).valueOf())).toBe(false);
  }
  expect(robots().sitemap).toBe("https://draftva.com/sitemap.xml");
  expect(robots().rules.disallow).toContain("/dashboard");
});
test("social image placeholders exist and have 1200x630 PNG dimensions", () => {
  for (const page of Object.values(SEO_PAGES)) {
    const png = readFileSync(`public/images/og/${page.image}.png`);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }
});
