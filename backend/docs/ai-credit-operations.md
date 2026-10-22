# AI credit counters and operator controls

AI credits are **workspace-owned and shared by members**, not a separate balance
for every team member. A campaign can target a user's owned workspace; if they
own multiple workspaces, select the intended workspace explicitly.

## Data and accounting

- `ai_credit_balances`: one numeric row per workspace. `monthly_used` counts
  completed charged monthly requests. `monthly_reserved` holds active monthly
  requests. `bonus_credits` is the unspent one-time wallet, including any
  `bonus_reserved` holds. `bonus_used` tracks completed bonus usage in this cycle.
- `ai_credit_reservations`: one row per AI run, recording its source, original
  monthly window, expiry, and reserved/settled/released/expired state.
- `ai_credit_events`: before/after snapshots, action, operator/system actor,
  reason, operation key and timestamp. PostgreSQL triggers also audit raw
  balance INSERT/UPDATE statements issued from a terminal.
- `assistant_runs`: retained provider/request audit history. This history is no
  longer recounted to enforce credits once a balance has been initialized.
- `usage_ledger`: retains actual token/provider costs, including failed AI
  requests that incurred provider expense. A failed generation refunds the
  customer credit, not the provider expense.

Every generation route (including conversations, streaming wrappers, brand
training and MCP) funnels through `assistant.service.execute_feature`.
Before the provider call, the backend locks the workspace then the balance,
reserves one credit and commits. It releases those locks before network calls.
Monthly credits are used first, then bonus credits. Success converts the hold
to usage; provider/validation failure or cancellation releases it exactly once.
A failed final database commit rolls back and re-reads durable state before
attempting a refund, avoiding a duplicate charge/refund or expense entry.

Stale holds expire after 30 minutes, lazily on balance access and through a
bounded maintenance pass every five minutes in the scheduler. Late output
cannot be returned as a successful free generation after its hold expires.
An old monthly request finishing after rollover cannot consume the new month's
allowance. Bonus holds survive rollover and settle/refund against the same
wallet. Manual resets preserve active holds.

Monthly Starter/Pro/Business allowances remain 1,000/5,000/8,000, including annual
subscriptions. Windows retain the original monthly billing day and handle
short months. An upgrade/downgrade does not erase current usage or move an
unexpired stored window. On its next rollover, the current subscription's
monthly window applies. Free uses UTC calendar windows when initialized.
Current manual entitlement overrides remain monthly **limit overrides**; they
are not converted into or overwritten by one-time gifts.

Bonus credits do not renew monthly or expire automatically. They remain until
used. New accounts start with zero bonus credits. Neither changing plans nor
payment webhooks refill that wallet. Monthly unused allowance does not roll
over. If paid usage exceeds a downgraded monthly limit, monthly availability is
zero but any unspent bonuses remain usable; displayed detail separates both.

## Deploy safely

1. Back up PostgreSQL. Stop/drain **all** old API instances and any AI consumers;
   old code writes run logs without updating counters and must not overlap with
   the new code during the cutover. Pause the old scheduler during deployment.
2. Apply `alembic upgrade head` with the new backend image/code. Revision
   `20261018_ai_credit_counters` adds the three tables and seeds **every existing
   workspace**, preserving successful usage and live holds in its current
   monthly window. Existing users, subscriptions, manual limits and run history
   are not deleted or reset. Processing uses workspace keyset batches of 100.
3. Start the updated API and scheduler, then deploy the updated frontend. New
   workspaces initialize automatically on first usage check or admin operation.
4. Check `/health`, `/ready`, Billing/Home/composer balances and a real AI run.

No new provider keys or Redis credit cache are needed. PostgreSQL is authoritative.
SQLite remains supported for development/tests. SQL operator functions/auditing
are PostgreSQL features; application operations are audited on both databases.
Do not automatically downgrade this migration: doing so would discard gifted
balances and re-count usage that was intentionally reset. Restore a reviewed
backup or write a corrective forward migration.

## Terminal controls (recommended)

Run from `backend`. These Compose commands use the API container's actual
PostgreSQL configuration. A host `.env` may still point at a different SQLite
database, so do not assume a host command targets the deployed database.
Never put database passwords in command history.

Inspect a workspace:

