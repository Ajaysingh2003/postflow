# Answer and generative search readiness

This pass improves how Draftva's existing public pages explain the product to people, search engines and AI readers. It does not guarantee indexing, AI citations, rankings, traffic or a particular rich-result format. No new marketing pages, private data exports, keyword stuffing, reviews, endorsements or static price claims were added.

## Before / after

| Area | Before | After |
|---|---|---|
| Product definition | Mostly slogan-style introductions | Clear product/category descriptions in the existing intro paragraphs |
| Public answers | Pricing FAQ only | 21 additional questions across Home, About and five product pages; six pricing answers retained and clarified |
| Accessibility / extraction | Interactive feature demos carry much of the explanation | Plain-text answers in server HTML; new native disclosure sections work without JavaScript |
| Entity identity | Organization/site mostly on Home; breadcrumbs elsewhere | Consistent Organization, WebSite and canonical WebPage/AboutPage IDs on all 15 public canonical routes; relevant pages link to the same SoftwareApplication |
| Visible/schema consistency | Pricing alone shares FAQ data | All answer sections and FAQPage markup share the exact question/answer strings and working fragment IDs |
| Homepage availability | Core schema waited inside the billing boundary | Core page/entity/answer graph renders before billing; real catalog offers are added separately with the same software ID |
| AI discovery | Standard sitemap / robots | Optional `/llms.txt` generated from the public content registry, discoverable through a Link response header on canonical public pages |
| Crawler access | Public allow + private disallow | Same access and training policy; tests ensure search bots inherit private exclusions |
| Claims | Pricing FAQ claimed absolute ban protection and compared competitors without evidence | Qualified explanations of official APIs, permissions, platform limits and publishing safeguards |

## Where to maintain content

- `src/lib/seo/answers.ts`: the public product summaries, question IDs, answers and related links. Summaries also power the existing hero descriptions. Keep these concise and factually supported. Do not add plan prices/quotas here.
- `src/modules/home/component/AnswerSection.tsx`: the shared server-rendered section, styled with existing fonts, cards, spacing and green accent. Native details/summary expose all text without waiting for hydration; each question has a stable fragment.
- `src/modules/billing/pricing-faqs.ts`: the existing pricing FAQ. Actual prices and limits remain in the existing billing catalog and plan cards.
- `src/lib/seo/structured-data.ts`: canonical entity graph, FAQ schema and live catalog offers. HTML and JSON-LD use the same answers. Legal pages get entity/breadcrumb context, without artificial legal FAQs.
- `src/lib/seo/llms.ts` and `src/app/llms.txt/route.ts`: a small, static plain-text guide linking only to the 15 canonical public pages. It contains no user, workspace, API, authentication or billing-session data and does not call the backend.
- `src/proxy.ts`: public-only `Link: <https://draftva.com/llms.txt>; rel="describedby"; type="text/plain"`. Private/unknown paths do not advertise the guide.
- `src/lib/seo/config.ts`: normal page metadata and explicit unlimited Google snippet/video previews on marketing pages; private pages retain their noindex/nosnippet settings.

Prices are not duplicated into llms.txt or product answers. Software offers still use the current monthly catalog values only when supplied by the existing server prefetch. No fake reviews or ratings were added to obtain rich results. The shared ID joins the homepage's early software definition with its later catalog-backed offers.

## Search intent / answer coverage

These are query topics, not researched search volumes or guaranteed rankings. Use real query data after launch.

| Page | Questions addressed |
|---|---|
| `/` | What is Draftva? How does writing/scheduling work? Is there a Free plan? |
| `/product/ai-writer` | What does the assistant do? Can it use my brand voice? What happens when credits run out? |
| `/product/schedule` | Can channels have different versions/times? What does unlimited posting mean? What if an account disconnects? |
| `/product/analytics` | Where do metrics come from? Why are metrics unavailable? Can externally published posts appear? |
| `/product/social-integration` | How do I connect? Are passwords needed? Are capabilities or reach guaranteed? |
| `/product/mcp` | What is MCP? How do I connect? What permissions does an assistant have? |
| `/about` | Who built Draftva? Who is it for? What is its approach to AI writing? |
| `/pricing` | Free plan, paid posting limits, credits, billing changes, account safety and collaboration |

## Crawler and snippet policy

