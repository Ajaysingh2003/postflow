# Live analytics

**Current update:** Analytics now uses bounded, short-lived shared Redis datasets; SQL metric snapshots remain unused. Manual refreshes have a cooldown and daily read budgets. This supersedes the earlier no-cache behavior below. See [cost controls](team-invitations-and-cost-controls.md).

## All-channel account feeds (2026-10-08)

The account-feed contract is covered for X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook, Instagram and Threads: native posts without a draftva record remain visible and included in full-selection totals. Local records only add studio links, and the Posts library remains local-only. Adapter tests exercise official pagination independently of this shared dashboard contract.

Bluesky now requests `posts_no_replies` and checks the record's reply reference. Mastodon requests `exclude_replies` and also checks `in_reply_to_id`, because the server filter can retain self-replies. Both continue paging through pages containing only excluded replies/reposts. Facebook now requests and preserves `permalink_url`; Mastodon preserves the status `url`. Instagram and Threads retain their `permalink` fields. These links let users open posts created outside draftva.

Official references checked for this correction: [Bluesky author-feed lexicon](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/getAuthorFeed.json), [Mastodon account-status filters](https://docs.joinmastodon.org/methods/accounts/#statuses), [Mastodon status fields](https://docs.joinmastodon.org/entities/Status/), [Meta's generated Post schema](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/post.py), and [Meta's Threads account-feed collection](https://www.postman.com/meta/threads/request/ozyoo16/get-a-list-of-all-a-user-s-threads). The Facebook documentation endpoint returned HTTP 429, so its official generated SDK schema was used to confirm the permalink field.

LinkedIn company Page feeds are supported. Personal-profile feeds remain explicitly unavailable for ordinary connections: the [official Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) requires the restricted `r_member_social` permission to retrieve member posts. Provider permissions and history limits are still reported rather than replaced with a complete-looking draftva-only dataset.

Verification: 359 backend tests passed (one Redis-dependent test skipped), Ruff passed, and all 105 frontend tests passed. After restarting the local API, the connected Threads account returned three posts and 272 views with provider permalinks and no browser console errors. Only X and Threads are connected in this local workspace; the remaining channels were verified with mocked official HTTP responses. Screenshot: `/private/tmp/draftva-all-channel-analytics.png`.

## Account feed scope (2026-10-08)

The Analytics view requests the selected account's official post feed, including posts published in the platform's own app or through other tools. The selected publish-date range and the provider's permissions/history limits still apply. Original posts are shown in the table; X reply impressions remain separate in the inclusive total. A missing draftva `post_id` never excludes an API post from the table or totals.

draftva records provide optional links to the studio only. After fetching the account feed, the backend looks up matching identifiers in batches of 500; it does not load the entire saved publication history for an account. No lookup is needed for an empty account feed. API posts are deduplicated and date-filtered before aggregation and display pagination. They are not imported into the database.

Provider-supplied HTTPS permalinks are used for native posts. The studio link includes both the saved post and variant identifier when a match exists. The separate Posts page continues to list only draftva's published posts, schedules and drafts through `/posts/library`, without social timeline requests. Tests exercise a mixed feed of saved and native posts, matching IDs on another account, duplicates, date exclusions, full totals across pages, and the absence of database imports.

Analytics reads the official platform APIs on each request. It does not read or write `metrics_snapshots`, update cached account metric totals, or fall back to previous results on an API error. The scheduler no longer collects metrics. The existing snapshot table is left untouched as legacy data; no production records were deleted and no database migration is required.

OAuth callbacks also stop saving X public counters, Instagram follower counts and Reddit karma in connected-account metadata. Account identity, display information and encrypted credentials remain stored for connecting and publishing.

The dashboard uses one `GET /api/v1/analytics/dashboard` response for the selected account, date range, cards and paginated post table. Its response includes `account_id`, `fetched_at`, per-metric availability, and dataset completeness. Responses use `Cache-Control: no-store`. Switching accounts or returning to an account triggers a new request; in-flight, failed and mismatched results are hidden. Refresh and window focus request new data. There is no automatic polling interval.

All eight adapters can read their official account post feed, including posts published outside draftva. X reads its user timeline and enriches recent owned posts in batches with private metrics when permitted. LinkedIn reads company Page posts and organization metrics. Personal LinkedIn profiles show an unavailable message. Reddit reads the authenticated user's submissions; Bluesky reads the author's feed with OAuth/DPoP; Mastodon reads the account's statuses on its own instance; Facebook reads Page published posts; Instagram reads account media; Threads reads the user's threads. Database post rows are used only to link API posts back to their existing draftva drafts. External posts are not imported or persisted.

X's posts dataset requests `exclude=retweets,replies` and also filters reply/repost relationships before enriching metrics. Original posts and quote posts remain included; a plain mention does not make a post a reply. Replies to other users and self-replies (including thread continuations) are excluded. Dashboard totals, published-post counts, display pages and page exports therefore use the same posts-only dataset. Reply counts on an original post still represent responses received by that post.

Overview totals cover the provider dataset for posts published within the chosen date range. They are calculated before display pagination, never from just the visible page. Engagement counts are the latest lifetime counters for those posts, rather than engagement events occurring in the selected period. Follower counts are current totals. Missing fields display a dash, true returned zeroes remain zero, and an unavailable integration shows an explanatory message. Incomplete datasets have an explicit notice and are not presented as complete totals. Reach is never inferred from impressions.

API access, permissions and provider limits still apply. Adding an X payment method does not grant every metric: private and organic metrics require owner authorization and have a recent-post window. X and Reddit account feeds expose bounded recent history. API failures, credit requirements and rate limits are displayed without serving stored data. Large datasets may time out rather than silently return an old dashboard. Historic follower growth charts are not synthesized from removed snapshots.

Official references used for implementation:

- [X user posts and exclusion filters](https://docs.x.com/x-api/users/get-posts)
- [X post lookup](https://docs.x.com/x-api/posts/lookup/introduction)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn organization share statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics)
- [LinkedIn Page statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/page-statistics)
- [Mastodon account statuses](https://docs.joinmastodon.org/methods/accounts/#statuses)
- [Reddit API](https://www.reddit.com/dev/api/)

Meta's official references were verified in the browser on October 7, 2026 (the research tool returned HTTP 429). Insights use the separate `GRAPH_INSIGHTS_API_VERSION` setting, defaulting to `v26.0`. Account/post discovery and publishing continue to use `GRAPH_API_VERSION`. The shared `meta_insights.py` reader parses both `values[].value` and `total_value.value`, preserves genuine zeroes, and treats empty/missing/breakdown-only values as unavailable. An invalid metric error triggers individual metric requests; permission, auth and rate-limit errors stop further requests. Public post/profile counts survive an insights failure, with an explanatory notice. No metrics are stored.

Facebook requests `post_media_view`, `post_total_media_view_unique` and `post_clicks` for posts; account insights request `page_media_view`, `page_total_media_view_unique`, `page_post_engagements` and `page_views_total`. Public Page requests use `followers_count` rather than treating Page likes (`fan_count`) as followers. Account metrics and the post dataset select the same primary Page and encrypted Page token. Facebook's replacement unique media viewer count is exposed as `reach` with its definition in `extras`. Views are a separate `views` / `total_views` field throughout the analytics API; they are never assigned to impressions.

Instagram requests `views`, `reach`, `saved`, `shares`, `likes`, `comments` and `total_interactions`, plus watch-time insights for Reels. Facebook Login connections additionally request boosted/ad-inclusive `total_views`, `total_likes` and `total_comments`, retained separately in `extras.insights`. Instagram Login connections read `graph.instagram.com`; older Facebook Login connections read `graph.facebook.com`, including media discovery, with the appropriate insights permission notice for each flow. Account requests use `metric_type=total_value`, explicitly bounded to the previous UTC day; the bounds are returned in extras. Facebook account insights are also bounded to one day to avoid summing overlapping unique-user counts. Dashboard totals remain the latest lifetime counts for posts published in the selected range.

Important limits: Meta may suppress insights on small accounts, delayed metrics or unsupported content types. Instagram Login insights exclude engagement from boosted/ad media on other surfaces; Meta exposes ad-inclusive totals through Facebook Login only. Facebook requires `read_insights`, `pages_read_engagement` and the Page's ANALYZE task. Instagram Login requires `instagram_business_manage_insights`; Facebook Login requires `instagram_manage_insights` and `pages_read_engagement`. Serving professional Instagram accounts outside the app's own test/managed accounts requires Advanced Access. These restrictions cannot be repaired by replacing missing values with zeroes.

Backend-only scope: no frontend files were edited for the Meta correction. The existing frontend still labels its exposure card/column **Impressions**. It must use the new **Views** fields for Facebook/Instagram in the later frontend work; until then those impression cells correctly remain unavailable. The backend is ready to return views, reach, interactions, saves and shares independently.

Official Meta references:

- [Page and post insights, replacement view metrics, permissions and limits](https://developers.facebook.com/docs/graph-api/reference/insights/)
- [Instagram insights, API hosts, permissions, missing-data behavior and ad-inclusive limits](https://developers.facebook.com/documentation/instagram-platform/insights)
- [Meta SDK Instagram metrics and total-value response fields](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/instagraminsightsresult.py)
- [Meta SDK account insight request parameters](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/iguser.py)
- [Meta SDK media fields and insight request parameters](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/igmedia.py)

Meta correction files: `app/core/config.py`, `.env.example`, `app/modules/channels/base.py`, `app/modules/channels/adapters/facebook.py`, `instagram.py`, `analytics_posts.py`, new `meta_insights.py`, `app/modules/analytics/schemas.py`, `service.py`, the Facebook/Instagram adapter tests, new `tests/test_meta_insights.py`, and this report. Verification uses the backend Ruff and pytest commands below. Only X is currently connected in the signed-in local workspace, so Facebook/Instagram account-level live verification remains pending a real connected account. Automated verification covers official response formats, current requests/version, selected Page tokens, both Instagram hosts, permission/auth/rate-limit failures, timeout recovery, metric isolation, genuine zeroes, missing data and views propagation into the dashboard aggregate.

Verification:

```sh
cd backend
.venv/bin/ruff check .
.venv/bin/pytest
cd ../fronted
bun test
bun x tsc --noEmit
bun x eslint src/modules/analytics src/modules/studio/server.ts src/modules/studio/types.ts
```

New regression coverage includes stale snapshot isolation, no metric writes, external posts, full aggregation across display pages, account/date isolation, repeated account switches, late responses, genuine zeroes vs missing metrics, official pagination and OAuth/DPoP. Company LinkedIn dashboards are exercised through the HTTP endpoint with mocked official responses, using both selected-Page metadata and an organization account ID. Mastodon feed requests use the instance-local user ID rather than draftva's combined ID/domain identifier.

Before the posts-only correction, manual verification on the signed-in local page returned 95 X followers and 114 posts/replies for September 8–October 7, 2026. Page two showed posts 51–100 while preserving the full-period totals. Switching to personal LinkedIn replaced the X dashboard with the unavailable message. A later X request reached the provider's rate limit and displayed that error without restoring prior metrics. No connected company Page was available for a live LinkedIn verification. Browser verification reported no console errors after repairing the table's hydration warning.

After the posts-only correction and local API restart, the same date selection returned 51 X posts. The first page showed 50 posts and the last page showed one, with identical full-selection totals on both pages (2.4K impressions, 104 engagements, 42 likes and 5 profile clicks at verification time). The browser reported no console errors. Regression tests cover a page containing only filtered replies, quotes, standalone mentions, self-replies, private-metric enrichment IDs, aggregate totals and both the dashboard and legacy feed endpoints. The full backend suite passed 284 tests with one Redis-dependent test skipped; Ruff and diff checks passed.

## Threads insights and available metrics (2026-10-08)

Verified against the [official Threads Insights API](https://developers.facebook.com/documentation/threads/insights). The adapter now reads current `followers_count` through `GET https://graph.threads.com/v1.0/{user-id}/threads_insights`, without `since` or `until` (unsupported for this metric). It requires `threads_basic` and `threads_manage_insights`.

Post insights return views, likes, replies, reposts, and quotes. Views remain a separate field from impressions. Engagements are derived from likes + replies + reposts + quotes; the combined repost/quote count is labeled “Reposts & quotes” in the dashboard. Engagement rate uses impressions when reported, otherwise views. Empty samples are unavailable, and actual returned zero counts remain visible. Account totals do not inherit the post date filter.

The dashboard and CSV export show only columns returned for at least one visible post. Summary cards require complete selected-range coverage for each metric; known unsupported metrics do not generate a blanket warning. API failures still show notices. Followers are requested live, and no metrics are substituted from stored snapshots. Optional demographic breakdowns and separate share counts are not requested by this view.
