# Direct browser uploads and monthly AI allowances

## Upload flow

All composer editors, AI source attachments and the media library share
`fronted/src/modules/content/assets.ts`:

1. Send small JSON metadata to `POST /api/media/uploads`. The Next.js route
   forwards the authenticated session and selected workspace to the backend.
2. The backend validates filename, allowed type, purpose and size, reserves
   workspace storage, and returns a short-lived signed PUT for a unique private
   `quarantine/` object. Content type, exact length and purpose are signed.
3. The browser sends the raw file directly to R2. It never sends its Draftva
   session or storage credentials to R2. File bytes do not pass through Vercel.
4. Send `POST /api/media/uploads/{id}/complete`. The backend checks the workspace,
   reservation expiry, actual size, file contents and image dimensions.
   The backend writes **the exact bytes that were validated**
   to the private `media/` location and marks the asset ready. Copying the quarantine
   object would allow replaying the still-valid PUT to swap different bytes into it.
5. The client attaches only a `ready` result. Failed reservations/quarantine objects follow existing
   hourly cleanup; ready files are retained.

Post images/PDFs keep the configured 20 MiB limit; post videos keep 100 MiB.
AI sources (including audio, Office documents, text and video) stay limited to
20 MiB. The signed request's `purpose` defaults to `post` for older API clients.
Assistant purpose is recorded as **signed object metadata**, so no database
migration is required. Both ticket issuance and completion are rate limited.

The legacy backend `/api/v1/media/attachments` remains compatible with trusted
non-Vercel clients, but the frontend no longer accepts or uses multipart upload
proxying. Its Next.js endpoints accept at most 4 KiB of JSON metadata.

Previews also bypass function response limits: authenticated
`GET /api/media/{id}/content` asks the backend for a ready-only signed download
and redirects to R2. The bucket remains private. Downloads are time limited;
the backend's session and credentials are never included in the redirect.

## Required R2 CORS policy

