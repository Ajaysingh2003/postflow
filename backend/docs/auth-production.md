# Draftva authentication

## Delivery and verification

Draftva generates six-digit email codes and sends them directly through Resend. The
Cloudflare OTP worker is not used. Codes are bound to a user and challenge, stored as
HMAC digests using `APP_SECRET`, and consumed once. Never log codes, passwords,
bearer tokens or email-link tokens.

Defaults: codes expire after 10 minutes; five incorrect attempts invalidate a code;
resends have a 60-second cooldown; verification and recovery each allow at most five
delivery requests per hour and ten per rolling day per account. These records live
in PostgreSQL, so restarting the app does not reset the allowances. Failed delivery
also counts toward the allowance, but leaves an earlier valid code/link usable.
A successful resend replaces earlier codes/links.

Unverified accounts can sign in to finish verification, correct a mistyped pending
email, and sign out. Workspace actions and agent access require verification.
Previously issued long verification links remain supported without truncation.
Existing users are not automatically marked verified by the migration.

Password recovery uses a separate, random, single-use 20-minute link. Completing
recovery verifies email ownership, replaces the password and revokes all sessions,
other reset links and pending OTPs. New passwords must contain 10–200 characters;
the frontend also checks confirmation. Google-only accounts can establish a
password through this verified recovery flow.

Public resend/recovery responses are deliberately identical for unknown, disabled
and eligible accounts. Delivery runs in a FastAPI background task after the generic
response. These tasks are not a durable email queue: a process crash may lose an
unsent request, and a generic response does not prove delivery. Users can retry
after the cooldown. Authenticated OTP requests report actual provider acceptance.

## Configuration

Backend, server only:

```dotenv
RESEND_API_KEY=<private Resend API key>
RESEND_FROM_EMAIL=Draftva <noreply@draftva.com>
EMAIL_VERIFICATION_REQUIRED=true
OTP_TTL_SECONDS=600
OTP_RESEND_SECONDS=60
OTP_MAX_ATTEMPTS=5
AUTH_PROXY_SECRET=<random shared server secret>
FRONTEND_URL=https://<your actual frontend origin>
```

The sender domain must be verified in Resend. SMTP with verified TLS remains a
fallback when no Resend key is configured. Development/production do not pretend
to send email when neither provider is configured. Use `APP_ENV=development` with
HTTP localhost. Production rejects HTTP frontend links, disabled verification,
disabled rate limiting, weak app secrets and mock AI.

Frontend server only:

```dotenv
BASE_API=https://<your backend origin>
AUTH_PROXY_SECRET=<same shared server secret>
AUTH_CLIENT_IP_HEADER=<header your trusted proxy overwrites>
```

Never use `NEXT_PUBLIC_` for keys or the proxy secret. Configure the edge proxy to
strip/overwrite the chosen IP header, and restrict direct access to the frontend
origin. The frontend signs the visitor IP and timestamp; the backend accepts only
fresh, authenticated signatures. Unsigned calls use the transport client address.
The proxy secret alone does not make an untrusted forwarded header safe.
Uvicorn trusts no forwarded headers by default. Set `FORWARDED_ALLOW_IPS` to only
the actual backend proxy IPs/CIDRs, never `*` for a publicly reachable origin.
The production Compose override defaults to trusting localhost only.

Redis provides atomic shared request limits: login 20/minute per IP and 10/15
minutes per email; registration 10/15 minutes per IP; email routes 12/minute per
IP; public resend/recovery five/hour per email. Additional auth request limits and
the persistent per-account send allowances apply. Production fails closed when
the limiter is unavailable. Responses include retry timing on rate-limit errors.

Sessions are random opaque tokens hashed in the database. Browser bearer tokens
stay in HTTP-only cookies (Secure in production, SameSite=Lax); browser auth
responses contain identity metadata rather than tokens. Session checks report
actual remaining database expiry rather than extending sessions indefinitely.
Transient failures preserve valid local sessions and offer a retry state. Browser
mutations reject foreign Origin/cross-site Fetch Metadata; redirects stay local.

Google sign-in uses the official Google Identity Services SDK and server-side ID
token verification. Set backend `GOOGLE_CLIENT_ID` and the exact frontend origins
in Google Cloud. Until configured, social buttons are visible but disabled. X uses
its own official OAuth 2.0 sign-in flow; see [social sign-in setup](social-sign-in.md).
A verified Google identity recovering a pre-created unverified
email account removes the old password credential and revokes its earlier sessions.

## Database and checks

The additive migration `20261014_email_otp` adds only OTP digest, attempt count and
sent timestamp columns. It retains existing users, sessions and migration history.

From `backend/`:

```sh
docker compose exec -T api alembic upgrade head
docker compose up -d --no-deps --force-recreate api worker scheduler
.venv/bin/ruff check app tests migrations
.venv/bin/pytest
```

Container recreation reloads changed environment variables; a restart alone does
not. In deployment, run the migration job before new application processes start.
Keep Redis, the database and email provider monitored. Configure HTTPS, exact CORS
origins and the trusted edge IP contract before exposing production.

From `fronted/`:

```sh
bun test
bun x tsc --noEmit
bun run build
```

Regression coverage includes expiry/replay, failed delivery, resend/guess limits,
email correction and changes during delivery, account enumeration responses,
password/session revocation, Google verified-email recovery, spoofed IP headers,
Redis failure, safe redirects and reset-link query handling. Live verification was
also exercised with a Resend-delivered code in the local browser. Google consent
and production infrastructure still require checks in their deployed environment.

Provider reference: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).
