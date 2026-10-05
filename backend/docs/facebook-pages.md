# Facebook Page connections

The Facebook connected-account row is the parent user authorization (`fb_user_<id>`). Publishing destinations are persisted under that row's existing JSON metadata: `pages` contains Page ID, name, publishing tasks and picture URL; `page_tokens` maps each Page ID to its encrypted Page token. No extra connected-account rows, billing slots or database migration are needed.

After code exchange and the long-lived user-token exchange, the callback requests `/me/accounts?fields=id,name,access_token,tasks,picture` with the user token. It follows all trusted Graph pagination links before replacing the snapshot. Pages without an ID or Page token are excluded. When Meta supplies tasks, Pages lacking `CREATE_CONTENT` or `MANAGE` are excluded. Page tokens stay encrypted and are stripped from public account responses.

The existing `/channels/accounts/<parent-id>/targets` endpoint returns that persisted snapshot as `target_type=page` destinations, with `parent_connection_id`, tasks and picture URL in public metadata. The composer already calls this endpoint and writes the selected Page ID to `payload.page_id`. Reading targets does not request Meta again. Empty or inactive connections return an actionable 409 error so the existing frontend displays a reconnect instruction instead of claiming that posts publish directly to the Facebook user.

Reconnect updates the existing parent record, replaces its Page IDs and tokens, and records `last_synced_at`. Removed Pages disappear. A successful empty discovery clears the old snapshot. Failed or malformed discovery, including failures on subsequent Graph pages, preserves the previous snapshot and tokens. Refresh uses the same discovery function and preserves Page pictures and tasks. Reconnect may start at the account quota; the callback still enforces capacity if a different external account is returned.

Facebook authorization now also requests `business_management` for access to Pages associated with a Business Portfolio. The Meta app must be allowed to request the required permissions, and the person authorizing it must select the Pages and grant the relevant access. Existing tokens do not acquire newly requested permissions. Reconnect Facebook through Channels and grant Page and business access; refreshing the old token alone cannot add those permissions. Requested scopes recorded by the existing application are not proof that Meta granted them.

Publishing resolves the chosen Page token from the parent row's encrypted map. It never falls back to the Facebook user token, and rejects removed or unauthorized Pages before an HTTP publish request. The same rule already existed and now has callback-to-publish regression coverage.

Run verification from `backend/`:

```sh
python -m pytest tests/test_facebook_page_sync.py tests/test_adapter_facebook.py tests/test_meta_oauth_login.py
ruff check .
python -m pytest
```

The focused suite mocks Meta HTTP and exercises real callback, account, target and refresh routes against an isolated test database. It covers pagination, encrypted persistence, parent linkage, public token redaction, replay, reconnect at quota, token rotation, stale Page removal, failed refresh/reconnect preservation, empty discovery and Page-token-only publishing. Live consent and publishing require the user's authorized Meta account and are separate acceptance checks.

Meta's official request example: [Get Access Tokens of Pages You Manage](https://www.postman.com/meta/facebook/request/bqfxwbp/get-access-tokens-of-pages-you-manage).
