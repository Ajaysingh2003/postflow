# Brand profiles

Draftva keeps one brand profile per workspace. It contains the creator's identity,
audience, expertise, goals, values, voice preferences, writing boundaries, up to
five original writing samples, and optional guidance for each supported channel.
No connected account or AI generation is required to create or edit a profile.

## API and storage

- `GET /api/v1/assistant/brand-profile` returns the saved profile or empty defaults,
  the workspace ID, revision timestamp, and whether the member can edit it.
- `PATCH /api/v1/assistant/brand-profile` accepts partial updates. Editors, admins,
  and owners can save. Viewers and billing members can read.
- Send `expected_updated_at` (including null for the initial save) to avoid
  overwriting concurrent edits. An outdated revision receives HTTP 409.
- The profile uses the existing `voice_profiles` table, tagged with
  `settings.profile_kind = "workspace_brand"`. No new migration is required.
  The structured fields live in `settings.brand`; writing samples and tone are
  mirrored in the existing voice columns. Ordinary trained profiles remain separate.
- Account/workspace authorization is enforced by the backend. Frontend queries
  include the workspace ID in their cache key and authenticated request headers.

## Assistant behavior

`execute_feature()` loads the workspace brand automatically. This covers the
composer, platform feature/refinement requests, streaming, multi-channel
adaptation, and MCP AI feature execution. Voice training is excluded so it
analyzes only the submitted writing samples.

Brand context goes into the user prompt as reference data. System instructions
retain priority over writing samples, channel preferences, or pasted instructions.
The model is told not to invent credentials, experiences, achievements, or
numerical claims and not to copy samples into new posts. Existing output schema
and adapter validation still run; usage accounting includes provider token usage.

A selected optional voice profile can override style while retaining the brand's
identity and audience. Explicit language and per-request writing preferences can
adjust defaults. Multi-channel adaptation receives only the preferences for its
selected channels. Empty profiles leave normal platform defaults in place.

## Interface and validation

Open **Brand profile** in the sidebar or **Your brand voice** in the composer.
The dialog offers Brand & audience, Voice & style, Writing samples, and Channel
preferences. It includes suspense loading skeletons, retry, read-only access,
server-side persistence, conflict recovery, and an unsaved-change confirmation.
Sidebar hover/focus preloads the profile.

Run from `backend`: `.venv/bin/python -m pytest tests/test_brand_profile.py`.
Run from `fronted`: `bun test tests/brand-profile.test.jsx`.
Tests cover workspace isolation, roles, revisions, data limits, prompt context,
style overrides, streaming, multiple channels, and independence of voice training.
Provider calls in these tests are mocked; they verify the supplied context,
not the quality of a particular model's generated prose.
