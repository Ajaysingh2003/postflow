"""Import all models so SQLAlchemy sees the complete metadata graph."""

from app.modules.analytics.models import MetricSnapshot
from app.modules.assistant.models import AssistantRun, VoiceProfile
from app.modules.billing.models import (
    BillingCustomer,
    BillingWebhookEvent,
    EntitlementGrant,
    Subscription,
    UsageLedger,
)
from app.modules.channels.models import (
    ConnectedAccount,
    MastodonApp,
    OAuthState,
    SubredditProfile,
)
from app.modules.content.models import (
    Post,
    PostVariant,
    PostVariantMedia,
)
from app.modules.identity.models import (
    AuthIdentity,
    EmailVerificationToken,
    PasswordCredential,
    PasswordResetToken,
    SessionToken,
    User,
)
from app.modules.media.models import MediaAsset
from app.modules.publishing.models import PublishAttempt
from app.modules.workspaces.models import (
    Workspace,
    WorkspaceInvitation,
    WorkspaceMembership,
)

__all__ = [
    "AssistantRun",
    "AuthIdentity",
    "BillingCustomer",
    "BillingWebhookEvent",
    "ConnectedAccount",
    "EmailVerificationToken",
    "EntitlementGrant",
    "MastodonApp",
    "MediaAsset",
    "MetricSnapshot",
    "OAuthState",
    "PasswordCredential",
    "PasswordResetToken",
    "Post",
    "PostVariant",
    "PostVariantMedia",
    "PublishAttempt",
    "SessionToken",
    "SubredditProfile",
    "Subscription",
    "UsageLedger",
    "User",
    "VoiceProfile",
    "Workspace",
    "WorkspaceInvitation",
    "WorkspaceMembership",
]
