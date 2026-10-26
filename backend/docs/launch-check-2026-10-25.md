# Backend launch check — 25 October 2026

**Decision: prepare the server, but do not launch with the current environment unchanged.** The application checks pass; the effective production Compose environment still has eight blocking preflight findings. Configuration presence does not verify live credentials, provider approvals or delivery.

Scope: current backend at Git revision `1a2906d`, including the actual local `.env` and the merged production Compose configuration. Existing frontend edits were left alone. Only this report was added; no application code, credentials, data, migrations or production services were changed.

## Verified

| Check | Result |
| --- | --- |
| Ruff (`app`, `tests`, `scripts`) | Pass |
| Complete local backend suite | 741 passed, 12 skipped, no failures (753 collected) |
| Explicit production deployment / real Nginx integration suite | 33 passed, no skips or failures |
| Dependency compatibility (`pip check`) | Pass; this is not a vulnerability scan |
| Fresh PostgreSQL 16 migration chain | All 11 revisions applied to `20261024_paid_ai_allowances` on a disposable database |
| ORM versus migrated PostgreSQL schema | Zero differences, 39 model tables |
| Production Python runtime migration smoke check | Pass on Python 3.13.17 using the cached runtime image with current source mounted read-only |
| PostgreSQL credit / operator / invitation / allowance tests | 46 passed against a separate disposable `draftva_test` database |
| AI operator SQL function | Installed as `draftva_adjust_ai_credits(text,text,integer,text,text)` |
| Effective Compose port exposure | Nginx alone publishes 80/443; API, PostgreSQL, Redis and scanner have no published host ports |
| Effective application containers | Production mode, read-only filesystems, no development source bind mounts |
| TLS/proxy behavior | Real disposable Nginx tests passed for TLS configuration, HTTP redirects/ACME, unknown hosts, preserved webhook bytes/signatures, replaced spoofed forwarding headers, upload limits, streaming and upstream container replacement |
| Tracked private environment/key material in backend | Actual `.env` is not tracked; only `.env.example` is tracked among the checked env/key patterns |

Tests used temporary SQLite files, disposable PostgreSQL containers and isolated Nginx/echo containers. Existing application databases were not migrated, reset or read. Disposable resources were cleaned up. The cached `backend-test` image was too old for current dependencies, so PostgreSQL feature tests used the current local test environment instead; that old image is not a valid release artifact.

A Starlette TestClient/httpx deprecation warning remains. It did not fail tests. A newly built production image and live server/provider smoke tests are still required.

## Blocking production configuration

The raw `.env` declares production but points at SQLite, so direct process startup fails validation. The **production Compose wrapper overrides DATABASE_URL to PostgreSQL and supplies the correct API forwarded-header trust**. Those two raw-file findings are not counted as unresolved effective-container failures below. Use `scripts/compose-prod.sh`, not the development Compose configuration or a direct launch with the current file.

After applying those real Compose overrides, the eight failures are:

| Preflight finding | Required server configuration |
| --- | --- |
| `TOKEN_ENCRYPTION_KEY` | Configure a valid dedicated Fernet key. Keep it durable across deploys. If accounts already use an existing encryption key, preserve/migrate deliberately rather than replacing it blindly. |
| `PUBLIC_BACKEND_URL` | `https://api.draftva.com` |
| `CALLBACK_X` | `https://api.draftva.com/api/v1/channels/x/callback` |
| `CALLBACK_LINKEDIN` | `https://api.draftva.com/api/v1/channels/linkedin/callback` |
| `CALLBACK_FACEBOOK` | `https://api.draftva.com/api/v1/channels/facebook/callback` |
| `CALLBACK_INSTAGRAM` | `https://api.draftva.com/api/v1/channels/instagram/callback` |
| `CALLBACK_THREADS` | `https://api.draftva.com/api/v1/channels/threads/callback` |
| `BLUESKY_CLIENT_ID` | Use `https://api.draftva.com/api/v1/channels/bluesky/client-metadata` and a durable signing key, or keep this integration unavailable until configured. |

Set the generic callback template to:

```dotenv
OAUTH_REDIRECT_BASE_URL=https://api.draftva.com/api/v1/channels/{platform}/callback
```

Facebook, Instagram and Threads also support explicit redirect overrides: update their `*_REDIRECT_URI` values because they take precedence over the template. Register the exact final URLs in the providers' developer consoles. X **sign-in** remains separate: `https://draftva.com/api/auth/x/callback`.

Reddit credentials are absent (warning). Do not offer that connection as ready until its credentials and approvals are complete. Offline checks do not prove approval for any configured channel.

## Other changes needed before opening access

1. **Update the Requests dependency and retest the release image.** `requirements.txt:13` pins `requests==2.32.3`; `pyproject.toml` also permits it. The Requests maintainers identify versions below 2.32.4 as affected by CVE-2024-47081, involving `.netrc` credential leakage with crafted URLs. Use a current compatible patched version and tighten the lower bound. This audit did not demonstrate exploitation in Draftva or modify dependencies. [Maintainer advisory](https://github.com/psf/requests/security/advisories/GHSA-9hjg-9r4m-mvj7).
2. **Make the server `.env` private.** The inspected local file has mode 0644. Use `chmod 600 .env` for the server's secrets file; no credential exposure is asserted by this permissions finding. The initializer already creates new files with 0600 and refuses to overwrite existing keys.
3. **Keep frontend/server configuration aligned.** The frontend needs `BASE_API=https://api.draftva.com`, `NEXT_PUBLIC_APP_URL=https://draftva.com` and the same server-only `AUTH_PROXY_SECRET`. Verify the production visitor-IP relay setting and redeploy after changes.
4. **Complete live checks on the actual VM.** No SSH host/server was supplied, so cloud firewall rules, DNS, certificates/renewal, R2 CORS/scanning, provider approval, actual OTP delivery, signed Dodo activation, worker scheduling, monitoring and off-VM backups/restore remain unverified. A paid live checkout requires the operator to complete payment deliberately.

## Server deployment gate

Follow [production-deployment.md](production-deployment.md) in order. On the server, use `.env` with the production template's values, preserving any existing durable keys.

```sh
# From backend/; do not print full Compose config containing credentials.
chmod 600 .env
sh scripts/compose-prod.sh config --quiet
sh scripts/compose-prod.sh build
sh scripts/compose-prod.sh run --rm --no-deps migrate python -m app.core.production
```

Proceed with the runbook's HTTPS bootstrap and migrations only after the preflight returns **PASS** and all warnings have a clear launch decision. PostgreSQL data and internal ports should remain private. Do not run `down -v` or reset existing databases.

After deployment, `/health` confirms liveness; `/ready` checks database and Redis availability. Separately confirm worker/scheduler operation and test OTP, a controlled scheduled post with media, AI deduction, invitation acceptance and Dodo activation before opening paid signups. No public launch, cloud provisioning, payment or external publishing was performed by this audit.
