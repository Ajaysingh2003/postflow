# Instagram Business Login and Facebook Pages OAuth

Instagram now connects directly through **API setup with Instagram login**, using the Instagram App ID and secret shown inside that product. Facebook Pages continues to use the Meta/Facebook App ID and secret from App Settings → Basic. Instagram never falls back to Facebook credentials.

## Local configuration

Set these in `backend/.env`. This repair retains the existing app IDs and secrets and adds the two explicit redirect URIs below:

```dotenv
INSTAGRAM_APP_ID=1117242190835730
INSTAGRAM_APP_SECRET=<the Instagram app secret from API setup with Instagram login>
INSTAGRAM_REDIRECT_URI=https://keenness-rename-snaking.ngrok-free.dev/api/v1/channels/instagram/callback

FACEBOOK_APP_ID=2292763138186195
FACEBOOK_APP_SECRET=<the Meta/Facebook app secret from App Settings → Basic>
FACEBOOK_REDIRECT_URI=https://keenness-rename-snaking.ngrok-free.dev/api/v1/channels/facebook/callback
```

The existing private `.env` already has both credential pairs populated. Their secrets were preserved and are not included in the patch or this document. Confirm they belong to the indicated products if Meta rejects the exchange.

Each explicit redirect setting overrides `OAUTH_REDIRECT_BASE_URL` only for its own platform. Empty/unset overrides preserve the shared callback template behavior, including support for its older `/oauth/callback` form. Explicit values are used verbatim. The two ngrok values above come from the referenced setup; if your current public hostname differs, update both values and the corresponding dashboard entries to the current hostname. Other channels retain their existing shared callback setting.

In Meta's dashboard:

1. Open **Instagram → API setup with Instagram login → Business login settings**. Register the exact `INSTAGRAM_REDIRECT_URI` under the Instagram OAuth redirect URIs and save.
2. Open **Facebook Login for Business → Settings**. Register the exact `FACEBOOK_REDIRECT_URI` under Valid OAuth Redirect URIs and save.
3. Use a Business or Creator Instagram account. For development testing, ensure the account has the required app/tester role and has accepted any invitation. For accounts outside app roles, obtain the required app review/advanced access.

Preserve scheme, hostname, path, trailing slash and any query string exactly. Registering the Instagram URI in Facebook's redirect list does not configure Instagram Login.

Restart the API, publishing worker and scheduler to reload settings and adapter instances. For the existing development Compose setup, from `backend`:

```sh
docker compose up -d --no-deps --force-recreate api worker scheduler
```

For production images, rebuild/redeploy those services with the changed backend source as well. No database migration is needed. Reconnect Instagram accounts previously authorized with Facebook Login; their Page tokens cannot become Instagram User tokens through refresh. Legacy Instagram refresh explicitly requires reauthorization.

## Request and callback flow

- `POST /api/v1/channels/instagram/connect` returns a URL starting with `https://www.instagram.com/oauth/authorize`, with the Instagram App ID, state, exact callback, `response_type=code`, `enable_fb_login=0` and `force_authentication=1`.
- Default scopes are `instagram_business_basic`, `instagram_business_content_publish`, and `instagram_business_manage_insights` (the backend already has analytics features). `options.manage_replies=true` also requests `instagram_business_manage_comments`. Custom scopes must use the supported Instagram Login permissions; unsupported and legacy Facebook-login scopes are rejected. The basic permission is always included.
- The callback consumes the saved, short-lived OAuth state, rechecks workspace membership and sends a form-encoded POST to `https://api.instagram.com/oauth/access_token`, using `grant_type=authorization_code`, the Instagram ID/secret, code and **the URI saved at connect time**.
- A GET to `https://graph.instagram.com/access_token` exchanges that token using `grant_type=ig_exchange_token` and the Instagram secret. A failed upgrade creates no connected account.
- The profile is fetched from `https://graph.instagram.com/{GRAPH_API_VERSION}/me`. The professional `user_id` takes precedence over the app-scoped `id`. One authorized account becomes one connection/target; no Facebook Page discovery is required.
- The long-lived Instagram User token is encrypted, with the returned expiry. Permissions returned by the code exchange are stored when available; otherwise the saved requested scopes are used. The account metadata contains no plaintext tokens or Page-token cache.
- Browser GET callbacks return to `/dashboard/channels?connected=instagram`; API POST/JSON callbacks return the connection. Reconnect updates the same account; consumed states cannot be replayed.
- Refresh uses `https://graph.instagram.com/refresh_access_token` with `grant_type=ig_refresh_token`. Provider authorization failures mark the account `needs_reauth`; rate limits and server failures remain eligible for retry. Instagram publishing, metrics, revocation and comment operations use the Instagram Graph host.

Facebook's authorization dialog, Facebook token exchange, Page discovery and Page tokens remain in its separate adapter.

## Verification and limits

Automated tests use mocked provider HTTP, an isolated temporary SQLite database, and the actual connect/callback routes. They cover credential separation, both authorization URLs, form encoding, exact saved redirects even if config changes mid-login, flat/wrapped Instagram token responses, account IDs, Creator profiles, encryption, targets, reconnect, cross-platform state rejection, replay, failed exchanges, refresh, revocation, and comment permissions/host. Existing Instagram publishing tests and Facebook tests also run.

A live Instagram login and provider approval remain unverified; completing them requires the authorized account's browser consent. Meta documentation fetches in this session returned login-required/rate-limit responses, so this is not a claim of full current-documentation verification. Live acceptance should include token exchange, target visibility, publishing, and insights against the configured API version; the existing insight metric names were not redesigned by this OAuth repair.

Official references: [Meta Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/), [Meta's Instagram Login API collection](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).
