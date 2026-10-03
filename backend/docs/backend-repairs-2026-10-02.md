# Backend repairs and remaining launch requirements

Updated 2 October 2026. This implements the backend repairs requested after the [Phase 0 audit](audit-2026-10-02.md). It uses the existing FastAPI, synchronous SQLAlchemy 2, Alembic, Pydantic Settings and database-polling job architecture. No frontend files, private environment values or existing application databases were changed. No live social posts were sent.

## What changed

### Tenant boundaries, configuration and OAuth

- Content creation, variant editing, attachment, publishing and assistant voice/account access now verify workspace ownership and platform compatibility. Jobs repeat the checks rather than trusting saved request identifiers.
- The common validation call matches the adapter protocol. All eight registered channels have service-level regression coverage; Reddit supplies its rule context through its adapter hook.
- Callback configuration now matches `/api/v1/channels/{platform}/callback`. Unconfigured credentials fail before starting a connection. State consumption is atomic, reserved connection options cannot override server values, and callbacks recheck the initiating user's workspace administration permission.
- Added encrypted OAuth protocol metadata, dedicated encryption keys and previous-key support. Public account responses remove credentials recursively. Refresh runs in the scheduler; refresh or revocation failure retains an account as `needs_reauth`.
- Added official Bluesky OAuth discovery, PAR, PKCE, DPoP, nonce handling, hosted client metadata and public signing keys. Removed the password/app-password callback path. Added the Threads adapter, configuration, registry entry and assistant profile.
- URL importing and dynamic server requests validate every destination and redirect, reject internal/reserved IPs, pin the validated connection address and bound webpage size. Fetched webpage content is treated as untrusted source material.
- Production rejects the development application secret, implicit mock AI and fake successful billing checkout. SMTP with verified STARTTLS delivers verification, reset and invitation links.

### Content and media

- Added draft variant add/edit/delete, template CRUD, ready-asset attachment and editable alt text. Assets are scoped to the workspace and validated again before publishing; image dimensions are populated with bounded image decoding.
- Added upload paths for X images/chunked video, LinkedIn images/documents/multipart video, Bluesky image blobs and Mastodon media. Upload and processing identifiers are persisted for resume.
- Facebook uses staged Page photos or a Page video URL. Instagram creates image, video or carousel containers and waits for readiness; PNG/WebP images are converted to JPEG. Threads creates text/media/carousel containers and waits for readiness. LinkedIn and Threads serialize image alt text.
- X, Bluesky and Mastodon threads preserve completed items and continue with the correct reply references. Every thread item is validated. X uses weighted Unicode/URL counting; Bluesky uses graphemes, UTF-8 facet offsets and resolved mention DIDs.
- LinkedIn and Mastodon polls are serialized with their supported options. Mastodon validates against trusted, refreshed instance settings. Reddit requires fresh cached rules, title/body requirements and valid flair; rule refresh does not replace a good cache after upstream failures.
- Removed Reddit comment-reading, reply-posting and search API helpers/routes outside the agreed publishing scope. Explicit multi-subreddit publishing requires distinct per-variant choices/content. No auto-voting, auto-commenting, auto-following or automatic messaging was introduced.

### Publishing and jobs

- Only the worker dispatches publications; the scheduler performs maintenance. A conditional database claim prevents two workers from sending the same variant concurrently. An attempt record is committed before external publication begins.
- Provider state records partial threads, media IDs and container IDs. Media still processing is polled without consuming the ordinary five-attempt retry budget. Transient errors use backoff; authentication errors stop and require reconnection.
- An interrupted or ambiguous final publishing request is held for reconciliation rather than automatically retried. Stale `publishing` claims are recovered with an uncertain outcome. Stable record keys and native provider idempotency are used where supported; these mechanisms cannot create an exactly-once guarantee for every provider API.
- `POST /api/v1/publishing/variants/{id}/reconcile` accepts a verified remote post ID for an uncertain publication, checks it through the adapter, and records an audit result. This does not reset an uncertain publication for a blind retry; an operator must establish the remote outcome.
- Outbound adapter requests reserve shared Redis capacity atomically and observe rate-limit headers. Reddit reservations are shared at app scope. Production fails when shared limiting is unavailable; the memory fallback is for development/test only.
- Maintenance refreshes tokens/recovery every five minutes, subscription state hourly, channel metadata every four hours and metrics every two hours. SQLite token timestamps are normalized before UTC comparisons.

