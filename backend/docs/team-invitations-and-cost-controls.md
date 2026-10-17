# Team invitations, analytics reads and storage controls

## Team invitations

Owners/admins invite an email address and a role from Settings → Team. Draftva sends
`FRONTEND_URL/invitations/accept?token=…` through the existing Resend/SMTP delivery.
The token is random; only its hash is stored. The link lasts seven days.

The acceptance page previews a masked recipient address, workspace and role. It
requires explicit acceptance after signing in or registering and verifying email.
Login/register switches, social login and OTP verification preserve the complete
invitation destination. An existing signed-in user can switch accounts. Acceptance
must use the invited email; it never changes an existing member's role.

Paid plans include Starter 3, Pro 5 and Business 15 team seats, independent of Dodo product quantity. Legacy quantity-derived plan grants are corrected at read time; explicit non-plan overrides remain authoritative and survive entitlement synchronization.

Pending, unexpired invitations reserve seats. Resending replaces the previous
link without reserving another seat. Revoking releases the pending reservation.
An existing member cannot be invited again. Acceptance locks the workspace and
rechecks capacity and the inviter's current owner/admin membership. An invitation
can remain pending after a downgrade until its owner frees a seat. Repeated
acceptance by an existing member is idempotent. Removed members cannot reuse an
already accepted invitation to regain access.

Single-invitation delivery errors roll back the new invitation and preserve the
old link during a failed resend. Bulk email is necessarily not atomic: already
sent invitations remain valid if a later recipient's delivery fails. The error
reports the number sent and the failed recipient; retry the remaining addresses.
Delivery is synchronous and provider acceptance does not prove inbox delivery.
Monitor sender-domain authentication, bounces and provider delivery logs.

Endpoints:

- `POST /api/v1/workspaces/current/invitations` (existing)
- `POST /api/v1/workspaces/current/invitations/bulk` (existing)
- `GET /api/v1/workspaces/current/invitations` — live pending invitations
- `DELETE /api/v1/workspaces/current/invitations/{id}` — revoke
- `POST /api/v1/workspaces/invitations/preview` — token in body; no login required
- `POST /api/v1/workspaces/invitations/accept` — verified account, exact invited email

Do not log invitation tokens. The preview contains no unmasked email, user ID,
workspace ID or provider credentials. The page is noindex and uses no-referrer.

## Shared analytics results

Official platform APIs remain the source. SQL analytics snapshots are not written.
Redis holds short-lived results and rate/budget counters. Redis must be private and
protected as it contains private post analytics. Browser responses remain no-store.

A bounded full dataset is cached by workspace, account set/status/update timestamp
and date range. Offset, page size and posts/replies selection are applied afterward,
so pagination and tab changes reuse a single result. Account/workspace access is
checked before reading Redis. Changed or disconnected accounts get a different key.
Per-account and individual-variant endpoints also use bounded shared cached reads.

Defaults (all configurable on the backend):

```dotenv
ANALYTICS_CACHE_TTL_SECONDS=300
ANALYTICS_REFRESH_COOLDOWN_SECONDS=60
ANALYTICS_MAX_PAGES_PER_ACCOUNT=5
ANALYTICS_MAX_POSTS_PER_ACCOUNT=500
ANALYTICS_MAX_READS_PER_REFRESH=100
ANALYTICS_DAILY_READ_LIMIT=1000
ANALYTICS_REFRESH_TIMEOUT_SECONDS=50
ANALYTICS_CACHE_MAX_BYTES=5000000
```

Page/post limits produce explicitly partial datasets, not complete-looking totals.
A shared Redis lease deduplicates concurrent refreshes. Manual Refresh uses
`POST /api/v1/analytics/dashboard/refresh` with the same query parameters as GET;
refreshes have a per-workspace cooldown. Failed/oversized builds never overwrite a
previous result. Redis failure returns an error rather than unlimited upstream reads.
There is no SQL or expired-cache fallback. Automated tests bypass Redis unless they
explicitly install a fake/isolated Redis connection.

`GET /api/v1/analytics/read-budget` reports the workspace's reserved HTTP reads,
limit and next midnight UTC reset. Each actual adapter HTTP attempt consumes a
shared daily reservation before sending; failed provider requests count too.
Per-platform counters have a two-day TTL. Dashboard responses expose freshness,
cache-hit status, refresh timing and daily read usage; the UI shows that usage.

These are HTTP request limits, **not a dollar-spending guarantee**. X may bill by
resources returned rather than requests. Set provider-console spending caps and tune
these limits to actual endpoint prices, account count and expected traffic. Analytics
read counters are separate from the existing X publishing spending guard.

## Storage reservations and cleanup

```dotenv
MEDIA_WORKSPACE_QUOTA_BYTES=1073741824
MEDIA_PENDING_TTL_HOURS=24
MEDIA_CLEANUP_BATCH_SIZE=100
```

The default is **1 GiB per workspace**, configurable independently of plan pricing.
No new paid-plan storage allowances are advertised. Existing over-limit workspaces
keep their files but cannot upload more until they free space or the limit increases.
`GET /api/v1/media/usage` reports used/reserved, limit and available bytes.

Both direct-upload tickets and `/media/attachments` reserve declared bytes under
the same workspace database lock. Ready files use actual bytes; unfinished/failed
uploads retain their reservation until deleted. Completion verifies actual size,
type and malware scan; signing binds the declared Content-Length. Completion and
cleanup serialize on the workspace. An expired ticket cannot be completed.
The attachment endpoint is limited to ten requests/minute; upload-ticket routes
remain thirty/minute. These inbound limits supplement storage quotas and auth.

The scheduler runs bounded cleanup hourly:

1. Old awaiting/failed/rejected uploads are removed from storage before their SQL
   reservations are deleted. Object deletion failures retain the reservation and retry.
2. One bounded `quarantine/` object-list page removes old orphaned objects without a
   SQL record (including late PUT replays). Its continuation is held in Redis.

Ready library files, draft/published attachments and assistant source files are
retained. Cleanup never sweeps the `media/` prefix. Deleting a ready file is explicit.
Pending reservations and orphan removal are eventually consistent; large abandoned
backlogs take multiple scheduler ticks. Add an R2/S3 lifecycle rule expiring old
`quarantine/` objects as a backstop, with a retention longer than the ticket lifetime.

This change does not reroute large uploads around Vercel's function body limit;
the existing signed-upload API can be used for that separate frontend upload change.

## Deploy and verify

No database migration is required. Deploy frontend and backend together; restart the
API and scheduler for new environment values. Confirm `FRONTEND_URL` uses the actual
HTTPS domain, frontend `NEXT_PUBLIC_APP_URL` matches that frontend origin, Resend's sender is verified, Redis is reachable and the scheduler runs.
Do not enable a publishing worker just to test email or analytics.

```sh
.venv/bin/pytest tests/test_team_invitations.py tests/test_analytics_cache.py tests/test_storage_costs.py
.venv/bin/pytest
```

Use an isolated PostgreSQL database named `draftva_test` through
`draftva_TEST_DATABASE_URL` to exercise simultaneous invitation acceptance and
storage reservations. Never point tests at the application database.

For a browser check, invite a separate account you control, open the email in a
signed-out window, register/sign in, verify the email and accept. Check its role and
workspace selection; then try the replaced/expired link and a different email.
For analytics, changing pages must retain fetched_at and return cache_hit=true;
manual Refresh must update fetched_at, while a second immediate refresh returns 429.
