# Postflow agent connections

The Agents item opens a dialog over the current page. It includes setup for Claude, ChatGPT, Cursor, Codex and other MCP clients, a downloadable Postflow skill, a workflow guide, and connection management. Only implemented connections are listed; Slack, Zapier and other third-party integrations are not advertised as installed integrations.

## Backend address

MCP is served by the existing FastAPI backend at `/mcp`, using the official Python MCP SDK and Streamable HTTP. No separate MCP domain or service is required.

Set `PUBLIC_BACKEND_URL` to the externally reachable backend origin (for example `https://api.postflow.ai`). When unset, the backend derives the origin from the existing `OAUTH_REDIRECT_BASE_URL`. The dialog receives this URL from the authenticated backend. `NEXT_PUBLIC_API_URL` continues to configure the frontend's ordinary backend requests. The backend's `FRONTEND_URL` must point to the actual frontend for consent and login redirects.

Cloud clients such as Claude and ChatGPT need a public HTTPS backend. A localhost URL works for local desktop clients, but cannot be reached by a cloud service. Deploy the backend or use an already authorized HTTPS development tunnel; this feature does not expose the computer publicly. Route `/mcp`, `/oauth/*` and `/.well-known/*` to the backend and `/dashboard/agents/authorize` to the frontend. Reverse proxies must preserve authorization and MCP protocol headers.

## Sign-in and permissions

OAuth supports discovery, dynamic client registration, exact registered redirect URIs, S256 PKCE, resource-bound authorization codes, explicit authenticated workspace consent, rotating refresh tokens and revocation. Access tokens last one hour; the grant lasts 90 days. Authorization requests last ten minutes and approved codes five minutes. Tokens are stored as hashes. Clients are self-registered: their name is not a verified identity; the consent screen shows the return destination and asks the user to approve only requests they initiated.

Scopes are `postflow:read`, `postflow:write`, `postflow:publish` and `postflow:assistant`. Read is required. Each connection is bound to one user and workspace. Every tool rechecks membership and write-role permissions. Removed members and inactive users lose access. Refresh cannot broaden the original consent.

For clients accepting a custom Authorization header, users can create a workspace-scoped token with selected permissions. It is displayed once, expires after 90 days, and can be revoked from the dialog. The application session token is never used as an agent token. Use `Authorization: Bearer <agent token>`; never put tokens in URLs or commit them to client configuration.

## Tools

- `get_workspace`, `list_accounts`, `list_posts`, `get_post`: inspect the approved workspace without exposing social OAuth credentials.
- `create_draft`, `update_draft`, `validate_post`: use the existing content services and platform validation.
- `schedule_post`, `publish_post`, `cancel_schedule`: use the existing publishing pipeline, billing limits and publication safeguards. Scheduling/publishing require `confirmed=true`; the tool instructions require explicit user approval for the exact content, destination and time. This flag expresses the client's confirmation and is not independent proof of human consent.
- `get_analytics`: use the selected account's official analytics flow, including posts published outside Postflow.
- `list_ai_features`, `run_ai_feature`: discover and run the existing platform-specific assistant. AI runs use the same credit reservations, validation and usage logging as the composer. MCP calls themselves do not consume AI credits.

## Verification

Install dependencies and apply the additive migration before restarting:

```sh
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/ruff check .
.venv/bin/pytest tests/test_agents.py
```

From `fronted`, run `bun test tests/agents.test.jsx` and `bun x tsc --noEmit`. Backend tests exercise the actual MCP transport, discovery, authentication, PKCE, code replay, refresh rotation, expiry/revocation, workspace isolation, role changes, content validation, scheduling confirmation, AI billing and data-preserving migrations. Browser checks cover sidebar behavior, URL copying, setup navigation and mobile layout. External client connections still require user OAuth approval and a public deployment; no social posts are published during these checks.

Official client setup references: [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [ChatGPT MCP authentication](https://developers.openai.com/plugins/build/auth), [Codex MCP](https://developers.openai.com/codex/mcp), and [Cursor MCP](https://cursor.com/docs/mcp).
