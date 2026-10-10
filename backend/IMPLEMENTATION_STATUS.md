# Backend implementation status

Updated 2 October 2026 after the backend audit and repair pass.

## Implemented

- Eight channel adapters and official OAuth paths, including AT Protocol discovery, PAR, PKCE and DPoP for Bluesky, and a new Threads adapter. Account secrets are encrypted; public account metadata filters credentials.
- Workspace checks at content creation/editing, attachment, voice-profile access and publishing boundaries. OAuth callbacks recheck workspace administration permission.
- Atomic publication claims, an audit row persisted before sending, resumable threads/media/container state, scheduled refresh, and explicit reconciliation for uncertain outcomes. A lost response is held instead of automatically posting again.
- Shared Redis reservation and response-header handling for outbound adapter requests, with a development-only memory fallback.
- Draft variant add/edit/delete and attachment endpoints, template CRUD, image dimensions/alt text, official platform upload helpers, and container readiness checks.
- A feature registry with 41 features, platform-owned payload validation and prompt context, bounded public-web fetching, scoped voice profiles, usage records for successful and failed generations, and progress/final-output SSE.
- Database plans, quota serialization, immediate-publication limits, actual token usage accounting, estimated provider posting costs, and persisted billing reconciliation.
- Analytics collection without the old 100-variant/50-account caps and reporting based on publication time. Provider errors do not create successful zero snapshots.
- SMTP delivery for verification, password reset and invitations; production rejects development secrets and fake AI/billing success.

## Schema and migration

The existing initial migration is `ceb2b91baf53_draftva_initial_schema.py`. The additive `20261002_backend_reliability.py` adds plans, templates, OAuth metadata, publication state/timestamps and usage uniqueness. Existing migration history and application data remain intact. The current models have 28 application tables, including existing identity/billing support tables; there is no legacy extension or prospect module to remove.

## Verification and limits

See the [repair report](docs/backend-repairs-2026-10-02.md) for the final checks, exact configuration, provider approval requirements and known API limits. All local tests use mocked providers and isolated databases. Live OAuth, developer-account approval, production SMTP/storage/payment delivery, PostgreSQL/Redis CI and deployment have not been verified in this local repair pass.

X alt-text uploading through the chosen OAuth 2/v2 flow is not advertised because the current official v2 metadata documentation does not specify it. Facebook and Instagram alt-text publishing is also not advertised by this integration. X quote posting requires Enterprise access. Instagram deletion and some platform analytics are explicitly unsupported. Reddit private-community rules are excluded from the shared cache. These restrictions are reported rather than represented as working features.

Frontend contracts and retired frontend branding need their own implementation pass. No frontend file was changed.
