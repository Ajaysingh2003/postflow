# Draftva SEO implementation

Production origin: **https://draftva.com**. This task changes SEO, rendering boundaries and asset delivery. It does not change subscriptions, prices, checkout rules, authentication requirements or API publishing logic. Existing marketing copy/design are retained, apart from correcting the footer brand, removing stray citation tokens, and using the requested image placeholders. No new marketing pages were created.

## Deliverables

- [Before / after summary](before-after.md)
- [All 40 original page routes](audit-before.md), with title, description, H1, canonical, indexability and issues
- [All 40 final page routes](audit-after.md), including four legal redirects and private screens
- [Rendered verification](verification.json), [image delivery measurement](image-optimization.json), [bundle inventory](bundles.json)
- [Complete image replacement checklist](images.md)

The baseline capture ran before application edits. The final audit runs against a separate local production build. JSON captures keep headings, links, image attributes, metadata and JSON-LD for review. They contain no signed-in workspace data. Missing canonicals/H1s and duplicate titles on **noindex private screens** remain visible in the raw audit; the marketing verification deliberately does not treat those as public search defects.

## Phases completed

1. **Audit:** discovered 40 page routes, four legal duplicates, missing canonicals/OG/Twitter, pricing's missing H1, heading skips, invalid fragments, unavailable footer destinations and a missing testimonial image. Five product pages failed SSR because a public CTA suspended on authenticated-only `user.me`.
2. **Metadata:** `src/lib/seo/config.ts` owns unique page titles/descriptions, search intent, absolute canonicals, OG/Twitter cards and private-path rules. All 15 canonical marketing pages are indexable. Marketing views keep their existing H1 wording and styles; pricing's existing heading is now H1, with an accessible H2 for its plan group. Legal/product heading levels are sequential.
3. **Images:** descriptive screenshot paths, intrinsic dimensions/reserved aspect ratios, lazy defaults, hero priority loading, AVIF/WebP delivery, actual local sharing-image placeholders and a branded favicon. Existing screenshots were moved without changing their artwork; their former public image URLs permanently redirect to the descriptive filenames. Unsupported testimonial attribution is not implied by the neutral portrait placeholder.
4. **Structured data:** Organization, WebSite and SoftwareApplication on home; real monthly SoftwareApplication offers on home/pricing from the **same prefetched catalog used by the cards**, with no extra provider request. No hardcoded price or fabricated rating. Pricing FAQ schema shares its source with the accessible accordion. The absolute safety claim remains visible pending owner review but is excluded from schema. All non-root marketing pages have BreadcrumbList and an accessible breadcrumb nav, kept visually hidden to preserve the design. There are no blog-post routes, so no Article data is fabricated.
5. **Crawling:** route-discovered sitemap, source-history `lastmod`, robots exclusions, private HTTP noindex headers, a real 404 with useful links, and single-hop canonicalization of host/HTTPS/slashes/legal aliases. Product folders are static: `/product/schedule`, `/product/ai-writer`, etc. Arbitrary two-part paths no longer return a scheduler page.
6. **Performance:** marketing view composition uses server components, with SSR-preserving split client islands. Homepage hero rendering no longer waits for the billing catalog; prices still preload on the server inside their own streaming boundary. Critical hero text is visible before animation hydration. The footer has no motion dependency. Fonts remain self-hosted by Next's font pipeline, with explicit `swap` and no preload for secondary/hint fonts. Reduced-motion demos avoid cascading state effects. No active marketing analytics/chat scripts were found to defer.
7. **Links:** descriptive feature links point to their existing product pages; public CTAs and legal contents use anchors. Footer/solution fragments are root-relative and resolve. FAQs point to the actual pricing accordion, support uses the existing support address, and legal tabs/breadcrumbs expose the policy pages. Unbuilt Blog/Changelog and unknown social profiles retain their labels but do not pretend to be working destinations. No blog/contact pages were created.

## Search-intent / keyword map

These are page topics, not claimed search volumes or ranking forecasts. There is no keyword meta tag or hidden keyword copy. Prioritize/refine queries using actual Search Console data after launch.

