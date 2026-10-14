# Billing reconciliation and recovery

## Purpose and scope

Signed Dodo webhooks remain the primary source of billing updates. Reconciliation
periodically reads Dodo's subscription endpoint to repair the state of subscriptions
already known to Draftva. It updates status, quantity, billing dates, cancellation,
configured product/plan changes and the workspace's plan entitlements.

It performs read-only provider requests. It does not charge, cancel, create or refund
subscriptions. Public OTP/password-reset email delivery is a separate system;
this change does not add an email queue.

The old implementation selected at most 200 subscriptions and silently skipped
failures. The replacement scans every local subscription except `revoked`, including
failed/expired records that may have recovered. Refund/dispute revocations are never
re-enabled by a subscription lookup.

This job cannot discover a remote subscription whose initial creation webhook never
created a local record. Re-deliver that creation event through Dodo's dashboard.
Subscription lookups also do not recover missing refund/dispute events; those events
must be delivered/replayed separately. A provider request failure never means that
the customer cancelled or lost access.

## Progress and concurrency

- `billing_reconciliation_states` holds one `dodo` checkpoint: last processed local
  ID, the pass's highest ID, start/completion times, next full pass, next allowed API
  request and a renewable scheduler lease.
- Local database pagination uses `id > cursor_id`, ascending ID order and bounded
  batches. It does not use offsets or Dodo's remote list pagination.
- A pass captures its highest ID so new subscriptions cannot extend it indefinitely.
  New IDs below its cursor or above its highest ID are handled in the following pass;
  normal webhooks still update them immediately.
- Each scheduler tick makes a bounded number of calls and has a time budget. A pass
  continues on later ticks/restarts until complete. The full-pass interval begins
  when the previous pass completes, rather than restarting at row one every hour.
- Successful updates, entitlement changes, retry records and cursor advancement
  commit together after each record. A process failure can repeat the unfinished
  **GET**; it cannot skip an uncommitted outcome or initiate a payment.
- A database lease admits one scheduler at a time. It is renewed before provider
  calls and checked again before applying results. An expired/lost lease holder
  discards its result; a new scheduler can resume the checkpoint.
- Provider HTTP runs without holding workspace/subscription locks. A short database
  transaction locks the workspace/subscription when applying the response. If a
  webhook changed the subscription during the request, that response is deferred
  for a fresh lookup instead of overwriting the webhook.

Current subscriptions are selected by creation time with an ID tie-breaker.
Reconciliation bookkeeping cannot turn an old subscription into the current plan.
Both webhooks and reconciliation synchronize grants from the current workspace
subscription. Expired/failed/pending records cannot keep paid entitlements; cancelled
subscriptions retain access only until their recorded period ends. Hold grace is
created on the observed transition and is not extended by every subsequent check.

## Retries and request pacing

`billing_reconciliation_retries` stores the subscription ID, failure count, next
attempt, last attempt and a sanitized error code. It contains no API keys, response
bodies or customer payment data. A successful lookup removes its retry record.

Individual invalid responses, unknown active product mappings, stale snapshots and
record-update failures are retried with exponential backoff and up to 20% jitter.
They do not prevent the pass from moving on. Due retries and normal work alternate
so a repeatedly failing subscription cannot monopolize the scan. Retries are serviced
on scheduler ticks even between full passes.

Network failures, HTTP 408/429/5xx and authentication failures pause the entire
provider, rather than trying the same broken provider for every customer. This pause
is durable and shared between scheduler processes. `Retry-After` seconds/HTTP dates
and `retry-after-ms` are respected when longer than local backoff. Invalid, non-finite
or implausible values (one year or more) fall back to local backoff. Authentication
failures and HTTP 404 records wait at least one full-pass interval.

Retries continue at the capped backoff until recovery; unresolved records are visible
for operator review. A configured cap of 3,600 seconds can add up to 20% jitter, and
a valid longer provider-directed delay takes precedence. There is no sleep loop for
long provider cooldowns: the tick returns and other scheduler maintenance can run.

An unrecognized active `product_id` does not grant a guessed plan. Configure the
matching Dodo product IDs and let the retry recover. Verified terminal/hold/cancelled
statuses still apply without a new product mapping so mapping errors cannot hide a
loss of paid access. Responses must match the requested provider subscription ID
and contain a supported status, positive integer quantity and boolean cancellation
flag. Malformed responses do not partially update billing state.

## Configuration

Set these backend environment values as needed:

