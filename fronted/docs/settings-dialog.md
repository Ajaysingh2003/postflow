# Settings dialog

Open Settings from the account menu in the sidebar footer. Profile, security,
billing, team, connected accounts and agent connections share one dialog.
Only the selected section loads its queries; errors can be retried without
closing the dialog. Profile changes warn before switching sections or closing.

`SettingsLink` opens a section in the current dashboard page and preserves its
account/date/tab filters. It provides a `/dashboard?settings=…` fallback for
links opened in a new tab. Use this component for in-app settings links.

`/settings`, `/settings/billing` and `/dashboard/settings/*` redirect to the
dialog. The billing redirect preserves `checkout=success`; that notice does
not grant a paid plan. Subscription status and limits come from the backend.
The existing Dodo return URL can continue using `/settings/billing`.

Profile names persist through `user.updateProfile`. Email is displayed as read
only because a verified-email change flow is not supported. Security provides
password reset delivery, individual session revocation, current sign-out and
confirmed sign-out everywhere. Password email requests use a resend cooldown
in addition to the backend rate limiter.

Owners and admins can invite teammates and manage roles. The UI preserves owner
and admin restrictions; the backend remains the authority for permissions and
plan limits. Team removal and sign-out everywhere ask for confirmation.

Billing shows circular finite allowances and actual unlimited-post usage.
Only permitted members see upgrade and portal actions. Connected accounts and
agent settings reuse the existing OAuth and token-management implementations.
No new notification, appearance, deletion or email-change controls are advertised.

Verify with `bun test`, `bun x tsc --noEmit` and `bun run build`. For visual checks,
sign in and open `/dashboard?settings=profile` or `/dashboard?settings=billing`.