| Existing canonical route | Primary topic | Supporting terms / intent |
|---|---|---|
| / | AI social post writer and scheduler | X post writer; LinkedIn scheduling; Threads posts; personal and company brand |
| /product/ai-writer | AI post writer | social writing assistant; brand voice; rewriting; social post drafts |
| /product/schedule | social media post scheduler | publishing queue; X scheduling; LinkedIn scheduling; Threads scheduling |
| /product/analytics | social media post analytics | post performance; social engagement; connected account metrics |
| /product/social-integration | social media account integrations | connect social accounts; multi-channel publishing; X, LinkedIn and Threads |
| /product/mcp | MCP social media scheduling | Draftva MCP server; AI assistant integration; draft and schedule with AI tools |
| /pricing | social media scheduling pricing | Draftva plans; Free, Starter, Pro and Business; AI writing plans |
| /about | about Draftva | founder; product story; social writing platform |
| /legal | Draftva legal policies | service policies; data processing documents |
| /terms | Draftva terms of service | account terms; subscription terms; content ownership |
| /privacy | Draftva privacy policy | personal data; connected accounts; privacy requests |
| /cookies | Draftva cookie policy | essential cookies; local storage; preferences |
| /acceptable-use | Draftva acceptable use policy | responsible publishing; spam restrictions |
| /dpa | Draftva data processing addendum | processing responsibilities; data safeguards |
| /subprocessors | Draftva sub-processors | service providers; data processing roles |

The existing `social-integration` spelling is preserved to avoid a gratuitous URL change. If it is renamed later, add one permanent redirect and update metadata and links together.

## Route and indexing policy

Canonical marketing pages are the keys in `SEO_PAGES`; the build script discovers their actual `page.tsx` files and checks that metadata paths match. Legal aliases redirect: `/terms-of-service → /terms`, `/privacy-policy → /privacy`, `/cookie-policy → /cookies`, `/sub-processors → /subprocessors`. Alias pages are excluded from the sitemap.

`/dashboard/**`, `/settings/**`, `/app/**`, `/auth/**`, `/api/**`, login/register/recovery/verification pages, onboarding and invitations are excluded from the sitemap and disallowed in robots. Actual private pages also have noindex metadata and `X-Robots-Tag`. Authentication still controls access; robots rules are not security controls. If a private URL is already indexed, use Search Console removals and temporarily allow it to be crawled to see its noindex response before reapplying the disallow rule.

Existing API route templates (not HTML landing pages): `/api/agents/skill`, `/api/ai/runs`, `/api/auth/x/start`, `/api/auth/x/callback`, `/api/media/[...path]`, `/api/reports/[scanId]/export`, `/api/trpc/[trpc]`. The prefix policy covers all seven without calling action endpoints in the audit.

`src/proxy.ts` combines `www → non-www`, HTTPS, trailing slash removal and alias replacement in a 308, preserving query strings and request method. Production hosts are explicit; localhost/preview hosts are not forced onto the production origin. Forwarded protocol must be set correctly by the hosting proxy. Domain/DNS/TLS configuration still belongs to the host.

`seo:manifest` runs before dev/build, using route files and their local source dependencies. Committed history provides the last significant source change; dirty/archive sources use actual source mtimes. Dates are generated at build time, not refreshed on each request. Run it through the supplied package scripts rather than invoking `next build` directly. No invented publish dates or blog entries are included.

## Performance evidence and further safe reductions

- Isolated slow-billing smoke test: homepage H1 HTML streamed in about **0.1 seconds locally**, before a mock endpoint delayed for four seconds. This is a rendering regression check, not an LCP score. See [the captured result](streaming.json).
- Production image smoke test: home screenshot **1,200,639 bytes PNG → 35,496 bytes AVIF** at width 1920, quality 75. This is one measured request, not a claim for every asset/device.
- The bundle inventory lists the five largest client chunks referenced by each marketing route, including async/shared chunks. Its total is **not** a measured first-load download or a CWV score.
- The largest home/pricing chunk is about **391 KB raw / 92 KB gzip** and contains Zod validation/localization code, including checkout validation. A follow-up can defer the checkout module until billing intent or split its validation boundary while retaining client and server checks. That changes loading behavior around payment interactions, so this SEO pass keeps the validated checkout flow intact.
- Keep the current interactive previews as client islands; replacing animations or removing the shared query/auth providers would require a wider UI review. No dependencies used by the app were removed just to improve a score.
- Run mobile PageSpeed/Lighthouse on the deployed domain, then monitor field LCP/INP/CLS in Search Console. No synthetic score or field-performance result is asserted here.