### Assistant, billing and analytics

- The feature registry has 41 features across eight channel profiles. Actual structured output and every destination/item are validated using platform-owned payload builders. Media-required outputs need actual validation context. Voice profiles and selected accounts are workspace-scoped.
- Real AI requires an explicit provider URL, API key and model. Fake output is opt-in outside production. Schema/validation failures after generation record consumed usage; reservations enforce workspace limits before a provider call.
- Added progress/final-output SSE. The complete event contains validated structured output; this is not raw model-token streaming.
- Added database plans and content templates, serialized quota checks, immediate-publication quota enforcement, token usage entries, estimated AI/provider costs and uniqueness against repeated accounting. Subscription reconciliation now commits; expired grants and unlimited/zero limits are handled.
- X publishing costs have a configurable workspace monthly estimate guard. Existing customer prices were not changed. AI credits still follow the application's run-based plan allowance while actual tokens/cost estimates are recorded separately.
- Analytics uses publication timestamps, covers all eligible variants/accounts rather than the old 100/50 caps, and does not write a successful zero snapshot after an API error. Providers that do not expose a metric mark it unavailable in extras. Period reports select publications in a period and summarize their latest cumulative metrics; they are not daily engagement deltas.

## Database and cleanup decisions

Production-data preservation was not explicitly confirmed. This repair therefore keeps existing data and history. No database was dropped, reset or upgraded outside isolated tests.

The original `ceb2b91baf53_postflow_initial_schema.py` remains. The additive `20261002_backend_reliability.py` adds `plans`, `content_templates`, OAuth protocol metadata, publication state/start/success timestamps, and usage-entry uniqueness. It contains a frozen initial plan seed rather than importing mutable application settings. The models now contain 28 application tables; the audit's existing identity and billing support tables remain.

There were no remaining extension/prospect/profile/operation modules or legacy-prefixed tables to delete. Removed the unused `publishing/token_crypto.py`, unused draft attachment/mention schemas and an unused author compatibility property. Removed unused `STORAGE_DRIVER` and `TOKEN_DELIVERY_MODE` configuration; `R2_PUBLIC_URL` now serves remote media. Existing dependencies were retained where used; added `regex` for Unicode and `Pillow` for image processing. README and implementation status now describe actual behavior and limits. No private `.env` values were copied into source files.