Browser signed uploads require bucket CORS, even with valid signatures.
See [Cloudflare's signed URL documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
and [CORS setup](https://developers.cloudflare.com/r2/buckets/cors/).

In Cloudflare: **R2 → your private bucket → Settings → CORS Policy**.
Merge the following rule with any unrelated existing rules. Replace the example
production origin with the exact origin serving Draftva; add each approved
preview/development origin explicitly. An origin has no trailing slash or path.
Do not add `*` or make the bucket public.

```json
[
  {
    "AllowedOrigins": ["https://draftva.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "x-amz-meta-purpose", "Range"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

The current local R2 credentials returned `AccessDenied` for `GetBucketCors`.
The code cannot confirm or update this account-level setting with those
credentials. A bucket administrator must confirm/apply it through Cloudflare or
an appropriately privileged management credential. Never expose that credential
to the frontend. CORS changes can take roughly 30 seconds to propagate.

The `python -m app.modules.media.configure` helper now includes the signed
`x-amz-meta-purpose` header and Range downloads. It reads the existing policy,
preserves unrelated rules, and replaces only its own `draftva-browser-uploads`
rule. It needs permission to read and write bucket CORS; application object
read/write credentials may not include these permissions. If `GetBucketCors`
returns `AccessDenied`, use the Cloudflare dashboard to merge the rule above.
Do not make the bucket public or proxy large file bytes through Vercel.

On 2026-10-26, read-only checks with the local storage configuration returned
200 for `HeadBucket` but 403 for signed PUT preflight from both
`https://draftva.com` and `http://localhost:3000`. `GetBucketCors` returned
`AccessDenied`, so the active policy could not be inspected or changed with
those credentials. These checks do not establish that the production server
uses the same bucket and keys; verify the failing request in the actual browser.

Safari's `TypeError: Load failed` does not identify the cause by itself. Check
the browser Network panel for the failing step: ticket metadata, R2 OPTIONS/PUT,
or completion/verification. The shared client now distinguishes network failures at
each step and preserves server errors such as quota or storage failures. A
debug edit without braces had made the generic storage error unconditional;
that error-handling bug has been corrected.

Backend production configuration still requires `R2_*`, the existing quota settings
and a running maintenance scheduler. Restart frontend/backend for the new route
contract. Do not mix old frontend upload code with the new proxy.

## Upload verification and deployment

The malware scanner integration has been removed entirely: no network calls,
settings, Compose service, optional profile or signature-database volume are defined.
Uploads check filename, size, supported type, file contents, image dimensions,
workspace access, quotas and rate limits, then become ready. The frontend uses
`uploading` followed by `verifying`; it has no `scanning` state.

Deploy the updated backend and recreate its API/worker/scheduler containers. Also
redeploy the frontend, or restart the local frontend development process, to load
the updated state names. Environment changes alone cannot update a running image.
No database migration is needed. A previously failed upload can be retried within
its reservation lifetime. Cleanup still recognizes historical failure rows so
their storage reservations are released normally.

### If production still reports a scanner error

A read-only check on 2026-10-26 found that the live API's `/openapi.json` still
described `/api/v1/media/attachments` as requiring scanning. The local source
already had the integration removed. Updating environment variables or stopping
the scanner does not load the changed API code.

First transfer the updated backend files into the directory used by the running
API. A `git pull` only helps after these changes have been committed and pushed;
if `server/` is a separate copy of `backend/`, update that copy as well. Keep the
server's private `.env` intact.

For the last reported server layout, the application uses the base Compose
project (`draftva-api-1`) while Nginx uses `draftva-prod-nginx-1`. Update the
application project from its existing working directory:

```sh
cd ~/opt/draftva/server
docker compose build api worker scheduler
docker compose up -d --no-deps --force-recreate --wait api worker scheduler
```

Recreating that base-project API removes its manually added Nginx network
connection. For this split-project layout, reconnect it and reload Nginx:

```sh
docker network connect --alias api draftva-prod-proxy draftva-api-1
sh scripts/compose-prod.sh exec -T nginx nginx -s reload
```

If all application services already use the production Compose project, use
`sh scripts/compose-prod.sh` in place of `docker compose` and omit the manual
network connection. Keep the existing project and database volumes; switching
projects is not part of this upload fix.

Verify the code inside the running API, using the same Compose command that
manages it:

```sh
docker compose exec -T api python - <<'PY'
from app.modules.media import service
assert not hasattr(service, "scan_clamav"), "The running API still has the old upload code"
print("Scanner integration absent from running API")
PY
curl --fail --silent --show-error https://api.draftva.com/ready
```

The assertion verifies the running container rather than only the source checkout.
After it passes, retry the failed file upload. Readiness alone checks database
and Redis connectivity and cannot establish which upload implementation is loaded.

After updating the application, remove any old scanner container explicitly.
For the previously reported server setup, its name was `draftva-clamav-1`:

```sh
docker ps -a --filter label=com.docker.compose.service=clamav
docker rm -f draftva-clamav-1
```

If it was started by the production Compose project instead, use the actual name
shown by `docker ps`. Remove the obsolete `MEDIA_MALWARE_SCAN_ENABLED`,
`CLAMAV_HOST` and `CLAMAV_PORT` entries from private environment files if present;
the updated backend no longer reads them. Do not remove PostgreSQL/R2 data or
run `docker compose down -v` for this change.

## Verify before deployment

- From the actual production origin, upload an image larger than 4.5 MB and a
  video larger than 4.5 MB. Confirm the large request is a PUT to R2, with only
  small JSON requests to Draftva before/after it.
- Confirm the UI shows verification before attaching; video/image previews load
  through a redirect and play/read ranges from R2.
- Upload an AI text/Office source. Confirm its signed purpose header is
  `assistant` and its contents are usable only after validation.
- Reject unsupported files, changed declared sizes, expired reservations,
  over-quota uploads. Valid uploads should complete directly after verification.
- Automated checks: `bun test tests/media-upload.test.js tests/media-routes.test.js`
  from `fronted`; `.venv/bin/python -m pytest tests/test_direct_uploads.py
  tests/test_storage_costs.py tests/test_billing_usage.py` from `backend`.
  Automated storage tests use fakes, not the live bucket.

## Yearly subscriptions: monthly AI credits

Payment frequency and AI allowance frequency are separate. Starter receives
1,000, Pro 5,000 and Business 8,000 credits **each month**, including yearly
subscriptions. There is no upfront annual credit pool or rollover.

The existing `billing.entitlements.usage_window()` calculates monthly windows
from the subscription's billing-period start, preserving its UTC day/time.
For example, an annual January 31, 10:00 UTC subscription renews credits on
February 28/29 at 10:00 UTC, then March 31 at 10:00 UTC. Short months do not move
later resets permanently to the 28th. Free uses calendar-month UTC windows.

Monthly rollover is applied to the PostgreSQL counters when usage is checked,
without needing a monthly payment webhook or cron reset. Existing run history
remains intact. The later counter migration and bonus/reset operations are
documented in [AI credit operations](ai-credit-operations.md). Billing,
Home and composer enforcement use the same window. Cancellation retains monthly
allowances only while existing paid-access policy permits access.
