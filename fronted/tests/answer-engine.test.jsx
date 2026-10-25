import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ANSWER_PAGES } from "../src/lib/seo/answers";
import { SEO_PAGES, seoMetadata, SITE_URL } from "../src/lib/seo/config";
import {
  ENTITY_IDS,
  pageStructuredData,
  pageQuestions,
} from "../src/lib/seo/structured-data";
import { AnswerSection } from "../src/modules/home/component/AnswerSection";
import PricingFaqSection from "../src/modules/billing/component/PricingFaqSection";
import { llmsText } from "../src/lib/seo/llms";
import { GET } from "../src/app/llms.txt/route";
import robots from "../src/app/robots";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

const textOf = (html) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("answer engine content and structured data", () => {
  for (const path of [...Object.keys(ANSWER_PAGES), "/pricing"]) {
    test(`${path} ships every schema answer in server HTML with real fragment targets`, () => {
      const html = renderToStaticMarkup(
        path === "/pricing" ? (
          <PricingFaqSection />
        ) : (
          <AnswerSection path={path} />
        ),
      );
      const text = textOf(html);
      const graph = pageStructuredData(path)["@graph"];
      const faq = graph.find((node) => node["@type"] === "FAQPage");
      const questions = pageQuestions(path);
      expect(faq.mainEntity).toHaveLength(questions.length);
      faq.mainEntity.forEach((item, index) => {
        expect(text).toContain(item.name);
        expect(text).toContain(item.acceptedAnswer.text);
        expect(html).toContain(`id="${questions[index].id}"`);
        expect(item["@id"]).toBe(
          `${new URL(path, SITE_URL)}#${questions[index].id}`,
        );
      });
      expect(html).not.toContain("<h1");
      if (path !== "/pricing") {
        expect(html.match(/<details\b/g)).toHaveLength(questions.length);
        expect(html.match(/<summary\b/g)).toHaveLength(questions.length);
        for (const link of ANSWER_PAGES[path].related) {
          expect(SEO_PAGES).toHaveProperty(link.path);
          expect(html).toContain(`href="${link.path}"`);
        }
      }
    });
  }

  test("all public pages identify the same organization and site with one canonical page node", () => {
    for (const path of Object.keys(SEO_PAGES)) {
      const graph = pageStructuredData(path)["@graph"];
      expect(new Set(graph.map((node) => node["@id"])).size).toBe(graph.length);
      expect(
        graph.find((node) => node["@type"] === "Organization")["@id"],
      ).toBe(ENTITY_IDS.organization);
      const page = graph.find((node) =>
        ["WebPage", "AboutPage"].includes(node["@type"]),
      );
      expect(page.url).toBe(new URL(path, SITE_URL).toString());
      expect(page.isPartOf["@id"]).toBe(ENTITY_IDS.website);
      if (path !== "/") {
        expect(
          graph.find((node) => node["@id"] === page.breadcrumb["@id"])["@type"],
        ).toBe("BreadcrumbList");
      }
      expect(graph.some((node) => node.aggregateRating || node.review)).toBe(
        false,
      );
      expect(seoMetadata(path).robots.googleBot["max-snippet"]).toBe(-1);
    }
  });

  test("public FAQs do not claim guaranteed protection or partner approval", () => {
    for (const path of [...Object.keys(ANSWER_PAGES), "/pricing"]) {
      const text = pageQuestions(path)
        .map((faq) => faq.answer)
        .join(" ");
      expect(text).not.toMatch(
        /100% protected|partner-approved|guaranteed reach/i,
      );
    }
  });
});

describe("public AI discovery without private data", () => {
  test("llms.txt responds with canonical public links and no copied prices or private routes", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await response.text();
    expect(body).toBe(llmsText());
    expect(body.startsWith("# Draftva\n")).toBe(true);
    const paths = [
      ...body.matchAll(/\]\((https:\/\/draftva\.com[^)]*)\)/g),
    ].map((match) => new URL(match[1]).pathname);
    expect(paths.sort()).toEqual(Object.keys(SEO_PAGES).sort());
    expect(body).not.toMatch(
      /localhost|api\.draftva|\$\d|\/dashboard|\/login|\/api\/|\/settings|\/invitations|access_token/i,
    );
  });

  test("AI search inherits all private exclusions instead of an overriding allow-only bot group", () => {
    const rule = robots().rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    for (const path of [
      "/api",
      "/dashboard",
      "/settings",
      "/login",
      "/invitations",
    ])
      expect(rule.disallow).toContain(path);
  });

  test("only canonical marketing responses advertise the public guide", () => {
    const publicResponse = proxy(
      new NextRequest("https://draftva.com/product/ai-writer"),
    );
    expect(publicResponse.headers.get("Link")).toBe(
      '<https://draftva.com/llms.txt>; rel="describedby"; type="text/plain"',
    );
    expect(publicResponse.headers.get("X-Robots-Tag")).toBeNull();
    for (const path of [
      "/dashboard",
      "/login",
      "/api/trpc/test",
      "/missing-page",
    ]) {
      const response = proxy(new NextRequest(`${SITE_URL}${path}`));
      expect(response.headers.get("Link")).toBeNull();
      if (path !== "/missing-page")
        expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    }
  });
});