The existing `User-agent: *` group allows public content and disallows private app/auth/API paths. This already covers AI search bots including OAI-SearchBot, Claude-SearchBot and PerplexityBot. Separate allow-only groups can override the wildcard exclusions, so this pass does not add them. No training-crawler opt-in or opt-out was introduced. Robots rules are not authentication or authorization.

Google says no special AI markup or AI text file is required for AI Overviews/AI Mode. Its normal indexing/snippet requirements, crawlability, visible textual explanations and structured-data consistency apply. `llms.txt` is an optional discovery proposal, not an indexing submission, access-control mechanism or ranking signal. FAQPage describes the questions actually on the page; it does not promise FAQ rich results or AI inclusion.

Official references reviewed for this pass:

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI: crawler purposes and independent controls](https://developers.openai.com/api/docs/bots)
- [Anthropic: crawler controls](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- [Perplexity: bots](https://docs.perplexity.ai/guides/bots)
- [llms.txt proposal](https://llmstxt.org/)

## Verification

From `fronted/`:

```sh
bun test tests/answer-engine.test.jsx tests/seo.test.js
bunx tsc --noEmit
bun run build
# If this environment blocks Turbopack's internal compiler port:
# bun run build --webpack
bun run start --port 3002
# Against that production build, without signing in or running JavaScript:
python3 scripts/verify-answer-engine.py --base http://localhost:3002
```

The raw-HTML verification checks every canonical route, question/answer text outside scripts, matching question fragments, entity IDs, one H1, public discovery headers, guide links and private robots exclusions. Unit coverage also checks the real rendered FAQ components against schema, catalog pricing behavior, no unsupported ratings and private response headers. `tests/seo.test.js` still checks real 1200×630 OG assets; owner-replaced artwork can fail that existing check and should not be overwritten automatically.

## Recorded validation

- The production build passes using `bun run build --webpack`. This environment blocked Turbopack's internal compiler-port binding with `Operation not permitted`, including on a retry; this was an environment limitation. The supported Webpack build completed with an existing `useTRPC` export warning from `PricingCardSection.tsx` (the billing component was not changed).
- TypeScript and ESLint on changed application/test files pass.
- The full frontend suite reports **233 passing / 2 failing**. Both existing failures remain: the pricing selector's generic discount-label check and an owner-replaced OG image that is 1161 pixels wide instead of 1200. No artwork or billing discounts were changed by this task.
- Production raw-HTML verification: **15 canonical pages, 8 answer pages, 27 questions, zero audit errors**. See `answer-engine-verification.json`.
- Slow-billing regression: homepage hero, Organization, WebPage and FAQ schema arrived before a mock four-second billing response. The measured local hero HTML time was **0.074 seconds**, a regression check rather than a Core Web Vitals result. See `streaming.json`.
- The new native disclosure was opened in the browser, including the brand-voice answer, and the new section was visually reviewed at a narrow viewport.
- No production deployment, Search Console submission, DNS/WAF changes, payment, publishing or private-data access was performed.

## After deployment

1. Verify the Domain property in Google Search Console and the site in Bing Webmaster Tools. Submit `https://draftva.com/sitemap.xml`, inspect Home/Pricing/a product URL, and confirm the deployed URLs return public 200 responses.
2. Confirm CDN/WAF rules do not challenge legitimate search crawlers. Use the official IP-verification guidance for any allow-list changes; never trust a User-Agent string alone. This task does not alter infrastructure security rules.
3. Supply verified public Draftva company/social profile URLs before filling the `sameAs` TODO. Keep the product description consistent on those profiles; don't create fake mentions, reviews or citations.
4. Resolve the existing factual-content TODOs in `docs/seo/README.md`: unrelated Rowley/video-protection cards, unverifiable creator counts/testimonials, guarantees/certification claims elsewhere in pricing, and legal vendor accuracy. This pass corrects the pricing FAQ and avoids amplifying those other claims in new answers or schema; it is not a full marketing/legal copy rewrite.
5. Check structured data with Schema.org Validator and any applicable Google Rich Results Test. Replace the remaining image placeholders with approved assets using `docs/seo/images.md`.
6. Track organic queries/clicks/conversions and AI referrals using your existing analytics tools. Record a small, fixed set of product questions monthly and note whether citations point to the right pages. AI answers vary, may lag changes and may omit referrers; a single test is not a visibility score. This pass adds no third-party analytics scripts or background monitoring.
7. Keep answers current as integrations, plans and permissions change. Publish real tutorials/case studies later only when evidence and user consent exist; no such pages were created here.
