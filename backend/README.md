# draftva backend

FastAPI, SQLAlchemy 2, Alembic and Pydantic Settings, with a database-backed polling publisher and Redis for shared outbound limits. PostgreSQL is used by Compose; SQLite supports local development.

Eight adapters are registered: X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook Pages, Instagram professional accounts, and Threads. Provider requests are covered by mocked tests; this is not a claim of production access or successful live publishing. See [implementation status](IMPLEMENTATION_STATUS.md) and the [repair and provider report](docs/backend-repairs-2026-10-02.md).

## Run locally

From `backend`:

```sh
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
cp .env.example .env
# Set APP_SECRET and the provider/storage/email configuration you need.
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 18000
```

Run the publishing worker and maintenance scheduler in separate terminals:

```sh
.venv/bin/python -c "from app.jobs.runner import run; run('worker')"
.venv/bin/python -c "from app.jobs.runner import run; run('scheduler')"
```

Redis is required in production. Mock AI output is explicitly opt-in and prohibited in production. Real AI requires `LLM_PROVIDER_URL`, `LLM_PROVIDER_API_KEY` and `LLM_MODEL`. Uploads require R2/S3 and ClamAV. Verification, password-reset and invitation emails require SMTP with verified STARTTLS.

Billing reconciliation uses durable keyset progress, a shared scheduler lease and
per-subscription retries. See [billing recovery operations](docs/billing-reconciliation.md)
for configuration, migration, inspection commands and its recovery limits.

Set `OAUTH_REDIRECT_BASE_URL` to your public API callback template, ending in `/api/v1/channels/{platform}/callback`. Register the concrete URL for each app. Instagram and Facebook can each set an exact `INSTAGRAM_REDIRECT_URI` or `FACEBOOK_REDIRECT_URI` override. Instagram requires its own Instagram Login app credentials; see the [Instagram Business Login setup](docs/instagram-business-login.md). Bluesky needs a public HTTPS client-metadata URL and a P-256 client signing key; see the report.

Compose runs the migrations before the API, worker and scheduler:

```sh
docker compose up --build -d
```

## Verify

```sh
.venv/bin/ruff check app tests migrations
.venv/bin/pytest -o addopts='' -q
```

The regression suite checks workspace isolation, publication claims and uncertain outcomes, media processing and resume, OAuth replay/DPoP, quota and AI usage accounting, analytics coverage, and an additive migration with existing records. `GET /health` and `GET /ready` provide basic health/database checks.

The backend CI workflow runs SQLite checks on Python 3.12 and 3.14 and a separate PostgreSQL/Redis job. Optional service tests use an explicitly isolated database named `draftva_test` through `draftva_TEST_DATABASE_URL`; never point the test suite at application data.

The new migration is additive. Existing application/production databases have not been reset or migrated by this repair task; run `alembic upgrade head` against the intended database before starting the updated application.
