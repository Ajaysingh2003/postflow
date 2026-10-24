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

## Dodo is the price source

`GET /api/v1/billing/plans` reads the nine configured products through Dodo's
official `GET /products/{id}` API. There are no runtime fallback price amounts.
Plan names/descriptions stay in Draftva and entitlement limits still come from
PostgreSQL; editing a Dodo product does not change AI credit or team allowances.

To change a price, edit the corresponding recurring product in Dodo. Keeping
the same product ID needs **no code change or redeployment**. Replacing a product
requires updating its `.env` mapping and restarting the backend services.
Use monthly (1 Month), quarterly (3 Month), and annual (1 Year or 12 Month)
products. A mismatched interval, unsupported pricing type, missing product, or
malformed provider response returns 503 rather than showing an invented price.
The subscription's total lifetime is not its payment frequency.

Only sanitized price fields are shared in Redis. Configuration/mode/credential
changes use different cache keys. The default `BILLING_CATALOG_CACHE_TTL_SECONDS`
is 60 (configurable 15–300). One distributed lease refreshes the full catalog,
with at most three concurrent reads and an overall
`BILLING_CATALOG_TIMEOUT_SECONDS` deadline of 8 seconds (configurable 1–20).
Provider failures are negatively cached for 10 seconds. Redis failures fail
closed instead of making unlimited uncached Dodo calls. Expired snapshots and
hardcoded prices are never served as fallback data.

Open cards refresh every 30 seconds and on window focus, so updates normally
appear within **90 seconds**. Home and Pricing server pages load pricing per
request instead of freezing it into a production build. Pricing errors have
retry controls and skeletons. A background pricing failure replaces the cards
with an error; it does not leave an old quote silently available forever.

Cards display the product's base price in its currency, converting the smallest
currency unit correctly. Configured product discounts are disclosed as applied
at checkout. Dodo confirms discounts, currency conversion and applicable taxes
before payment. The API key and private product/delivery fields never reach the
browser. This integration only reads products; it does not create/reprice them
or alter existing subscriptions. No database migration is needed.

Official contract: [Dodo product retrieval](https://github.com/dodopayments/dodopayments-python/blob/main/src/dodopayments/resources/products/products.py)
and [recurring price fields](https://github.com/dodopayments/dodopayments-python/blob/main/src/dodopayments/types/price.py).

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

On 24 October 2026, read-only live lookups confirmed that all three configured
`*_QUARTERLY` products now bill every **3 months** in USD: Starter **$24**, Pro
**$78**, and Business **$132**. Earlier six-month configuration is superseded.
Both the public pricing selector and sidebar upgrade dialog show **Quarterly**;
cards show the full total per **3 months**. Public interval metadata is `quarter`.
Monthly prices remain $9/$29/$49 and annual totals remain $86/$182/$470.
Generic discount badges and comparisons against a single month's price remain
removed. No Dodo products, prices, subscriptions or payments were changed by
these read-only checks or the display correction.

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
