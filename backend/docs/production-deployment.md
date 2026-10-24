# Production deployment: api.draftva.com

This runbook deploys the FastAPI backend on one Linux VM, on either AWS EC2 or
Google Compute Engine. The Next.js frontend remains at `https://draftva.com`
(for example, on Vercel). It does not provision a cloud account, VM or DNS record.
Nginx request diagnostics use status codes and request IDs in access logs; ordinary
upstream error messages are suppressed because they can include sensitive queries.

No production database is reset. Keep existing databases, encryption keys and backups.

## Architecture and prerequisites

Only Nginx publishes host ports 80 and 443. The API, PostgreSQL, Redis and ClamAV
have no published host ports. Worker and scheduler use the same built application
image without development source mounts. Nginx uses a separate Docker network and
a reserved IP, and Uvicorn trusts forwarded headers only from that exact IP.
The proxy does not log query strings, cache API responses, retry mutations or
buffer assistant/MCP response streams. Request bodies and webhook signature
headers are forwarded unchanged.

Use an Ubuntu 24.04 or 26.04 LTS VM with Docker Engine and Compose **2.24.4 or newer**.
Follow the [official Docker Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/).
This stack includes ClamAV and PostgreSQL; allow at least **8 GiB RAM**, persistent
SSD storage and room for image layers, database growth, scans and backups. Choose
actual VM sizing after measuring your workload. No cloud resources have been purchased.

Reserve a static public IP (Elastic IP on AWS or a static external IP on GCP).
Create the DNS A record `api.draftva.com` pointing to it. Add an AAAA record only
if IPv6 really reaches this VM. Initially use DNS-only if the domain is on
Cloudflare; no challenge page, bot protection or login may intercept webhooks.
If CAA records restrict issuers, allow Let's Encrypt.

Allow inbound TCP 80 and 443 from the internet in the AWS security group or GCP
firewall. Restrict SSH to your administration IP or the cloud's managed access
path. Do not open 8000, 5432, 6379 or 3310. Docker published ports can bypass UFW;
the cloud firewall and absence of published internal ports are intentional.

Clone the repository at `/opt/draftva`, so this backend is `/opt/draftva/backend`.
If you use another path, update the supplied systemd service before installation.
Check that `172.29.250.0/28` does not overlap your VPC, VPN or another Docker network.
If necessary, change `PROXY_NETWORK_SUBNET`, `PROXY_NETWORK_DYNAMIC_RANGE`, `NGINX_PROXY_IP` and
`FORWARDED_ALLOW_IPS` together in the production environment. Keep the Nginx IP
outside the dynamic range; otherwise the API could take its address at startup.

## 1. Configure the server environment

From `backend/` on the server:

```sh
python3 scripts/init-production-env.py
```

On a fresh server without an environment file, this creates `.env` with mode 0600 and fresh application, PostgreSQL,
proxy-signing and token-encryption secrets. It prints no secret values and refuses
to overwrite an existing file. If `.env` already exists, edit it instead and retain its current
keys/passwords; generating new encryption keys makes stored OAuth tokens unreadable.
Complete the remaining values using `deploy/production.env.example` as the reference.
Never commit `.env` or paste its contents into logs or chat. The server's `.env` must
contain production settings and live credentials; your local development `.env` stays local.

Important values already have the correct production URLs:

```dotenv
APP_ENV=production
FRONTEND_URL=https://draftva.com
PUBLIC_BACKEND_URL=https://api.draftva.com
CORS_ORIGINS=https://draftva.com
OAUTH_REDIRECT_BASE_URL=https://api.draftva.com/api/v1/channels/{platform}/callback
X_LOGIN_REDIRECT_URI=https://draftva.com/api/auth/x/callback
DODO_API_BASE=https://live.dodopayments.com
DODO_RETURN_URL=https://draftva.com/settings/billing
```

Fill the **live** Dodo API key, live webhook signing secret and live Starter, Pro
and Business product IDs. Test-mode products/keys are not interchangeable with live
ones. Fill Resend and a verified sender address, real LLM provider/model, R2 bucket
and credentials, and each social app you intend to offer. A credential being present
does not prove that the provider has approved its permissions.

The base `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_PRO` and `DODO_PRODUCT_BUSINESS`
variables select monthly products. Quarterly and annual pricing cards use separate
`DODO_PRODUCT_<PLAN>_QUARTERLY` and `DODO_PRODUCT_<PLAN>_ANNUALLY` variables. Configure
their recurring intervals and prices in Dodo; an unconfigured cycle cannot fall
back to a monthly checkout. See [checkout and X recovery](checkout-and-x-refresh.md).

The frontend hosting environment needs these values, followed by a redeploy:

```dotenv
BASE_API=https://api.draftva.com
NEXT_PUBLIC_APP_URL=https://draftva.com
AUTH_PROXY_SECRET=<same server-only value as the backend>
AUTH_CLIENT_IP_HEADER=x-forwarded-for
```

