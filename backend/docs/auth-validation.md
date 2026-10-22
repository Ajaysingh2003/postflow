# Auth validation and error handling

The FastAPI identity endpoints enforce credentials, account activity, verified email, token
expiry, single use and send/guess limits. The Next.js server validates authentication
responses at runtime before setting cookies or returning success to a form. A successful
HTTP status with an incomplete or inconsistent payload is an error, not a signed-in session.
Verification and password reset additionally require their explicit completed outcome.

## Email semantics

- Registration creates an account and session separately from email delivery. When sending
  fails, `verification_required` remains true, `verification_sent` is false and
  `verification_error` explains that a new code is needed. The verification page also reads
  the delivery status after navigation, so a failed send remains visible.
- Authenticated code requests report actual provider acceptance (`delivery_status: sent`)
  or an error. Provider acceptance does not guarantee inbox delivery.
- Correcting an unverified address can save the address even if sending fails. The response
  explicitly reports the saved `email` and `delivery_status: failed`; the UI shows an error
  and allows another request after the server cooldown.
- Public resend/recovery endpoints return `outcome: accepted` and `delivery_status: accepted`,
  with the same response for eligible, missing, disabled and already verified accounts.
  They acknowledge a request, never claim that an email was sent. A globally unconfigured
  email service returns 503 before looking up an account. Background delivery failures
  produce a sanitized operational warning, without addresses, tokens or provider bodies.
  This preserves account privacy and uniform initial response timing, following
  [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
- Public email delivery currently uses FastAPI background tasks, not a durable outbox. Monitor
  `Transactional email request failed` warnings and provider delivery events. Automatic
  recovery across process crashes requires a durable email queue/outbox; an accepted
  response is deliberately not a guarantee of delivery.

A failed resend leaves the earlier delivered code usable. Verification status selects an
unconsumed delivered challenge rather than hiding it behind a failed attempt. Expired or
consumed codes never gain extra lifetime. Failed sends still count against send limits.

## Client failures

Sign-in and registration display persistent inline errors. Codes, reset-link tokens, email
addresses and passwords are bounded and validated on the client and server. Pending actions
are guarded against repeated submissions. Ordinary network/validation errors do not invent
a 60-second cooldown; `Retry-After` controls a server throttle, with a rate-limit-only fallback.
Raw infrastructure errors and provider payloads are not shown to users.

`user.me` requires authentication; `user.profile` is the optional lookup. Expired profile
cache entries are never used as a fallback after a forbidden, malformed or unavailable
session response. The existing 60-second profile cache is a UI optimization; every protected
backend endpoint remains responsible for checking current sessions and authorization.
Failed logout-all operations retain the local session so the user can retry; the UI cannot
claim all sessions were revoked unless the backend confirms the operation.

## Verification

Run from `backend/`:

```sh
.venv/bin/python -m ruff check app/modules/identity tests/test_auth_production.py
.venv/bin/python -m pytest
```

Run from `fronted/`:

```sh
bun test
bun tests/support/check-social-login-routes.js
bunx tsc --noEmit
```

Tests use an isolated database and mocked email delivery/Google requests. They cover wrong
credentials, blank names, malformed successful responses, cookie safety, explicit completed
outcomes, account privacy, delivery failure, code replacement, expiry, single use, cooldowns,
Google transport failure and rejected session checks. No real OTP emails are sent by tests.
For an isolated local browser session, use `http://127.0.0.1:3001`; that exact loopback
host is allowed by the Next.js development configuration. Production origins are unchanged.

Deploy the backend response contract before the frontend that validates its `outcome` field.