Frontend renaming and API contracts remain a separate task. The [audit's frontend inventory](audit-2026-10-02.md#modulefile-cleanup-and-rename-inventory) lists the retired branding and old extension/LinkedIn payload contracts; none were edited here.

## Verification

- Local Python 3.14: **200 passed, 1 skipped**. The skipped test requires an explicitly configured isolated Redis service. One existing Starlette TestClient deprecation warning remains.
- Ruff passes for `app`, `tests` and `migrations`; changed Python files are formatted, and `git diff --check` passes.
- Migration regression: upgrade the original revision, insert an existing user, upgrade to head, compare schema to models, downgrade to the original revision, retain the user, and upgrade again. All operations use a temporary SQLite database.
- `/health`, `/ready` and the eight-channel capabilities endpoint pass through the test client. Regression tests cover foreign-workspace requests, atomic claims, uncertain-outcome recovery, media polling/resume, OAuth replay/DPoP, Unicode, assistant failure accounting, quotas, analytics collection and SMTP TLS.
- Provider HTTP is mocked. PostgreSQL/Redis services, CI execution, live OAuth, platform approval, actual posting/media processing, email/storage/payment delivery and deployment have **not** been verified locally.

Added `.github/workflows/backend.yml`: SQLite on Python 3.12/3.14, plus PostgreSQL 16/Redis 7 migration and reliability checks. Optional service tests require `POSTFLOW_TEST_DATABASE_URL` with database name exactly `postflow_test`, and `POSTFLOW_TEST_REDIS_URL` for isolated Redis. The workflow is checked in as a working-tree change, not yet run by GitHub.

## Provider approval and supported API limits

These are implementation boundaries and external launch requirements, not evidence that a developer app already has access. Official documentation was checked during this repair; live access remains pending.

| Channel | Implemented flow and supported subset | Remaining access/limitations |
|---|---|---|
| X | OAuth 2 with PKCE; weighted 280-character posts, replies, polls, image/video upload and resumable threads. | Fund the pay-per-use developer app. Quote posting is rejected because the documented create endpoint requires Enterprise. Alt-text upload is not advertised for the chosen v2 flow. |
| LinkedIn | OAuth; supported version configurable, default `202609`; profile/company posts, images, multi-images, PDFs, videos and polls. | Product/permission approval and organization roles are required. Versioned image readiness reads cannot use write-only `w_member_social` alone. Personal metrics are limited by approved products; the existing organization metrics path does not prove personal analytics support. WebP is not advertised. |
| Reddit | Permanent OAuth, descriptive User-Agent; public/restricted eligible subreddit targets, text/link posts, cached rules/flairs and requirements. | Commercial permission/contract and app approval are external requirements. No image/gallery/poll publishing. Private communities are excluded from the shared rules cache. Subscribed communities are an eligibility-filtered discovery source, not an exhaustive list of all communities a user may post to. |
| Bluesky | Official AT Protocol OAuth; discovery, PAR, PKCE, DPoP, signed production client authentication; rich-text facets, images and threads. | Public HTTPS metadata/JWKS and a durable P-256 signing key are required. Old password/session connections must reconnect. Image upload is limited to 1 MB per blob with JPEG resizing; video upload is not advertised. |
| Mastodon | App registration and OAuth on the supplied instance; instance limits, content warning, visibility, media, polls and threads. | Instance OAuth/PKCE support and policies differ. Limits are refreshed from the instance rather than assumed universally. Dynamic HTTPS hosts must resolve to public addresses. |
| Facebook | Meta OAuth, Page selection and long-lived Page credentials; Page text/link posts, staged photos and video. | Pages only. Advanced access/app review, relevant Page permissions and roles are required. No claim of Facebook Reels publishing or alt-text support in this integration. |
| Instagram | Meta Facebook-login flow for Page-linked Business/Creator accounts; feed images, mixed carousels and Reels, with container status polling. | Professional account/Page setup and reviewed permissions required. JPEG feed publishing; currently 10-item carousels and a configured 100 MB video-upload ceiling. Deletion and alt-text publishing are unsupported in this integration. Current insight metric names need live/provider confirmation. |
| Threads | Official Threads OAuth, long-lived refresh, text/image/video/carousel containers, alt text, deletion and post insights. | Reviewed `threads_basic`, `threads_content_publish`, `threads_manage_insights` access required. 500-character text and 20-item carousel subset. Multi-post threads, polls and whole-account metrics are not advertised. |

### X cost implications

The checked official price is $0.015 for an ordinary post and $0.200 for a post containing a URL. At 250 posts this is **$3.75** or **$50** for publishing alone, before analytics/media/AI. `X_MONTHLY_SPEND_LIMIT_MICROS=10000000` defaults to a $10 estimated workspace budget. Reservations are conservative and may remain for failures; they are not provider invoice reconciliation or an app-wide spending cap. The selected account's actual developer entitlement/rate limits and response headers still govern access. [Official pricing](https://docs.x.com/x-api/getting-started/pricing), [create-post restrictions](https://docs.x.com/x-api/posts/create-post), [character counting](https://docs.x.com/fundamentals/counting-characters), [v2 media metadata](https://docs.x.com/x-api/media/create-media-metadata).

### LinkedIn approval and development access

Personal sign-in uses the OpenID Connect product (`openid`, `profile`, `email`); posting requires **Share on LinkedIn** with `w_member_social`. Company publishing/analytics requires **Community Management API** access and applicable `w_organization_social`, `r_organization_social`, `rw_organization_admin` permissions plus the member's Page role. Development-tier access is restricted (documented 500 app calls/day and 100 member calls/day, with a 12-month development window); Standard access requires approval. Additional member analytics/read products are separately restricted and are not implied by sign-in or posting access.

`202401` is retired; the version is now configuration rather than a stale constant. Image polling is an additional approval consideration: the versioned Images API documents `w_member_social` as write-only, so profile media must be tested with the required approved read access. [Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-06), [access tiers](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-06), [Images API permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-06), [video processing](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-06).

### Reddit commercial access and limits

Reddit requires permission and a contract for commercial use. Eligible free access is documented at **100 queries/minute per OAuth client ID**, averaged over the stated rate window; limits apply across users of the app. The implementation shares the limiter at app scope, sends a descriptive User-Agent and respects response headers. This does not establish contractual authorization. Only `identity`, `submit`, `read`, `mysubreddits` and flair-related access needed by the flow is requested. [Commercial requirements](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data), [Data API limits](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki), [official submit/rules API](https://www.reddit.com/dev/api/).

### Bluesky, Mastodon and Meta references

Bluesky's published OAuth protocol requires PAR, PKCE and DPoP; production confidential clients use asymmetric client authentication. [Official OAuth specification](https://atproto.com/specs/oauth), [post lexicon](https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/post.json), [image lexicon](https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/images.json).

Mastodon app registration, OAuth and media/status limits come from the chosen server. Its native status idempotency window is limited, so uncertain sends are still held for reconciliation. [Apps API](https://docs.joinmastodon.org/methods/apps/), [OAuth API](https://docs.joinmastodon.org/methods/oauth/), [media API](https://docs.joinmastodon.org/methods/media/), [status API](https://docs.joinmastodon.org/methods/statuses/).

Meta Page publishing requires the applicable Page listing, publishing, engagement and insight permissions (`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `read_insights`). Instagram's selected Facebook-login integration requires the linked professional account and Instagram publishing/insight permissions, including `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`. Public production use is subject to app review/advanced access and any required business verification. Instagram follows **create container → poll FINISHED → publish container**; API entitlement and publishing-limit endpoints must be exercised with the real app. Threads follows its own OAuth/token and container APIs. [Meta Facebook API collection](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api), [Instagram Facebook-login collection](https://www.postman.com/meta/instagram/folder/9cgqucg/instagram-api-with-facebook-login), [Threads official collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api).

The live validity of the existing Facebook/Instagram insight metric names is still unverified. Errors now fail collection rather than fabricating successful zero snapshots, but a production acceptance test must confirm the names supported by the chosen Graph API version and account. This remains a launch prerequisite.

## Run and configure

Use the tracked `.env.example` as the configuration reference. Do not replace an existing private environment file with the example.

1. Install backend dependencies (`.venv/bin/pip install -e '.[dev]'` from `backend`).
2. Set the intended `DATABASE_URL`; apply `.venv/bin/alembic upgrade head` before starting the updated app. The task did not apply it to the existing database.
3. Start `.venv/bin/uvicorn app.main:app --port 18000`.
4. Start worker and scheduler separately:

```sh
.venv/bin/python -c "from app.jobs.runner import run; run('worker')"
.venv/bin/python -c "from app.jobs.runner import run; run('scheduler')"
```

Production configuration includes:

- `APP_ENV=production`, a durable random `APP_SECRET` of at least 32 characters, PostgreSQL and `REDIS_URL`.
- `TOKEN_ENCRYPTION_KEY`: a valid Fernet key for new encryption. `TOKEN_ENCRYPTION_PREVIOUS_KEYS`: comma-separated prior Fernet keys used only for reading old records. The current APP_SECRET-derived legacy key remains a decryption fallback. Rotation writes the primary key when tokens are refreshed/reconnected; there is no bulk re-encryption command. Do not remove old keys until stored tokens have been rewritten, and preserve the old APP_SECRET-derived key if changing APP_SECRET while legacy records remain.
- `OAUTH_REDIRECT_BASE_URL`: public HTTPS callback template `/api/v1/channels/{platform}/callback`. Register every concrete callback with its provider; provide platform app IDs/secrets in their corresponding environment settings.
- `BLUESKY_CLIENT_ID`: public HTTPS metadata URL, normally `/api/v1/channels/bluesky/client-metadata`; `BLUESKY_PRIVATE_KEY`: durable P-256 PEM signing key; `BLUESKY_KEY_ID`: matching published key ID. The metadata endpoint exposes public keys only.
- `THREADS_APP_ID`, `THREADS_APP_SECRET`; supported `LINKEDIN_API_VERSION` and `GRAPH_API_VERSION` as granted to the app (defaults `202609`, `v23.0`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`, `FRONTEND_URL`; real deliveries require configured SMTP. Debug tokens are limited to development/test.
- R2/S3 endpoint, bucket and access credentials, `R2_PUBLIC_URL` if available, and ClamAV service settings. Instagram/Meta must be able to fetch media URLs during container processing; otherwise expiring presigned URLs are used and require timely processing.
- `LLM_PROVIDER_URL`, `LLM_PROVIDER_API_KEY`, `LLM_MODEL`, `LLM_MAX_OUTPUT_TOKENS`; `LLM_COST_MICROS_PER_TOKEN` is an estimate for reporting. `LLM_MOCK_ENABLED=true` is permitted only outside production.
- Actual Dodo API/product/webhook configuration to accept payments; `X_MONTHLY_SPEND_LIMIT_MICROS` sized for the accepted provider-cost budget.

Verification commands from `backend`:

```sh
.venv/bin/ruff check app tests migrations
.venv/bin/pytest -o addopts='' -q
```

## Open launch work

1. Configure developer credentials, get required platform approvals and validate all supported flows with authorized test accounts. In particular, confirm LinkedIn media/read access and Meta insight names/limits.
2. Run the added PostgreSQL/Redis CI jobs and production-like worker tests before deployment. Local mocked/SQLite checks do not establish multi-process PostgreSQL behavior or actual Redis connectivity.
3. Apply the additive migration to the selected environment and verify real SMTP, storage/scanning, payment webhooks, provider spend and AI generation there.
4. Address the frontend's retired contracts/branding under its separate spec. A working backend does not make the current frontend compatible with these endpoints.

The unsupported API features above remain explicit capability restrictions. They require a separately verified integration if product scope demands them; this report does not mark them complete.

## Files touched

The following inventory is generated from the final working-tree changes. Paths are relative to the repository; all application work is under `backend`, with one backend-only CI workflow.

- `.github/workflows/backend.yml` — added.
- `backend/.env.example` — modified.
- `backend/IMPLEMENTATION_STATUS.md` — modified.
- `backend/README.md` — modified.
- `backend/app/core/config.py` — modified.
- `backend/app/core/safe_http.py` — added.
- `backend/app/core/security.py` — modified.
- `backend/app/db/models.py` — modified.
- `backend/app/jobs/runner.py` — modified.
- `backend/app/modules/analytics/schemas.py` — modified.
- `backend/app/modules/analytics/service.py` — modified.
- `backend/app/modules/assistant/base.py` — modified.
- `backend/app/modules/assistant/features.py` — modified.
- `backend/app/modules/assistant/llm_client.py` — modified.
- `backend/app/modules/assistant/profiles.py` — modified.
- `backend/app/modules/assistant/router.py` — modified.
- `backend/app/modules/assistant/schemas.py` — modified.
- `backend/app/modules/assistant/service.py` — modified.
- `backend/app/modules/billing/entitlements.py` — modified.
- `backend/app/modules/billing/models.py` — modified.
- `backend/app/modules/billing/service.py` — modified.
- `backend/app/modules/billing/usage.py` — added.
- `backend/app/modules/channels/adapters/bluesky.py` — modified.
- `backend/app/modules/channels/adapters/bluesky_oauth.py` — added.
- `backend/app/modules/channels/adapters/facebook.py` — modified.
- `backend/app/modules/channels/adapters/instagram.py` — modified.
- `backend/app/modules/channels/adapters/linkedin.py` — modified.
- `backend/app/modules/channels/adapters/mastodon.py` — modified.
- `backend/app/modules/channels/adapters/media.py` — added.
- `backend/app/modules/channels/adapters/meta.py` — added.
- `backend/app/modules/channels/adapters/reddit.py` — modified.
- `backend/app/modules/channels/adapters/text.py` — added.
- `backend/app/modules/channels/adapters/threading.py` — added.
- `backend/app/modules/channels/adapters/threads.py` — added.
- `backend/app/modules/channels/adapters/x.py` — modified.
- `backend/app/modules/channels/base.py` — modified.
- `backend/app/modules/channels/models.py` — modified.
- `backend/app/modules/channels/oauth.py` — modified.
- `backend/app/modules/channels/reddit_router.py` — modified.
- `backend/app/modules/channels/registry.py` — modified.
- `backend/app/modules/channels/router.py` — modified.
- `backend/app/modules/channels/schemas.py` — modified.
- `backend/app/modules/channels/support.py` — added.
- `backend/app/modules/content/models.py` — modified.
- `backend/app/modules/content/router.py` — modified.
- `backend/app/modules/content/schemas.py` — modified.
- `backend/app/modules/identity/mail.py` — added.
- `backend/app/modules/identity/router.py` — modified.
- `backend/app/modules/media/publishing.py` — added.
- `backend/app/modules/media/router.py` — modified.
- `backend/app/modules/media/schemas.py` — modified.
- `backend/app/modules/media/service.py` — modified.
- `backend/app/modules/publishing/rate_limiter.py` — modified.
- `backend/app/modules/publishing/router.py` — modified.
- `backend/app/modules/publishing/service.py` — modified.
- `backend/app/modules/publishing/token_crypto.py` — deleted.
- `backend/app/modules/workspaces/router.py` — modified.
- `backend/docs/audit-2026-10-02.md` — added.
- `backend/docs/backend-repairs-2026-10-02.md` — added.
- `backend/migrations/versions/20261002_backend_reliability.py` — added.
- `backend/pyproject.toml` — modified.
- `backend/requirements.txt` — modified.
- `backend/tests/conftest.py` — modified.
- `backend/tests/test_adapter_bluesky.py` — modified.
- `backend/tests/test_adapter_facebook.py` — modified.
- `backend/tests/test_adapter_instagram.py` — modified.
- `backend/tests/test_adapter_linkedin.py` — modified.
- `backend/tests/test_adapter_mastodon.py` — modified.
- `backend/tests/test_adapter_reddit.py` — modified.
- `backend/tests/test_assistant.py` — modified.
- `backend/tests/test_backend_reliability.py` — added.
- `backend/tests/test_channels_framework.py` — modified.
- `backend/tests/test_publishing_pipeline.py` — modified.
- `backend/tests/test_reddit_advanced_features.py` — modified.
