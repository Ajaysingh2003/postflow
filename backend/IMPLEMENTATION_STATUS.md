# postflow: Backend Implementation Status

Updated: October 2026

## Architecture Overview

**postflow** is a multi-channel social media scheduling and writing platform. The backend has been completely rewritten from the legacy LinkedIn automation product into a modular monolith following the specifications in `AGENTS.md`.

## Implemented and Verified (Phases 0 through 7)

### Phase 1: Cleanup, Renaming & Fresh Database
- Fully purged legacy LinkedIn automation code, extension endpoints (`modules/extension`), prospect scraping (`modules/prospects`), and obsolete dependencies.
- Renamed project identity, configurations, Docker compose services, environment variables, and database to `postflow`.
- Created a clean initial Alembic migration (`0001_initial_postflow_schema.py`) without legacy table clutter.

### Phase 2: Core Schema & Models
- Multi-tenant data model in PostgreSQL/SQLite using SQLAlchemy 2.0 and Alembic.
- Clean plural snake_case tables: `users`, `sessions`, `workspaces`, `workspace_members`, `plans`, `subscriptions`, `usage_counters`, `connected_accounts`, `mastodon_apps`, `subreddit_profiles`, `oauth_states`, `posts`, `post_variants`, `media_assets`, `post_variant_media`, `publish_attempts`, `metrics_snapshots`, `voice_profiles`, `assistant_runs`.
- Cryptographic security: Fernet symmetric encryption at rest for OAuth tokens and Mastodon client secrets; Argon2id password hashing; SHA-256 session token hashing.

### Phase 3: Channels Framework
- Extensible `PlatformAdapter` protocol (`channels/base.py`) defining lifecycle hooks: `build_auth_url`, `handle_callback`, `refresh_tokens`, `revoke`, `list_targets`, `validate`, `publish`, `delete_post`, and `fetch_metrics`.
- Dynamic channel registry (`channels/registry.py`) and generic OAuth handler (`channels/oauth.py`) with PKCE verifier generation, state management, and automatic token refresh.
- REST endpoints for channel connection, callbacks, disconnection, capability queries, and targets listing.

### Phase 4: Official Platform Adapters
Dedicated adapters adhering strictly to official API documentation and policies:
1. **X (Twitter)**: OAuth 2.0 PKCE, tweet/thread posting via `/2/tweets`, metrics fetching via `/2/tweets?tweet.fields=public_metrics`.
2. **LinkedIn**: Official REST API (v2), member post creation via `/rest/posts` with `author=urn:li:person:...` or organizational author urn, metrics lookup.
3. **Reddit**: Script/Web app OAuth with permanent refresh tokens, descriptive `User-Agent`, target subreddit validation, flair and post type rules, cached `SubredditProfile` inspection.
4. **Bluesky**: AT Protocol (`com.atproto.repo.createRecord`), rich-text facet extraction (links, mentions, hashtags), grapheme-based character counting (300 graphemes max).
5. **Mastodon**: Dynamic per-instance app registration stored in `mastodon_apps`, instance-aware character limits, media limits, and status publishing.
6. **Facebook**: Meta Graph API, Page target selection via `accounts` edge, long-lived Page tokens, and feed publishing (`/{page_id}/feed`).
7. **Instagram**: Meta Graph API for Business/Creator accounts, media container creation (`/{ig_user_id}/media`) followed by publication (`/{ig_user_id}/media_publish`), supporting image, carousel, and Reels.

### Phase 5: Publishing Pipeline
- Per-variant independent scheduling, validation, and queue dispatch.
- Idempotency guarantees preventing duplicate posts across retries.
- Exponential backoff with jitter up to 5 attempts, recording full audit history in `publish_attempts`.
- Distributed rate limiter supporting sliding-window limits across platforms with Redis and in-memory fallback.
- Background jobs: `dispatch_due_async`, `refresh_subreddit_profiles_async`, and `fetch_metrics_job_async`.

### Phase 6: AI Assistant
- Provider-agnostic LLM interface with OpenAI-compatible JSON schema adherence.
- Platform-specific profiles and 32 dedicated features (X thread writer, hook variants; LinkedIn long-form & carousels; Reddit title variants, subreddit-aware rewrites & compliance checks; Bluesky facets & short-form; Mastodon CW & CamelCase tags; Facebook Page posts & CTA; Instagram captions & Reels; plus Shared repurposing & voice training).
- Untrusted URL extraction boundaries preventing prompt injection; voice profile personalization; usage logging in `assistant_runs`.

### Phase 7: Analytics and Billing Limits
- Aggregated analytics endpoints (`/api/v1/analytics/overview`, `/accounts`, `/variants/{id}`, `/posts/{id}`) combining metrics snapshots across likes, comments, shares, views, and clicks.
- On-demand metrics synchronization trigger (`/api/v1/analytics/sync-now`).
- Strict plan entitlement enforcement across tier quotas: connected accounts, active scheduled posts, and AI assistant runs, returning HTTP 403 Forbidden with upgrade guidance when limits are exceeded.

## Verification & Test Suite

- **All 132 tests pass** across unit and integration suites (`pytest tests/`).
- **Code style & linting**: 100% clean check via `ruff check app tests migrations`.
