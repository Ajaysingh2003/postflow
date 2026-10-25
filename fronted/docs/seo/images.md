# Image replacement checklist

Public paths below resolve to real files. Social cards and the generic portrait are clearly labelled placeholders; existing screenshots, logo and founder illustration retain their original artwork under descriptive names. Replace files at these paths to keep metadata and components aligned. No optional photo/testimonial sections have been added.

| File path | Page / placement | Recommended dimensions | What the image should show |
|---|---|---|---|
| /images/og/about.png | /about social sharing | 1200 × 630 | Approved Draftva branding and about page context; replace the labelled placeholder. |
| /images/og/acceptable-use.png | /acceptable-use social sharing | 1200 × 630 | Approved Draftva branding and acceptable use page context; replace the labelled placeholder. |
| /images/og/ai-writer.png | /product/ai-writer social sharing | 1200 × 630 | Approved Draftva branding and ai writer page context; replace the labelled placeholder. |
| /images/og/analytics.png | /product/analytics social sharing | 1200 × 630 | Approved Draftva branding and analytics page context; replace the labelled placeholder. |
| /images/og/cookies.png | /cookies social sharing | 1200 × 630 | Approved Draftva branding and cookies page context; replace the labelled placeholder. |
| /images/og/dpa.png | /dpa social sharing | 1200 × 630 | Approved Draftva branding and dpa page context; replace the labelled placeholder. |
| /images/og/home.png | / social sharing | 1200 × 630 | Approved Draftva branding and AI social writing and scheduling page context; replace the labelled placeholder. |
| /images/og/integrations.png | /product/social-integration social sharing | 1200 × 630 | Approved Draftva branding and integrations page context; replace the labelled placeholder. |
| /images/og/legal.png | /legal social sharing | 1200 × 630 | Approved Draftva branding and legal page context; replace the labelled placeholder. |
| /images/og/mcp.png | /product/mcp social sharing | 1200 × 630 | Approved Draftva branding and mcp page context; replace the labelled placeholder. |
| /images/og/pricing.png | /pricing social sharing | 1200 × 630 | Approved Draftva branding and pricing page context; replace the labelled placeholder. |
| /images/og/privacy.png | /privacy social sharing | 1200 × 630 | Approved Draftva branding and privacy page context; replace the labelled placeholder. |
| /images/og/schedule.png | /product/schedule social sharing | 1200 × 630 | Approved Draftva branding and schedule page context; replace the labelled placeholder. |
| /images/og/subprocessors.png | /subprocessors social sharing | 1200 × 630 | Approved Draftva branding and subprocessors page context; replace the labelled placeholder. |
| /images/og/terms.png | /terms social sharing | 1200 × 630 | Approved Draftva branding and terms page context; replace the labelled placeholder. |
| /images/placeholders/home-testimonial-portrait.png | Shared creator/testimonial components on marketing pages | 160 × 160 | A consented, verified portrait; split into distinct paths when real testimonials are approved. The current neutral silhouette makes no identity claim. |
| /images/brand/draftva-logo.jpg | Shared navbar and Organization schema | 512 × 512 | Approved Draftva square logo (existing artwork retained). |
| /images/brand/draftva-icon.png | Browser icon | 64 × 64 | Recognizable Draftva mark at small sizes. |
| /images/brand/draftva-apple-icon.png | Apple touch icon | 180 × 180 | Draftva mark with suitable padding. |
| /images/about/about-founder-ajay-singh.png | /about founder card | 1024 × 1024 | Approved portrait or illustration of Ajay Singh; existing illustration retained. |
| /images/product/home-dashboard-preview.png | Home hero and Dashboard preview tab | 2560 × 1600 | Sanitized Draftva home dashboard with realistic sample content. |
| /images/product/channels-dashboard-preview.png | Channels preview tab; integrations hero | 2560 × 1600 | The connected social accounts screen with sample accounts. |
| /images/product/content-dashboard-preview.png | Content preview tab; AI writer hero | 2560 × 1600 | The editor, writing assistant and sample draft. |
| /images/product/schedule-dashboard-preview.png | Schedule preview tab; scheduler hero | 2560 × 1600 | A populated publishing schedule using sample posts. |
| /images/product/analytics-dashboard-preview.png | Analytics preview tab; analytics hero | 2560 × 1600 | Account analytics with representative sample posts and clearly illustrative numbers. |
| /images/product/social-scheduler-banner.png | Shared closing CTA; decorative | 2560 × 800 | Existing decorative Draftva banner composition; keep its reserved aspect ratio when replacing. |
| /favicon.ico (source: src/app/favicon.ico) | Browser favicon | 64 × 64 | Same approved mark as the PNG icon; regenerate the ICO when replacing the logo. |

Shared platform marks in `/channels/` and decorative `/point-out.svg` are retained, with intrinsic dimensions. They are existing assets, not fabricated partner endorsements. Only the active hero preview and above-fold founder image use priority loading; other editorial images use Next Image's lazy default. `sizes` and aspect-ratio containers preserve geometry.

After replacing files, check alt text in the consuming component. Decorative assets should keep empty alt. Run `bun run seo:images` only to rebuild the placeholder template/icons; it overwrites approved OG/portrait replacements. Prefer versioned filenames and update `seoMetadata`/components when refreshing cached production artwork.
