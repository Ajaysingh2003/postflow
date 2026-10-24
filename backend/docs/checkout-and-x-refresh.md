# Pricing checkout and X refresh recovery

Every Starter, Pro and Business card uses the same checkout handler. It looks up
the current session through the public `user.profile` procedure before requesting
payment. Guests go to `/login?next=...` using the router; checkout is not created.
The return path is local-only. Signed-in users send the selected plan, billing
cycle and seat quantity through an authenticated procedure to `/api/v1/billing/checkout`.
The browser follows the returned checkout URL only after a successful response.
Session/payment errors remain visible and the button becomes usable again.

The card labels are **Get started** without a purchased subscription and **Upgrade**
for existing subscribers. There is no paid trial. Current paid subscribers open
Dodo's customer portal to manage the existing subscription instead of purchasing
a second one. Workspace viewers cannot manage billing. Billing lookup failures
remain errors rather than being interpreted as no subscription.

Checkout errors use the application's mounted Sonner notifications and also appear
inline below the button. Previously, react-hot-toast messages had no mounted toaster
on marketing pages, making configuration failures appear to do nothing.

`user.me` and authenticated mutations require a valid session. Public marketing
components use the nullable profile lookup. Both `createCheckout` and the older
`Createcheckout` procedure share one validated implementation. Public pricing reads
the backend catalog; an unavailable backend no longer substitutes stale prices.

## Dodo product configuration

The backend chooses Dodo product IDs from `.env`, never from an arbitrary client
product ID. Existing product variables select monthly billing:

```dotenv
DODO_PRODUCT_STARTER=
DODO_PRODUCT_PRO=
DODO_PRODUCT_BUSINESS=
```

For the Quarterly and Annually options, configure separate recurring products:

```dotenv
DODO_PRODUCT_STARTER_QUARTERLY=
DODO_PRODUCT_STARTER_ANNUALLY=
DODO_PRODUCT_PRO_QUARTERLY=
DODO_PRODUCT_PRO_ANNUALLY=
DODO_PRODUCT_BUSINESS_QUARTERLY=
DODO_PRODUCT_BUSINESS_ANNUALLY=
```

Set each Dodo product's price, currency and billing interval to match the published
card. No product was created or repriced automatically. Existing card amounts were
preserved. An unconfigured cycle returns a clear error rather than selecting the
monthly product. Reconciliation recognizes all configured cycles. The legacy
`price_id=pro_annually` selection is accepted only if it matches the plan and any
explicit billing cycle. No free-plan checkout is created.

Existing environment names are also supported without copying credentials:

| Current name | Compatible existing name |
| --- | --- |
| `DODO_PRODUCT_STARTER` | `PRODUCT_STARTER_MONTHLY` |
| `DODO_PRODUCT_PRO` | `PRODUCT_PRO_MONTHLY` |
| `DODO_PRODUCT_BUSINESS` | `PRODUCT_BUSINESS_MONTHLY` or `PRODUCT_AGENCY_MONTHLY` |
| `DODO_PRODUCT_STARTER_QUARTERLY` | `PRODUCT_STARTER_QUARTERLY` |
| `DODO_PRODUCT_PRO_QUARTERLY` | `PRODUCT_PRO_QUARTERLY` |
| `DODO_PRODUCT_BUSINESS_QUARTERLY` | `PRODUCT_BUSINESS_QUARTERLY` or `PRODUCT_AGENCY_QUARTERLY` |
| `DODO_PRODUCT_STARTER_ANNUALLY` | `PRODUCT_STARTER_YEARLY` |
| `DODO_PRODUCT_PRO_ANNUALLY` | `PRODUCT_PRO_YEARLY` |
| `DODO_PRODUCT_BUSINESS_ANNUALLY` | `PRODUCT_BUSINESS_YEARLY` or `PRODUCT_AGENCY_YEARLY` |

The current name takes precedence if both are set. Compatibility works in runtime
settings and the offline production preflight. Changes require restarting the API
to reload its cached settings. The local API was restarted and `/ready` returned 200.

On 23 October 2026, read-only live product lookups returned 200 for all nine configured
products. The products under the existing `*_QUARTERLY` keys have a six-month billing
frequency, not three months. At the user's direction, the selector now reads
**Every 6 months** and the cards show the total price per six months. The internal
`quarterly` key remains compatible with existing clients and environment names;
the public interval metadata is `half_year`. Generic discount badges and the
comparison against a single month's price were removed. The live
Starter checkout still uses the older Creator name and 300-credit product description;
application Starter entitlements remain 1,000 credits. Provider descriptions should
be aligned in the Dodo dashboard. No products, prices, subscriptions or payments
were changed during these checks.

Live API keys, products and webhook secrets must all belong to Dodo live mode.
Payment access still activates through the verified webhook, not a checkout redirect.
Automated checks use mocked Dodo HTTP responses; no live purchase was made.

## The pasted Docker output

The build and migration succeeded, and API startup completed. The relevant failure
was a scheduler request rejected by X with HTTP 400 for an invalid saved refresh
token; it was not a Compose startup failure. The log does not prove why that token
became invalid. Revocation, token reuse/rotation or changed app credentials require
investigation or user reauthorization.

Accounts marked `needs_reauth` are no longer refreshed repeatedly by the scheduler.
Reconnect the affected X account from Channels to obtain fresh credentials through
official OAuth. Disabled accounts also cannot be manually refreshed. A successful
refresh saves the new refresh token; malformed responses preserve existing tokens.
Transport failures, HTTP 408/429 and server errors keep the account eligible for
later retry. Provider response bodies are excluded from X refresh error logs.

Deploy the updated backend image and restart the API, worker and scheduler to load
these changes. A rejected/revoked credential cannot be repaired by restarting Docker
or by changing its status to active in the database.

Verification: backend checkout-selection/refresh-recovery tests exercise the actual
checkout request body with mocked provider HTTP. Frontend checkout tests cover all
nine card/cycle combinations for guests and signed-in users, errors and both server
procedure names. See the final task report for the latest complete-suite results.

Official references: [Dodo checkout sessions](https://docs.dodopayments.com/api-reference/checkout-sessions/create),
[X OAuth and refresh tokens](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).
