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
   reservation expiry, actual size, file contents and image dimensions, then scans
   with ClamAV. It writes **the bytes that were scanned** to the private `media/`
   location and marks the asset ready. Copying the quarantine object after a scan
   would allow replaying the still-valid PUT to swap unscanned bytes into it.
5. The client attaches only a `ready` result. Failed/unavailable scans never return
   a downloadable asset. Failed reservations/quarantine objects follow existing
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
    "AllowedOrigins": ["https://YOUR_APP_HOST", "http://localhost:3000"],
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

Backend production configuration still requires `R2_*`, a healthy ClamAV
connection, the existing quota settings and a running maintenance scheduler.
Ensure ClamAV's `StreamMaxLength`, `MaxFileSize` and `MaxScanSize` can scan a
100 MiB upload; scanner errors remain fail closed. Restart frontend/backend for
the new route contract. Do not mix old frontend upload code with the new proxy.

## Verify before deployment

- From the actual production origin, upload an image larger than 4.5 MB and a
  video larger than 4.5 MB. Confirm the large request is a PUT to R2, with only
  small JSON requests to Draftva before/after it.
- Confirm the UI shows verification before attaching; video/image previews load
  through a redirect and play/read ranges from R2.
- Upload an AI text/Office source. Confirm its signed purpose header is
  `assistant` and its contents are usable only after scanning.
- Reject unsupported files, changed declared sizes, expired reservations,
  over-quota uploads and malware. Disconnect the scanner and verify failure.
- Automated checks: `bun test tests/media-upload.test.js tests/media-routes.test.js`
  from `fronted`; `.venv/bin/python -m pytest tests/test_direct_uploads.py
  tests/test_storage_costs.py tests/test_billing_usage.py` from `backend`.
  Automated storage/scanner tests use fakes, not the live bucket.

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