If `NEXT_PUBLIC_API_URL` is also configured, use `https://api.draftva.com`. Never put
API keys, webhook secrets, database credentials or `AUTH_PROXY_SECRET` in a
`NEXT_PUBLIC_` variable. The frontend host must overwrite the configured visitor-IP
header; the backend validates the signed relay. Do not trust user-supplied IP headers.

Configure R2 CORS for `https://draftva.com` before testing uploads; see
[direct uploads](direct-r2-uploads.md). R2 direct uploads bypass Nginx. The legacy
attachment endpoint alone accepts up to 110 MiB at the proxy; the backend still
validates the actual 20 MiB image / 100 MiB video limits and scans files.

## 2. Build and run the offline preflight

Use the wrapper for every production Compose command. It supplies `backend/.env`
for both Compose interpolation and container env, regardless of the working directory.
`DRAFTVA_ENV_FILE` can select another private file explicitly, but no override is needed
for the default server setup. Backups and certificate renewal use the same wrapper.
The Compose project, internal network and volumes are separate from development.

```sh
sh scripts/compose-prod.sh config --quiet
sh scripts/compose-prod.sh build
sh scripts/compose-prod.sh run --rm --no-deps migrate python -m app.core.production
```

Preflight checks the PostgreSQL password, dedicated encryption key, exact frontend
origins, public API/OAuth URLs, live Dodo configuration, email, LLM, storage and
proxy trust. It prints field names/problems, never credential values. Resolve every
`FAIL`. Review every `WARN`, including absent provider integrations. Do not show
unconfigured/unapproved channels to customers as ready.

Offline checks cannot verify ownership, funding, delivery, provider approvals,
DNS, TLS, cloud firewall rules or R2 CORS. Complete the live checks below.

## 3. Bootstrap HTTPS

Start the stack in **HTTP challenge-only mode**. This serves ACME challenges but
never forwards API requests or credentials over unencrypted HTTP:

```sh
NGINX_CONFIG=http sh scripts/compose-prod.sh up -d
sh scripts/compose-prod.sh ps
```

Migrations run before the API, worker and scheduler. The API health check uses
`/ready`, which checks PostgreSQL and Redis, while `/health` is only liveness.
ClamAV's first signature download can take several minutes; wait for its daemon
before testing uploads. Inspect logs if a dependency is not ready.

Once DNS points at this VM and port 80 is reachable, obtain the certificate:

```sh
sh scripts/compose-prod.sh run --rm --no-deps certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --cert-name api.draftva.com -d api.draftva.com \
  --email YOUR_OPERATIONS_EMAIL --agree-tos --non-interactive
```

Replace the email and review the Let's Encrypt subscriber agreement before running
`--agree-tos`. The certificate and ACME state persist in Docker volumes. Then:

```sh
sh scripts/compose-prod.sh up -d --no-deps nginx
sh scripts/compose-prod.sh exec -T nginx nginx -t
curl --fail --silent --show-error https://api.draftva.com/health
curl --fail --silent --show-error https://api.draftva.com/ready
```

Leave `NGINX_CONFIG=https` in `.env`. HTTP requests redirect to the fixed
HTTPS API hostname. Unknown hostnames/SNI are rejected. TLS supports 1.2 and 1.3;
HSTS applies to the API host. No self-signed certificate is used in production.

## 4. Enable and verify certificate renewal

On the VM, install the supplied systemd units:

```sh
sudo cp deploy/systemd/draftva-tls.service /etc/systemd/system/
sudo cp deploy/systemd/draftva-tls.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now draftva-tls.timer
sudo systemctl list-timers draftva-tls.timer
sh scripts/compose-prod.sh run --rm --no-deps certbot renew --dry-run
sudo systemctl start draftva-tls.service
sudo systemctl status draftva-tls.service
```

Renewal runs twice daily with jitter and reloads Nginx only after Certbot succeeds
and `nginx -t` passes. Services do not receive the Docker socket. The timer runs
on the host. Keep port 80 available for HTTP-01 renewals and monitor timer failure
and certificate expiry. See the [Certbot webroot and renewal documentation](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot).

## 5. Register production callbacks and Dodo webhook

Register these exact URLs with each provider you enable:

