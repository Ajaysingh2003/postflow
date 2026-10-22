# Google and X sign-in

Both login and registration show Google and X. Without credentials, each provider
has a visible disabled button and email login remains available. With credentials,
the same flow signs in returning users or creates a user, workspace and owner
membership for new users. Login does not connect a publishing channel or grant
publishing access.

## X setup

In the X Developer Console, enable OAuth 2.0, choose **Web App** (confidential
client), and allow the `users.email` scope. If the console presents a **Request
email from users** option, enable it. Complete the app's required
website/privacy-policy/terms fields. Register this exact callback URL for the
environment:

```text
http://localhost:3000/api/auth/x/callback
```

For production, replace localhost with your HTTPS frontend origin. The callback is
a frontend server route, not `/api/v1/channels/x/callback` (that other route is for
connecting a publishing account).

Add only backend environment values:

```dotenv
X_LOGIN_CLIENT_ID=<OAuth 2.0 Client ID>
X_LOGIN_CLIENT_SECRET=<OAuth 2.0 Client Secret>
FRONTEND_URL=https://<your frontend origin>
# Optional: defaults to FRONTEND_URL/api/auth/x/callback
X_LOGIN_REDIRECT_URI=https://<your frontend origin>/api/auth/x/callback
```

Use `FRONTEND_URL=http://localhost:3000` in development. Empty `X_LOGIN_REDIRECT_URI`
uses that default. These are OAuth 2.0 Client ID/Client Secret credentials, not
OAuth 1.0 consumer API Key/API Key Secret, an app-only Bearer Token or a personal
access token. Existing `X_CLIENT_ID`/`X_CLIENT_SECRET` remain for publishing.
An X app can be reused if both distinct callback URLs are registered; using a
separate login app makes permission management clearer. Never expose secrets with
`NEXT_PUBLIC_` variables.

When login and publishing deliberately share the same OAuth 2.0 Client ID,
`X_LOGIN_CLIENT_SECRET` and `X_CLIENT_SECRET` must be the same current secret for
that app. A different or stale publishing secret can produce X's
`unauthorized_client` / `Missing valid authorization header` error even when
Draftva sends Basic authentication. Use the OAuth 2.0 Client Secret, not the OAuth
1.0 API Key Secret or a Bearer Token. Recreate the API container after changing
the environment; recreate workers/scheduler when applying the same correction to
background token refresh. Restart authorization rather than reusing a failed callback.

If another project occupies port 3000 and Draftva runs on 3001, set
`FRONTEND_URL=http://localhost:3001`, use
`http://localhost:3001/api/auth/x/callback` for `X_LOGIN_REDIRECT_URI` and register
that exact URL in X. Use the same hostname when opening Draftva; localhost and
127.0.0.1 do not share the browser-bound login cookie. Login configuration rejects
publishing callback paths, and the frontend rejects a callback on a different origin.

Compose reads environment values when creating a container. After changing `.env`,
recreate the API with `docker compose up -d --no-deps --force-recreate api`;
`docker restart` alone retains the old container environment. Existing failed
OAuth URLs cannot be reused: start a new login after updating the configuration.

Requested scopes: `tweet.read users.read users.email`. The flow uses S256 PKCE,
10-minute state records and an HTTP-only, SameSite=Lax browser cookie. The verifier
is encrypted in the database. State must match both the browser and the backend
record; atomic consumption prevents callback replay. Authorization codes and
ephemeral X access tokens remain on the server; only the existing Draftva session
cookie is installed. No write/offline scope or retained X token is used for login.

The backend reads `/2/users/me?user.fields=confirmed_email,name,username` and binds
accounts to X's stable user ID. New identities require X's `confirmed_email`; no
synthetic email is invented. If X does not share it, the page offers email/Google
sign-in. Returning bound identities retain their original Draftva user/workspace.
Matching confirmed emails reuse existing users. Recovering a pre-created
unverified account revokes its old password and sessions. Disabled users cannot
sign in. User-supplied names/usernames are never used as account identifiers.

X access/credits must permit the user lookup endpoint. X's current pricing is
pay-per-usage; budget for profile reads and check your console's current endpoint
price. This login path is protected by auth rate limits but is not charged against
a workspace's publishing spending allowance.

Cancellation, expired state, missing email and provider failures redirect back to
the login/register page with a fixed, safe message. Raw provider errors, credentials
and session tokens never appear in redirect URLs. A user must restart after an
unsuccessful exchange because state is single-use.

## Google setup

Create a Google OAuth **Web application** client and add exact Authorized
JavaScript Origins such as `http://localhost:3000` and your production HTTPS
origin. Set backend `GOOGLE_CLIENT_ID` to its public Client ID. The official Google
Identity Services button supplies an ID token verified on the backend for that
audience and a verified email. This flow does not require a Google client secret or
an authorization-code callback. Email sign-in remains usable if the SDK is blocked
or fails to load.

## Activate and verify

From `backend/`, apply the additive migration and reload services after editing env:

```sh
docker compose exec -T api alembic upgrade head
docker compose up -d --no-deps --force-recreate api worker scheduler
.venv/bin/pytest tests/test_social_login.py tests/test_auth_production.py
```

From `fronted/`:

```sh
bun test
bun tests/support/check-social-login-routes.js
bun x tsc --noEmit
bun run build
```

Provider flags are cached on the client for up to five minutes; reload the auth page
after enabling a provider. Automated checks mock official X token/profile HTTP
calls and cover state/browser binding, PKCE, replay/expiry, user reuse, recovery,
missing email, disabled users, malformed/provider failures, cookie flags and safe
redirects. A live X/Google consent test still requires configured credentials and
console settings; automated passing tests cannot confirm an unconfigured app's
provider approval or credit balance.

Official references:

- [X OAuth 2.0 and scopes](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X authenticated user lookup and confirmed_email](https://docs.x.com/x-api/users/get-my-user)
- [X pricing and credits](https://docs.x.com/x-api/getting-started/pricing)
- [Google Identity Services JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
