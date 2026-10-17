# Plans and brand voices

Effective policy: 17 October 2026.

| Plan | AI credits each month | Saved brand profiles per workspace | Posts |
| --- | ---: | ---: | --- |
| Free | 20 | 0 | 5 per month |
| Starter | 1,000 | 3 | Unlimited |
| Pro | 5,000 | 5 | Unlimited |
| Business | 8,000 | 10 | Unlimited |

Free is an ongoing plan. New paid checkouts explicitly send
`subscription_data.trial_period_days = 0`, overriding any trial configured on a
Dodo product. See the [official checkout SDK contract](https://github.com/dodopayments/dodopayments-typescript/blob/main/src/resources/checkout-sessions.ts).
Existing provider-reported trial subscriptions remain recognized until their
normal transition; this release neither charges them early nor cancels them.

The backend policy is `billing/entitlements.py`. Frontend fallback pricing and
the comparison table share `modules/billing/planAllowances.ts`. Public paid plan
IDs are `starter`, `pro`, and `business`. Legacy `creator`/`agency` IDs use the
Starter/Business AI and voice allowances while preserving their other limits.
AI credits reset monthly, including annual subscriptions. Consumed usage is not
reset by upgrading the policy. Manual bonus/custom grants remain intact.
Channel request limits and the existing provider spending guard still apply.

## Brand profile behavior

Profiles use the existing `voice_profiles` table. Identity, audience, tone,
writing rules, language, samples and per-channel guidance are kept separately
for each profile. The active marker is stored in profile settings; workspace
locks serialize switching and capacity checks. Older single-brand records work
without a destructive migration. Legacy manually created or trained voice
records count toward the same allowance and can be selected as brand profiles.

Paid owners, admins and editors can create, rename, switch, edit, train and
delete profiles. Viewers can read them. All access is workspace-scoped, including
the older `/voice-profiles` create/train APIs. A downgrade preserves saved voices
but disables their AI context on Free; it does not delete posts or profiles.
A paid downgrade below the current profile count prevents further creation and
keeps existing data. Profiles do not reset monthly.

The brand dialog has a selector and management controls. The composer also has
a compact selector when multiple profiles exist. Switching changes the context
of subsequent AI requests and starts a separate composer chat scope; history is
retained. Unsaved brand edits must be saved or discarded before managing voices.
The server loads saved brand context for generation; clients cannot substitute
another workspace's profile.

“Learn from saved samples” analyzes up to five saved samples, then saves voice
traits, a style guide and writing rules to that profile. This is saved prompt
guidance, not foundation-model fine-tuning. It uses one AI credit for a successful
request. Missing samples, a stale revision or a full profile allowance are
rejected before a new-profile training request calls the provider. Concurrent
edits during analysis are rejected when the result is applied; the completed
generation remains billable. Failed provider generations follow normal credit
refund/accounting behavior. Samples remain reference data, not system commands.

## API

- `GET/PATCH /api/v1/assistant/brand-profile`: active profile and its summaries.
  PATCH accepts `profile_id` to bind edits to the profile originally loaded;
  `expected_updated_at` guards against conflicting edits.
- `POST /api/v1/assistant/brand-profiles`: `{ "name": "Studio" }`; creates and activates.
- `POST /api/v1/assistant/brand-profiles/{id}/activate`: switches the active voice.
- `PATCH /api/v1/assistant/brand-profiles/{id}/name`: renames a voice.
- `DELETE /api/v1/assistant/brand-profiles/{id}`: deletes after UI confirmation.
- `POST /api/v1/assistant/brand-profiles/{id}/train`: analyzes saved samples;
  send `expected_updated_at` from the loaded profile.

## Deploy and verify

Run `alembic upgrade head` before deploying the updated backend. Migration
`20261017_plan_brand_profiles` updates the stored standard plan JSON and
plan-generated credit grants for each workspace's newest subscription. It
preserves usage records, manual grants, profile data and unrelated plan limits.
Its downgrade intentionally does not guess previous commercial allowances.
Deploy frontend and backend together so public pricing and enforcement agree.

Run the full backend suite and Ruff. Focused regressions are in
`tests/test_brand_plan_limits.py` and `tests/test_brand_profile.py`; the existing
additive-migration test upgrades to this head on an isolated database. Frontend
checks include `bun test tests/brand-plans.test.jsx`, TypeScript and a production
build. Provider checkout and AI calls are mocked in automated tests.
