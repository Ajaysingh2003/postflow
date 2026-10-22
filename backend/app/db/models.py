"""Import all models so SQLAlchemy sees the complete metadata graph."""

from app.modules.agents.models import AgentAuthorization, AgentClient, AgentConnection
from app.modules.analytics.models import MetricSnapshot
from app.modules.assistant.models import (
    AssistantConversation,
    AssistantRun,
    AssistantTurn,
    VoiceProfile,
)
from app.modules.billing.models import (
    AICreditBalance,
    AICreditEvent,
    AICreditReservation,
    BillingCustomer,
    BillingReconciliationRetry,
    BillingReconciliationState,
    BillingWebhookEvent,
    EntitlementGrant,
    Plan,
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
    ContentTemplate,
    Post,
    PostVariant,
    PostVariantMedia,
)
from app.modules.identity.models import (
    AuthIdentity,
    AuthOAuthState,
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
    "AICreditBalance",
    "AICreditEvent",
    "AICreditReservation",
    "AgentAuthorization",
    "AgentClient",
    "AgentConnection",
    "AssistantConversation",
    "AssistantRun",
    "AssistantTurn",
    "AuthIdentity",
    "AuthOAuthState",
    "BillingCustomer",
    "BillingReconciliationRetry",
    "BillingReconciliationState",
    "BillingWebhookEvent",
    "ConnectedAccount",
    "ContentTemplate",
    "EmailVerificationToken",
    "EntitlementGrant",
    "MastodonApp",
    "MediaAsset",
    "MetricSnapshot",
    "OAuthState",
    "PasswordCredential",
    "PasswordResetToken",
    "Plan",
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
