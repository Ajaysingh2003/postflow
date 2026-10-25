import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollReveal } from "../src/modules/home/component/ScrollReveal";

test("scroll reveals preserve readable server content and crawlable links before hydration", () => {
  const html = renderToStaticMarkup(
    <ScrollReveal delay={0.1}>
      <h2>Write in your own voice</h2>
      <a href="/product/ai-writer">Explore the AI writer</a>
      {/* Native image intentionally checks raw server HTML dimensions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/og/home.png"
        alt="Draftva social writing workspace"
        width={1200}
        height={630}
      />
    </ScrollReveal>,
  );
  expect(html).toContain("<h2>Write in your own voice</h2>");
  expect(html).toContain('href="/product/ai-writer"');
  expect(html).toContain('width="1200" height="630"');
  expect(html).not.toMatch(
    /opacity:\s*0|visibility:\s*hidden|aria-hidden="true"|translate3d/,
  );
});

test("a reveal preserves layout classes and document headings", () => {
  const html = renderToStaticMarkup(
    <ScrollReveal className="lg:col-span-2" distance={32}>
      <section id="pricing">
        <h2>Pricing</h2>
        <button>Get started</button>
      </section>
    </ScrollReveal>,
  );
  expect(html).toContain('class="min-w-0 lg:col-span-2"');
  expect(html).toContain('id="pricing"');
  expect(html.match(/<h2>/g)).toHaveLength(1);
  expect(html).toContain("<button>Get started</button>");
});