```sh
docker compose exec -T api python -m app.modules.billing.credit_admin balance \
  --workspace WORKSPACE_ID
```

For an owner with exactly one workspace, `--email owner@example.com` can replace
`--workspace`. Ambiguous owners are rejected rather than choosing a workspace.
An operator can find the intended workspace with:

```sql
SELECT w.id, w.name, u.email
FROM workspaces w JOIN users u ON u.id = w.owner_user_id
WHERE u.email = 'owner@example.com';
```

Give 500 one-time credits:

```sh
docker compose exec -T api python -m app.modules.billing.credit_admin grant \
  --workspace WORKSPACE_ID --amount 500 --actor marketing \
  --reason 'Launch campaign' --key launch-2026-customer-123
```

Reset completed monthly usage to zero, retaining reservations and bonus balance:

```sh
docker compose exec -T api python -m app.modules.billing.credit_admin reset \
  --workspace WORKSPACE_ID --actor support \
  --reason 'Customer compensation' --key support-ticket-123-reset
```

**Reuse the same operation key when retrying the same command.** A repeated
request with the same key does not grant/reset again. Reusing it with a different
action or grant amount fails. Use a new key only for an intentional new action.
Grants accept positive whole amounts up to 1,000,000 per operation. No public
customer-facing endpoint grants or resets credits.

Inspect the latest 100 events or initialize/refresh all workspace balances:

```sh
docker compose exec -T api python -m app.modules.billing.credit_admin audit --workspace WORKSPACE_ID
docker compose exec -T api python -m app.modules.billing.credit_admin backfill
```

`balance` and `backfill` initialize missing rows and advance expired windows;
they **never** reconstruct an existing numeric balance from historical runs.
The API polls usage every 60 seconds, on window focus and after AI requests.
Billing refresh, the composer's **Refresh credits**, or a page reload picks up
an operator adjustment sooner.

## Simple PostgreSQL queries

You can use your existing database terminal connection. These functions take
the same workspace/balance locks as the app, require a reason and operation key,
and are audited and retry-safe:

```sql
-- Add 500 one-time bonus credits.
SELECT draftva_adjust_ai_credits(
  'WORKSPACE_ID', 'grant', 500, 'Launch campaign', 'launch-2026-customer-123'
);

-- Reset completed monthly usage, preserving active requests and bonus credits.
SELECT draftva_adjust_ai_credits(
  'WORKSPACE_ID', 'reset', 0, 'Support compensation', 'ticket-123-reset'
);
```

For a missing or expired balance, run the CLI `balance` command first. The SQL
function rejects stale windows rather than resetting against the wrong month.
The function uses the caller's normal database privileges; it is not a public
API or a permission-escalating function.

A literal numeric update is possible too and PostgreSQL will audit it:

```sql
BEGIN;
SELECT id FROM workspaces WHERE id = 'WORKSPACE_ID' FOR UPDATE;
SET LOCAL draftva.credit_context = '{"actor":"support","reason":"Ticket 123","action":"manual_reset"}';
UPDATE ai_credit_balances SET monthly_used = 0, updated_at = now()
WHERE workspace_id = 'WORKSPACE_ID'
RETURNING workspace_id, monthly_used, monthly_reserved, bonus_credits;
COMMIT;
```

Prefer the function/CLI: raw SQL has no retry key unless you supply one and can
accidentally target zero/multiple rows. Do not edit `monthly_reserved`,
`bonus_reserved`, cycle timestamps, reservation rows, or historical run statuses
as a way to give credits. Do not delete a balance row. Database checks reject
negative counters and bonus balances below active holds; a database administrator
still has privileged power to change/drop data and must operate carefully.

## Verification

```sh
.venv/bin/python -m pytest tests/test_ai_credit_counters.py tests/test_ai_credit_migration.py tests/test_billing_usage.py
```

The PostgreSQL test job uses only the isolated `draftva_test` database via
`draftva_TEST_DATABASE_URL`. It verifies concurrent last-credit reservations,
retry-safe gifts, SQL functions and direct-SQL auditing. Other tests cover bonus
refunds, resets during requests, expiry/late output, rollover, upgrades/downgrades,
legacy migration, operator targeting, and failure to commit a generated result.
