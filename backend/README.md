# postflow Backend

FastAPI modular monolith backend for **postflow**, a multi-channel social media scheduling and writing platform supporting X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook Pages, Instagram Business/Creator, and Threads.

## Key Capabilities

- **Official OAuth & Adapters**: Dedicated adapters for X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook, and Instagram adhering strictly to official APIs and developer policies. No scraping, no unofficial endpoints.
- **Publishing Pipeline**: Per-variant scheduling, distributed sliding-window rate limiting, idempotency keys, exponential backoff retries, and comprehensive audit logs in `publish_attempts`.
- **Platform-Aware AI Assistant**: Feature registry and per-platform profiles providing 32 distinct writing and formatting tools (threads, carousels, subreddit compliance checks, alt text, hooks, voice tone training).
- **Multi-Tenant Workspaces & RBAC**: Tenant-scoped data access, role enforcement (`owner`, `admin`, `editor`, `billing`, `member`), session management with Argon2id and SHA-256 token hashing.
- **Analytics & Billing**: Plan limits enforcement for connected accounts, scheduled queue size, and assistant usage; aggregated metrics across platforms and variants.
- **Cryptographic Security**: Stored OAuth tokens and secrets encrypted at rest via Fernet; untrusted external URLs safely encapsulated during AI workflows.

## Architecture

```
backend/app/
  core/            # Config, security, crypto, Redis client, rate limits
  db/              # SQLAlchemy session, engine, model base
  jobs/            # Background job runners (publishing, profile sync, metrics)
  modules/
    identity/      # Users, auth, sessions, password reset, Google sign-in
    workspaces/    # Multi-tenant workspaces, members, invitations
    billing/       # Plans, subscriptions, usage ledger, entitlements
    channels/      # Base protocol, registry, OAuth handling, platform adapters
    content/       # Posts, variants, ideas, pillars
    media/         # Asset management, R2 storage, validation
    publishing/    # Queue dispatch, scheduler, execution pipeline, rate limiter
    assistant/     # Feature registry, platform profiles, LLM client, voice profiles
    analytics/     # Metrics aggregation, overview, and synchronization
```

## Running the Application

### Local Development

1. Create a virtual environment and install dependencies:
   ```sh
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e '.[dev]'
   ```

2. Configure environment:
   ```sh
   cp .env.example .env
   # Update APP_SECRET, DATABASE_URL, and OAuth credentials as required
   ```

3. Run migrations and start the server:
   ```sh
   alembic upgrade head
   uvicorn app.main:app --reload --port 18000
   ```

### Running with Docker Compose

```sh
docker compose up --build -d
```

## Verification & Testing

Run code formatting, linter, and the automated test suite:

```sh
# Linting
ruff check app tests migrations

# Automated tests (132 passing tests)
pytest tests/ -v
```
