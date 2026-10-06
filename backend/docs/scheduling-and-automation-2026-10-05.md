# Scheduling and publishing review

The dashboard calendar and multi-account publish/schedule dialog are implemented. Automated DMs, reposts and engagement-triggered follow-ups were investigated following the user's clarification; they are **not enabled** by this change. No messaging permission, credential or database migration was added.

## Delivered behavior

- Day, Monday-start week and month calendar; date navigation; account/status filters; local timezone display; paginated dated posts and automatic refresh.
- Scheduled, publishing, published and failed entries belong to the current workspace. Published posts use their actual publication time. Drafts do not appear.
- A scheduled entry can be rescheduled, published immediately or moved back to drafts. Failed entries show the error and link to their editor.
- Every editor opens the same account-selection dialog. Each destination keeps its own text, publishing target, media and supported settings. Facebook links, Instagram photo/carousel/Reel format, LinkedIn visibility and X reply audience are editable during review.
- Selected destinations are validated and submitted independently through the existing publishing pipeline. Instagram media and target requirements remain enforced. Reddit requires an explicit community and title per destination.
- Stable destination request keys avoid duplicate variant creation after a lost response. Submitted versions are locked; retries reconcile current server state and leave successful accounts untouched. Uncertain outcomes require reconciliation.
- Identical text across selected X accounts is blocked in the dialog. This exact-match guard does not detect all substantially similar posts; users still need genuinely distinct versions.

The worker already dispatches due variants and handles retries, attempts and account reauthorization. It must stay running for scheduled delivery; keeping a browser tab open is unnecessary. This update adds the calendar API and client integration rather than a browser timer.

## Official API investigation

Verified on 2026-10-05. Availability depends on each app's approved products, permissions, API credits and the connected account's grants.

| Feature | Official support and remaining implementation |
| --- | --- |
| X delayed repost | The official repost endpoint uses `tweet.read`, `tweet.write` and `users.read`, which our OAuth flow already requests. Requires durable timed tasks, cancellation, audit and optional later unrepost handling. [Repost endpoint](https://docs.x.com/x-api/users/repost-post). |
| X Auto-DM | Official DM endpoints exist. Our flow currently has no messaging scopes or recipient-consent tracking. Needs explicit campaign consent, recipient opt-in/opt-out, deduplication and DM-specific permissions before enabling. [DM API](https://docs.x.com/x-api/direct-messages/manage/introduction). |
| X engagement-triggered follow-up | Our adapter can read metrics and publish replies, but has no threshold-monitoring jobs. An own-post follow-up and a reply to a commenter need separate models and permission checks. |
| Instagram comment-to-private-reply | Instagram Login supports one private reply using `instagram_business_basic` and `instagram_business_manage_comments`. Our connect flow can already request comments access with `options.manage_replies=true`, but lacks comment webhooks and private-reply jobs. Send to the comment ID through `/{IG_USER_ID}/messages`, using the Instagram Graph host and Instagram User token. [Instagram Platform private replies](https://developers.facebook.com/documentation/instagram-platform/private-replies). |
| Facebook Page comment-to-private-reply | Requires a Page token with the `MESSAGING` task and `pages_messaging`; our flow currently does not request that permission. Requires Page feed webhook ingestion, app access and a private-reply handler. [Messenger private replies](https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/private-replies). |
| LinkedIn Auto-DM | Standard Share on LinkedIn publishing permission covers posting, commenting and liking, not messaging. This repo has no approved messaging integration. Do not offer a working Auto-DM toggle on that connection. [LinkedIn API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access). |

X automation rules require express account-owner consent for automated actions. Recipients must opt in to automated DMs and have an easy opt-out; following an account or merely being able to receive DMs is insufficient. Reposting must avoid aggressive or spammy behavior. AI reply bots require prior written X approval. Identical or substantially similar automated posts across accounts are prohibited. These requirements affect implementation beyond just adding a checkbox. [X automation rules, updated April 2026](https://help.x.com/en/rules-and-policies/x-automation).

Instagram and Facebook private replies permit one initial message within seven days of the comment. Further conversation requires the recipient's response and must respect the 24-hour window. Instagram Live private replies must be sent during the broadcast. A general messaging conversation is a separate integration; do not assume its permissions are the same as Instagram Login's single comment private reply. [Instagram rules](https://developers.facebook.com/documentation/instagram-platform/private-replies), [Facebook rules](https://developers.facebook.com/documentation/business-messaging/messenger-platform/discovery/private-replies).

The screenshots' four-day campaign and 500-DM-per-day setting are not implemented or treated as universal API limits. Additional polling and API writes also need workspace billing/rate limits; the live workspace already contains an X failure reporting depleted API credits.

## Verification

From `backend`: `.venv/bin/ruff check app tests migrations` and `.venv/bin/pytest -o addopts='' -q`.

From `fronted`: `bun test tests`, `bunx tsc --noEmit`, and scoped ESLint for the changed TypeScript files.

Backend coverage includes date boundaries, offset-equivalent ranges, pagination, workspace isolation and request-key replay/collision behavior. Existing publishing-pipeline tests cover worker dispatch and failure handling. Frontend coverage includes local dates, calendar layout, copied destination identities/settings, retry keys, independent destination failures and API wiring.

Browser checks use the live calendar and an isolated in-memory publishing preview. The preview verified four successful scheduling destinations alongside one Instagram validation failure, past-time rejection and reconciliation of a lost publishing response, without contacting any social API. Phone-width checks verified a day calendar, contained week scrolling and no page overflow. The temporary preview route was removed after verification. No real post was published or scheduled during verification.