## Verification

From `fronted/`:

```sh
bun run build
bun run start --port 3002
# In another terminal:
python3 scripts/audit-seo.py --base http://localhost:3002 --output docs/seo/audit-after
python3 scripts/verify-seo.py --base http://localhost:3002
bun scripts/report-seo-bundles.mjs
python3 scripts/test-seo-streaming.py
bun test tests/seo.test.js tests/checkout.test.js tests/upgrade-subscription.test.jsx
bunx tsc --noEmit
```

The verification checks all canonical pages, unique metadata, social tags, one H1, heading levels, JSON-LD parsing, internal links/fragments, intrinsic image attributes/files, reachability from home, real 404 statuses, direct legal/slash redirects and private noindex headers. Unit tests check hostile JSON-LD escaping, catalog-derived prices, robots/sitemap membership, production/preview redirect behavior and real 1200×630 PNG files.

Production build and TypeScript pass. The targeted SEO/checkout tests pass. The full frontend suite has **219 passing tests and one existing pricing-label failure**: the user-edited `PricingPlan.tsx` now supplies default “Save 10%”/“Save 20%” badges while its existing test rejects generic discount promises. That file was already modified when this task began and was not edited here. Review those badges against current Dodo prices and update the component/test together in a billing change. Backend code and databases are untouched.

## Owner checklist before / after deployment

- Verify the `draftva.com` **Domain property** in Google Search Console using the DNS TXT record; submit `https://draftva.com/sitemap.xml` after deployment.
- Configure both `draftva.com` and `www.draftva.com` with valid TLS at the frontend host. Confirm the production deployment has no global noindex header, while previews remain protected/noindex. Inspect the home, pricing and one product URL in Search Console.
- Replace labelled OG/portrait placeholders using [the image checklist](images.md), with approved artwork and real, consented testimonials. Use sanitized sample workspaces in replacement screenshots. Update image paths if versioning files for cache invalidation.
- **TODO — verify existing content facts:** creator counts/ratings/endorsements in `CompanyProof`, `ReviewSections` and `Intigration`; unrelated Rowley/video-protection copy in `FeatureCardNormal`/`FeatureCardTitlt`; account-safety, platform-partner and SOC-2 claims in pricing; AI feature/analytics promises against the actual supported integrations. These were not rewritten because this task preserves copy meaning, and none are converted into ratings/endorsement schema.
- **TODO — review legal accuracy:** privacy/cookie/sub-processor text still names Stripe while the implemented billing flow uses Dodo. Confirm actual vendors, contact inboxes, compliance statements and legal dates with the owner. Metadata does not assert certification/compliance.
- Supply verified brand social URLs and approve any future Blog/Changelog content before enabling those links. There is no blog-post route today, so Article author/date/image facts are intentionally absent.
- Run Schema.org Validator for JSON-LD syntax/types and Google's Rich Results Test for currently supported features after deployment. Valid schema does not guarantee a rich result; no fake review is added to satisfy eligibility. Google discontinued FAQ rich results in 2026; FAQPage is retained as requested without a search-result promise. See [Google's documentation update](https://developers.google.com/search/updates#june-2026), [software application guidance](https://developers.google.com/search/docs/appearance/structured-data/software-app) and [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

No Search Console submission, DNS changes, paid checkout or production deployment was performed by this task.

## Answer and generative search follow-up

See [the AEO/GEO implementation and maintenance guide](answer-engines.md) for public answer coverage, entity IDs, optional llms.txt discovery, verification and remaining owner tasks.
