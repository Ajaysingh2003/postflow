from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.analytics.models import MetricSnapshot
from app.modules.assistant.models import AssistantRun, VoiceProfile
from app.modules.channels.models import (
    ConnectedAccount,
    MastodonApp,
    OAuthState,
    SubredditProfile,
)
from app.modules.content.models import Post, PostVariant, PostVariantMedia
from app.modules.identity.models import User
from app.modules.media.models import MediaAsset
from app.modules.publishing.models import PublishAttempt
from app.modules.workspaces.models import Workspace


def test_channels_models_crud():
    with SessionLocal.begin() as db:
        user = User(email="channel_user@example.com", name="Channel User")
        workspace = Workspace(name="Channel Workspace", slug="channel-workspace", owner_user_id="pending")
        db.add_all([user, workspace])
        db.flush()
        workspace.owner_user_id = user.id

        # ConnectedAccount
        account = ConnectedAccount(
            workspace_id=workspace.id,
            platform="x",
            external_account_id="x_123456",
            display_name="My X Handle",
            account_type="personal",
            encrypted_access_token="enc_access",
            encrypted_refresh_token="enc_refresh",
            token_expires_at=datetime.now(UTC) + timedelta(hours=2),
            granted_scopes=["tweet.read", "tweet.write", "users.read"],
            status="active",
            account_metadata={"username": "my_handle", "followers": 1500},
        )
        db.add(account)

        # MastodonApp
        masto_app = MastodonApp(
            instance_domain="mastodon.social",
            client_id="masto_client_id_123",
            encrypted_client_secret="masto_enc_secret",
            redirect_uri="https://app.draftva.ai/api/v1/channels/oauth/callback",
            scopes="read write push",
        )
        db.add(masto_app)

        # SubredditProfile
        sub = SubredditProfile(
            name="python",
            display_name="Python Programming",
            rules=[{"short_name": "No Spam", "description": "Original content only"}],
            allowed_post_types=["text", "link"],
            flair_required=True,
            available_flairs=[{"id": "flair_1", "text": "Discussion"}],
            title_requirements={"min_length": 10, "max_length": 300},
            fetched_at=datetime.now(UTC),
        )
        db.add(sub)

        # OAuthState
        oauth_state = OAuthState(
            workspace_id=workspace.id,
            user_id=user.id,
            platform="reddit",
            state_hash="state_hash_abc123",
            code_verifier="verifier_random_string",
            redirect_uri="https://app.draftva.ai/callback",
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        db.add(oauth_state)

    with SessionLocal() as db:
        acc = db.scalar(select(ConnectedAccount).where(ConnectedAccount.external_account_id == "x_123456"))
        assert acc is not None
        assert acc.platform == "x"
        assert acc.account_metadata["username"] == "my_handle"

        app_rec = db.scalar(select(MastodonApp).where(MastodonApp.instance_domain == "mastodon.social"))
        assert app_rec is not None
        assert app_rec.client_id == "masto_client_id_123"

        sub_rec = db.scalar(select(SubredditProfile).where(SubredditProfile.name == "python"))
        assert sub_rec is not None
        assert sub_rec.flair_required is True

        state_rec = db.scalar(select(OAuthState).where(OAuthState.state_hash == "state_hash_abc123"))
        assert state_rec is not None
        assert state_rec.code_verifier == "verifier_random_string"


def test_posts_variants_and_media_association():
    with SessionLocal.begin() as db:
        user = User(email="author@example.com", name="Author")
        workspace = Workspace(name="Content WS", slug="content-ws", owner_user_id="pending")
        db.add_all([user, workspace])
        db.flush()
        workspace.owner_user_id = user.id

        post = Post(
            workspace_id=workspace.id,
            author_id=user.id,
            title="Launch Post",
            base_text="Base text across channels",
            status="draft",
        )
        db.add(post)
        db.flush()

        media = MediaAsset(
            workspace_id=workspace.id,
            uploaded_by_user_id=user.id,
            object_key="media/content-ws/1/photo.jpg",
            original_filename="photo.jpg",
            content_type="image/jpeg",
            declared_size=10240,
            actual_size=10240,
            width=1200,
            height=630,
            alt_text="Banner image",
            status="ready",
        )
        db.add(media)
        db.flush()

        variant = PostVariant(
            post_id=post.id,
            platform="x",
            payload={"text": "Variant on X"},
            status="scheduled",
            scheduled_time=datetime.now(UTC) + timedelta(days=1),
            idempotency_key=str(uuid4()),
        )
        db.add(variant)
        db.flush()

        variant_media = PostVariantMedia(
            variant_id=variant.id,
            media_asset_id=media.id,
            order_index=0,
            alt_text="Twitter specific alt text",
        )
        db.add(variant_media)

        attempt = PublishAttempt(
            variant_id=variant.id,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            result="success",
            status_code=200,
            response_payload={"external_id": "tweet_99999"},
        )
        db.add(attempt)

    with SessionLocal() as db:
        loaded_post = db.scalar(select(Post).where(Post.title == "Launch Post"))
        assert loaded_post is not None
        assert len(loaded_post.variants) == 1
        var = loaded_post.variants[0]
        assert var.platform == "x"
        assert len(var.media_links) == 1
        assert var.media_links[0].alt_text == "Twitter specific alt text"

        att = db.scalar(select(PublishAttempt).where(PublishAttempt.variant_id == var.id))
        assert att is not None
        assert att.result == "success"
        assert att.response_payload["external_id"] == "tweet_99999"


def test_whole_account_and_variant_analytics():
    """Verify that MetricSnapshot supports both whole-account analytics and post-variant analytics."""
    with SessionLocal.begin() as db:
        user = User(email="analytics_user@example.com", name="Analytics User")
        workspace = Workspace(name="Analytics WS", slug="analytics-ws", owner_user_id="pending")
        db.add_all([user, workspace])
        db.flush()
        workspace.owner_user_id = user.id

        account = ConnectedAccount(
            workspace_id=workspace.id,
            platform="linkedin",
            external_account_id="urn:li:organization:12345",
            display_name="Acme Corp Page",
            account_type="page",
            status="active",
        )
        db.add(account)
        db.flush()

        post = Post(
            workspace_id=workspace.id,
            author_id=user.id,
            title="Analytics Post",
            base_text="Checking performance",
        )
        db.add(post)
        db.flush()

        variant = PostVariant(
            post_id=post.id,
            connected_account_id=account.id,
            platform="linkedin",
            payload={"text": "Variant for analytics"},
            idempotency_key=str(uuid4()),
            external_post_id="urn:li:share:67890",
            status="published",
        )
        db.add(variant)
        db.flush()

        now = datetime.now(UTC)

        # 1. Whole Account Analytics Snapshot (original source)
        account_snapshot = MetricSnapshot(
            workspace_id=workspace.id,
            connected_account_id=account.id,
            variant_id=None,
            snapshot_type="account",
            fetched_at=now,
            followers_count=5420,
            impressions=125000,
            reach=98000,
            engagements=8400,
            profile_views=1240,
            extras={"organic_followers": 5200, "sponsored_followers": 220, "demographics": {"country": "US"}},
        )
        db.add(account_snapshot)

        # 2. Post Variant Analytics Snapshot
        variant_snapshot = MetricSnapshot(
            workspace_id=workspace.id,
            connected_account_id=account.id,
            variant_id=variant.id,
            snapshot_type="variant",
            fetched_at=now,
            impressions=3200,
            reach=2900,
            engagements=310,
            likes=240,
            comments=45,
            shares_reposts=25,
            clicks=180,
            extras={"urn": "urn:li:share:67890", "viral_score": 8.7},
        )
        db.add(variant_snapshot)

    with SessionLocal() as db:
        # Verify account-level analytics query
        acc_snaps = list(
            db.scalars(
                select(MetricSnapshot).where(
                    MetricSnapshot.connected_account_id == account.id,
                    MetricSnapshot.snapshot_type == "account",
                )
            )
        )
        assert len(acc_snaps) == 1
        assert acc_snaps[0].followers_count == 5420
        assert acc_snaps[0].variant_id is None
        assert acc_snaps[0].extras["organic_followers"] == 5200

        # Verify variant-level analytics query
        var_snaps = list(
            db.scalars(
                select(MetricSnapshot).where(
                    MetricSnapshot.variant_id == variant.id,
                    MetricSnapshot.snapshot_type == "variant",
                )
            )
        )
        assert len(var_snaps) == 1
        assert var_snaps[0].likes == 240
        assert var_snaps[0].clicks == 180
        assert var_snaps[0].extras["viral_score"] == 8.7


def test_assistant_models():
    with SessionLocal.begin() as db:
        user = User(email="ai_user@example.com", name="AI User")
        workspace = Workspace(name="AI WS", slug="ai-ws", owner_user_id="pending")
        db.add_all([user, workspace])
        db.flush()
        workspace.owner_user_id = user.id

        voice = VoiceProfile(
            workspace_id=workspace.id,
            user_id=user.id,
            name="Founder Voice",
            tone_description="Punchy, actionable, transparent",
            sample_posts=["Building in public day 1...", "3 mistakes we made scaling..."],
            settings={"formality": 3, "use_emojis": False},
        )
        db.add(voice)

        run = AssistantRun(
            workspace_id=workspace.id,
            user_id=user.id,
            platform="x",
            feature_id="thread_writer",
            input_summary="Input 500 words on product launch",
            tokens_used=420,
            cost_micros=1200,
            status="succeeded",
        )
        db.add(run)

    with SessionLocal() as db:
        v = db.scalar(select(VoiceProfile).where(VoiceProfile.workspace_id == workspace.id))
        assert v is not None
        assert v.name == "Founder Voice"
        assert len(v.sample_posts) == 2

        r = db.scalar(select(AssistantRun).where(AssistantRun.workspace_id == workspace.id))
        assert r is not None
        assert r.feature_id == "thread_writer"
        assert r.tokens_used == 420
