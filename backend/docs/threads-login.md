# Threads HTTPS login

## Production token-exchange troubleshooting

Use these environment variable names in the backend's private `.env`:

```dotenv
THREADS_APP_ID=<Threads App ID>
THREADS_APP_SECRET=<Threads App Secret from the same app>
THREADS_REDIRECT_URI=https://api.draftva.com/api/v1/channels/threads/callback
```

Register that exact production callback in the app's Threads settings. Threads has
its own credential pair; do not substitute the Facebook/Instagram app secret.
Rebuild and recreate the running API/worker services after deploying these changes
and updating `.env`, using the same Compose project that runs the existing API and
database. A container restart alone does not reload Compose environment values.

An HTTP 400 at `GET /access_token` with `grant_type=th_exchange_token` means the
authorization-code exchange has already succeeded, but Meta rejected the exchange
of the short-lived token for a long-lived token. This is a provider response, not a
frontend CORS or HTTPS reachability failure. The HTTP status alone does not identify
the underlying reason. Do not bypass the failed exchange by saving the short-lived
token or replaying the consumed authorization code.

The adapter now returns only the operation, HTTP status, numeric Meta error code
and numeric error subcode. It never returns the raw provider body or credential-bearing
URL. Backend warnings use the same safe diagnostics, for example:

```text
Threads OAuth rejected operation=long-lived token exchange http_status=400 code=190 subcode=None
```

The example code is illustrative, not the code from the reported production failure.
Code 190 is treated as a rejected token; retry authorization with a fresh connection.
For other client errors, verify the matching Threads credentials and app access in
Meta. Rate limits and provider outages return separate retry messages. Successful
responses must contain a token and valid expiry; a failed refresh does not overwrite
the stored token. Invalid profiles are also rejected before saving an account.

Unexpected adapter exceptions no longer appear in browser redirect URLs, and HTTP
logging redacts OAuth callback `code` and `state` query values as well as token and
secret parameters. If an older error already exposed a secret or token, rotate the
app secret in Meta, revoke the exposed token, update the server environment, and start
a fresh connection. Do not paste a token-exchange URL into a browser or support chat.

Run the regression tests without production credentials:

```sh
cd backend
.venv/bin/ruff check .
.venv/bin/python -m pytest
```

The token request contract follows [Meta's official Threads API collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api).
Tests use mocked HTTP; a real connection after deployment is still required to
confirm which error Meta returns for the production app.

## Original local HTTPS callback setup

Threads OAuth requires an HTTPS callback with a non-localhost hostname, including in development. The prior shared local callback (`http://localhost:18000/api/v1/channels/threads/callback`) caused Meta error 1349187, “Insecure login blocked.” Facebook and Instagram already used separate public HTTPS callbacks; Threads had no equivalent override.

Set `THREADS_REDIRECT_URI` in `backend/.env` to the exact URI registered in the Threads API's Valid OAuth Redirect URIs. The existing local HTTPS tunnel was verified against `/health` and is configured as:

```dotenv
THREADS_REDIRECT_URI=https://keenness-rename-snaking.ngrok-free.dev/api/v1/channels/threads/callback
```

The user confirmed this exact callback is registered in Meta. If the tunnel hostname changes, update both this setting and the Threads app registration. Use the Threads App ID and Threads App Secret, as specified by Meta's sample, rather than another login product's credentials.

The setting overrides the shared template only for Threads. Auth URL creation honors the redirect supplied by the connection router, and token exchange honors the exact URI saved with the OAuth state at login start. Configuration changes during a login therefore do not change that login's token-exchange URI. Scheme, path, trailing slash and query encoding are preserved. The existing workspace-bound state verification and replay protection still apply.

The Threads adapter now rejects HTTP, localhost/loopback, credential-bearing, malformed and fragment-containing callback URLs with an actionable 422 before sending requests to Meta. It does not substitute `https` for a local HTTP server or weaken Meta's HTTPS requirements. After updating environment settings, recreate the API container to load the new environment; a plain container restart does not reload Compose `env_file` values.

```sh
docker compose -f backend/compose.yaml up -d --no-deps --force-recreate api
cd backend
.venv/bin/ruff check .
.venv/bin/python -m pytest
```

Tests in `tests/test_threads_login.py` exercise separate callback configuration, exact URI encoding, rejection of invalid callbacks, router override rejection, state reuse prevention, encrypted token storage, and the full mocked connection/token-exchange flow with configuration changes mid-login. `tests/test_backend_reliability.py` uses an HTTPS callback for its existing Threads flow test. No frontend changes, database changes or secret changes are required.

Verification: Ruff passed; the full backend suite passed 314 tests with one Redis-dependent test skipped. The local API was recreated to reload the environment, and the public HTTPS `/health` endpoint returned `{"status":"ok"}`. Actual configuration generates an authorization URL containing the registered HTTPS callback. A real Meta consent/token exchange still requires the user to retry Connect after this update; the automated exchange was verified with mocked HTTP.

Official references:

- [Meta Threads sample: non-localhost HTTPS callback requirements and Threads credentials](https://github.com/fbsamples/threads_api/blob/main/README.md)
- [Meta's Threads token exchange: the redirect must match the authorization request](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api)