| Integration | Production URL |
| --- | --- |
| X sign-in (frontend) | `https://draftva.com/api/auth/x/callback` |
| X publishing account | `https://api.draftva.com/api/v1/channels/x/callback` |
| LinkedIn | `https://api.draftva.com/api/v1/channels/linkedin/callback` |
| Reddit | `https://api.draftva.com/api/v1/channels/reddit/callback` |
| Facebook Pages | `https://api.draftva.com/api/v1/channels/facebook/callback` |
| Instagram | `https://api.draftva.com/api/v1/channels/instagram/callback` |
| Threads | `https://api.draftva.com/api/v1/channels/threads/callback` |
| Bluesky client metadata | `https://api.draftva.com/api/v1/channels/bluesky/client-metadata` |
| Bluesky callback | `https://api.draftva.com/api/v1/channels/bluesky/callback` |
| Dodo webhook (POST) | `https://api.draftva.com/api/v1/webhooks/dodo` |
| MCP server | `https://api.draftva.com/mcp` |

Mastodon apps are registered per instance by the adapter, using the same API origin.
Set Google Authorized JavaScript origins to `https://draftva.com` (and www only
if you actually serve sign-in there). Verify Meta App Review / access levels and
LinkedIn product approval separately. See [social sign-in setup](social-sign-in.md).

In Dodo **live mode**, add the webhook URL above and subscribe to the subscription,
payment, refund and dispute lifecycle events handled by the app. Copy that endpoint's
signing secret into backend `DODO_WEBHOOK_SECRET`. Then recreate the processes to
load changed environment values:

```sh
sh scripts/compose-prod.sh up -d --no-deps --force-recreate api worker scheduler
```

An unsigned POST must return 400, never activate a plan. A real signed event must
return 204 and update only the intended workspace. Returning to the frontend after
checkout is not proof of payment. Verify a paid plan only after webhook processing.
The minimum API-key resource permissions are Checkout Sessions Write, Customers Write,
and Subscriptions Read for the current billing code; webhook management can remain None
when you add its endpoint in the dashboard.

## 6. Backups, updates and launch checks

Before running an update or migration:

```sh
sh scripts/backup-db.sh
```

This produces a private PostgreSQL custom-format dump in `deploy/state/backups/`.
A failed dump removes only its partial file. Copy backups to encrypted off-VM storage
and configure retention and a daily schedule with your cloud's backup policy. The
local backup script alone does not protect against losing the VM. Retain the
application/token-encryption keys separately and test restoring a dump into an
**isolated** database. Never run `down -v` on production or reset its migration history.

For a code update, take the backup first, then:

```sh
sh scripts/compose-prod.sh build
sh scripts/compose-prod.sh run --rm --no-deps migrate python -m app.core.production
sh scripts/compose-prod.sh run --rm migrate
sh scripts/compose-prod.sh up -d --no-deps api worker scheduler
sh scripts/compose-prod.sh exec -T nginx nginx -t
sh scripts/compose-prod.sh exec -T nginx nginx -s reload
```

Keep migrations backward compatible while old API processes are running. Some updates
may need a maintenance window. Nginx re-resolves Docker DNS after an API replacement;
a single API container can still cause a brief interruption during its restart. This
is not a zero-downtime, multi-host or highly available deployment. Do not roll back an
image across an incompatible database migration without a tested recovery plan.

Before opening paid signups, perform these checks from the deployed frontend:

- Register, receive OTP, verify, sign in, reset a password and confirm old sessions end.
- Connect each enabled social channel and publish/schedule one controlled post with media.
- Upload an image and a video through R2, wait for scanning, and confirm previews/publishing.
- Complete a real checkout with the intended live product, verify webhook activation,
  included AI credits, billing portal, cancellation and renewal behavior. A live checkout
  charges money; complete this explicitly as the operator, not as an automated health probe.
- Invite a teammate, accept while signed out/in, and exercise expired invitations/seat limits.
- Generate AI content and confirm durable credit deduction and monthly reset behavior.
- Verify MCP authorization and streaming if you advertise that integration.
- Test restore, off-VM backup scheduling and alerts; monitor `/ready`, failed jobs,
  queue age, billing reconciliation, Redis memory, disk space, ClamAV and TLS expiry.

Do not treat unit tests, a present API key or an HTTP 200 health page as proof that
provider approvals, real payments, emails and scheduled posts work in production.

## Local verification (no production services are started)

```sh
.venv/bin/python -m ruff check .
.venv/bin/python -m pytest
DRAFTVA_PROXY_INTEGRATION=1 .venv/bin/python -m pytest tests/test_production_proxy.py
```

The opt-in proxy tests create a self-signed test certificate and disposable containers
bound only to random loopback ports. They check real Nginx syntax, raw webhook bytes,
header spoofing, redacted query logs, HTTP redirects, ACME files, streaming, body limits
and DNS recovery after replacing the fake API. They never use the application database,
live keys, public ports 80/443 or actual provider calls. The default echo image is
`python:3.13-slim`; `DRAFTVA_PROXY_ECHO_IMAGE` can select an already available Python image.

References: [Compose merge/override rules](https://docs.docker.com/reference/compose-file/merge/),
[Nginx proxy directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[Dodo live API/key environments](https://docs.dodopayments.com/api-reference/introduction).
