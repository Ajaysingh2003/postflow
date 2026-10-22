# Short onboarding

The `/onboarding` page has two optional steps: a welcome and channel connections.
There is no questionnaire. Finishing or skipping calls `POST /api/v1/auth/onboarding/complete`.
This idempotently sets `users.onboarding_completed_at` and never requires a social account.
`GET /api/v1/auth/onboarding` returns durable completion and the active workspace's
channel administration permission. Verified members can finish, but only owners and
admins can connect accounts. Existing connection quotas still apply.

Deploy the additive `20261018_onboarding` migration before the updated API/frontend:

```sh
python -m alembic upgrade head
```

The migration marks existing users complete; new users start with a null timestamp.
New users visiting Home are routed to onboarding after email verification. Explicit
deep links such as invitation acceptance continue to work. Completion is confirmed
against the database before redirecting an apparently incomplete cached profile.

The last step reuses the Channels configuration and artwork, excluding coming-soon
channels. Accounts are fetched on the server and hydrated into `useSuspenseQuery`.
The screen includes a skeleton, retries, a skip action, real connection state and
the existing Bluesky handle prompt. It never treats a callback query flag as proof
of a connected account.

Channel connect requests can specify `return_to: "/onboarding?step=connect"`.
The only other permitted value is `/dashboard/channels`, the existing default.
This value is merged into encrypted OAuth state after provider setup, preserving
PKCE, requested scopes and provider metadata. The official callback URI is unchanged.
Successful and cancelled browser callbacks return to this destination. Expired,
unknown and replayed challenges fall back to Channels. Cancellation consumes state.

Verify with `pytest tests/test_onboarding.py tests/test_channels_framework.py` and,
from `fronted/`, `bun test tests/onboarding.test.jsx tests/channel-api.test.js`.
For a manual check, register and verify a new test account, open Home, move to
connections, cancel a provider login, and skip. Revisiting Home or signing in again
should not repeat onboarding. Test an invited viewer too: they can continue but
are not offered channel administration actions.
