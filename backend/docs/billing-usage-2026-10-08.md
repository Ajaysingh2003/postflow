# Workspace usage

Updated 14 October 2026: paid plans include unlimited scheduled and immediate posts. Free workspaces retain five posts per monthly window. AI and connected-account allowances remain unchanged. AI credits are shared by workspace members; one successful assistant request uses one credit, regardless of token count. Provider tokens and estimated expense are recorded separately in the usage ledger, including provider expense incurred by failed requests.

## Accounting

- Only successful runs and current in-flight reservations consume the allowance. Failed and cancelled attempts remain in the audit history and release their credit. Reservations left by crashed requests expire after 30 minutes; provider requests have a 60-second HTTP timeout.
- Usage windows recur monthly from the subscription billing start, including annual subscriptions. Month-end dates are clamped independently from the original anchor, so February cannot shift March's reset date. Free workspaces use calendar months. Dates are displayed in UTC.
- On Free, one parent post consumes one post slot in its publication month across its channel variants. Scheduling checks the target month's allowance, including when moving an already scheduled post. Eligible paid subscriptions, including trials, grace periods, and cancelled subscriptions with remaining access, have no post-count cap. Usage is still counted for reporting. Independent publication jobs and failure isolation remain intact.
- Active accounts and accounts needing reauthorization occupy connection slots; disabled accounts do not.
- Expired, revoked, failed, and unrecognized subscriptions revert to Free and cannot retain stale unlimited plan grants. Paid post limits resolve to `null` even when old plan rows or entitlement grants contain finite caps. This applies immediately without a database migration or billing renewal; newly synchronized post grants are also `null`. Manual overrides for other capabilities retain their behavior. Missing configured limits inherit the plan defaults; explicit `null` remains unlimited.

## API and views

`GET /api/v1/billing/usage` returns the effective plan allowance, used and remaining counts, monthly window bounds, subscription state, and whether the member may manage billing. Workspace membership is required. Billing management remains restricted to owner, admin and billing roles. Responses are private and not cached.

Home includes the same usage summary in its existing server preload. Its four summary cards include connected accounts, with a separate AI usage meter. Home remains bounded at twelve data queries, including usage, and does not call social APIs. Billing also uses server preloading, hydrated suspense queries, matching skeletons and recoverable errors.

Both composer assistants display the allowance and an exhausted-credit message with the reset date and a link to Billing. New generation is blocked while exhausted or while usage cannot be verified; editing and publishing remain available subject to their own permissions and quotas. Usage refreshes after requests and periodically while visible. Pricing features use the backend's configured allowances rather than video-service placeholder copy.

There is no paid overage, daily credit allowance, or credit rollover. Unlimited posts removes Draftva's paid-plan post-count quota; platform rate limits, permissions, and the existing X provider-spending guard continue to apply. X's developer API balance is separate from draftva AI credits; this change does not purchase or grant platform API credits.

## Verification

Run `backend/.venv/bin/ruff check backend/app backend/tests` and, from `backend/`, `.venv/bin/pytest`. From `fronted/`, run `bun test`, `bunx tsc --noEmit`, and ESLint on the changed frontend files. Tests cover monthly boundaries, leap years, refunds with expense auditing, concurrent reservations, crashed reservations, multi-channel post accounting, rescheduling limits, workspace privacy, billing roles, actual subscription states, exhausted/unlimited allowance states and rendered Home cards.