```dotenv
DODO_API_KEY=<server-only key for the intended test/live environment>
DODO_API_BASE=https://test.dodopayments.com
DODO_WEBHOOK_SECRET=<matching webhook secret>
# Configure DODO_PRODUCT_* IDs for every paid plan you enable.
BILLING_RECONCILE_INTERVAL_SECONDS=3600
BILLING_RECONCILE_BATCH_SIZE=200
BILLING_RECONCILE_MAX_REQUESTS=20
BILLING_RECONCILE_TIME_BUDGET_SECONDS=30
BILLING_RECONCILE_REQUEST_INTERVAL_SECONDS=1
BILLING_RECONCILE_HTTP_TIMEOUT_SECONDS=10
BILLING_RECONCILE_RETRY_BASE_SECONDS=60
BILLING_RECONCILE_RETRY_MAX_SECONDS=3600
```

`BATCH_SIZE` controls local database reads; `MAX_REQUESTS` controls provider requests
per tick. Default pacing allows one request per second or slower, depending on
latency. It is an application setting, not a claim about Dodo's account-specific
quota. Adjust it to your provider limits; the job additionally honors provider
backoff responses.

The budget is checked before work/sleep. An in-flight request may exceed that budget
by its HTTP timeout and database completion time. Default lease duration is the
budget plus twice the HTTP timeout plus 30 seconds. The scheduler's polling interval
also contributes to total pass duration. Monitor age of completed passes as customer
count grows and tune bounded tick settings accordingly.

Without `DODO_API_KEY`, the job is a no-op and makes no provider calls. Changing
container environment requires recreation, not just a restart. If changing
merchant/test/live environment, inspect existing subscription IDs and retry state
before resuming; an ID belonging to another environment will not be found.

## Deploy and operate

The additive migration `20261015_billing_recovery` creates two recovery tables. It
does not reset application data or rewrite existing subscription records.

From `backend/`, deploy the new code/migration before starting the new scheduler:

```sh
docker compose exec -T api alembic upgrade head
docker compose up -d --no-deps --force-recreate api worker scheduler
```

For an image-based deployment, build/release the new image and run its migration
job before replacing application processes. The local Compose setup mounts source
files; the migration command above assumes the new migration is available there.

Inspect progress without calling Dodo:

```sh
docker compose exec -T api python -m app.modules.billing.reconciliation status
```

Run one bounded tick manually (honors the same lease and provider cooldown):

```sh
docker compose exec -T api python -m app.modules.billing.reconciliation tick
```

Useful read-only PostgreSQL queries:

```sql
SELECT cursor_id, upper_bound_id, started_at, completed_at,
       next_run_at, next_request_at, lease_expires_at, provider_failures
FROM billing_reconciliation_states WHERE provider = 'dodo';

SELECT subscription_id, attempts, error_code, last_attempt_at, next_attempt_at
FROM billing_reconciliation_retries ORDER BY next_attempt_at LIMIT 100;
```

Review repeated `provider_401`/`provider_403` errors for credentials/permissions,
`provider_404` for environment/ID mismatches, `invalid_response` for schema changes,
and `stale_or_unknown_product` for webhook races or missing product mappings. Fix
the cause; due retries recover automatically. Do not delete/reset the checkpoint or
clear a live scheduler's lease to force a request around provider backoff.

Alert on repeated credential failures, growing retry counts, stale completed-pass
timestamps or a checkpoint that stops advancing. The CLI provides inspection; it
does not install a monitoring/alerting service. A crashed lease expires automatically.

## Verification

```sh
.venv/bin/ruff check app/modules/billing app/jobs/runner.py app/core/config.py app/db/models.py tests/test_billing_reconciliation.py migrations/versions/20261015_billing_recovery.py
.venv/bin/pytest tests/test_billing_reconciliation.py tests/test_webhook_security.py tests/test_billing_usage.py
.venv/bin/pytest
```

Tests exercise more than 200 records, separate-session restarts, deleted cursors,
new IDs during a pass, malformed and mismatched responses, provider backoff, due
retries between passes, pacing/time budgets, lease contention/expiry/loss,
interruption, rollback, concurrent webhook changes, old subscription/refund events,
product changes and paid/unlimited-post entitlement preservation. HTTP is mocked;
these tests do not make charges or use a live Dodo account.

References: [official Dodo subscription schema](https://github.com/dodopayments/dodopayments-python/blob/main/src/dodopayments/types/subscription.py),
[official SDK retry/error behavior](https://github.com/dodopayments/dodopayments-python#retries).
