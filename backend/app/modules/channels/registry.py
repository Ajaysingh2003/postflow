import logging

from fastapi import HTTPException, status

from app.modules.channels.base import Capabilities, PlatformAdapter

logger = logging.getLogger(__name__)


class ChannelRegistry:
    """Registry holding all configured platform adapters."""

    def __init__(self) -> None:
        self._adapters: dict[str, PlatformAdapter] = {}

    def register(self, adapter: PlatformAdapter) -> None:
        """Register a platform adapter."""
        platform = adapter.platform.lower()
        if platform in self._adapters:
            logger.warning("Overwriting existing adapter for platform '%s'", platform)
        self._adapters[platform] = adapter
        logger.info("Registered platform adapter: '%s'", platform)

    def unregister(self, platform: str) -> None:
        """Remove a platform adapter (primarily for testing)."""
        self._adapters.pop(platform.lower(), None)

    def get(self, platform: str) -> "PlatformAdapter | None":
        """Get an adapter by platform name, or None if not registered."""
        return self._adapters.get(platform.lower())

    def require(self, platform: str) -> "PlatformAdapter":
        """Get an adapter by platform name, raising HTTPException 404 if not found."""
        adapter = self.get(platform)
        if adapter is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Platform '{platform}' is not supported or not configured.",
            )
        return adapter

    def list_supported_platforms(self) -> list[str]:
        """Return list of all registered platform keys."""
        return sorted(self._adapters.keys())

    def get_capabilities(self, platform: str) -> "Capabilities | None":
        """Get capabilities for a single platform."""
        adapter = self.get(platform)
        return adapter.capabilities if adapter else None

    def get_all_capabilities(self) -> dict[str, "Capabilities"]:
        """Return a dictionary of capabilities for all registered platforms."""
        return {name: adapter.capabilities for name, adapter in self._adapters.items()}


channel_registry = ChannelRegistry()


def init_default_adapters() -> None:
    """Register all available default platform adapters."""
    from app.modules.channels.adapters.bluesky import BlueskyAdapter
    from app.modules.channels.adapters.facebook import FacebookAdapter
    from app.modules.channels.adapters.instagram import InstagramAdapter
    from app.modules.channels.adapters.linkedin import LinkedInAdapter
    from app.modules.channels.adapters.mastodon import MastodonAdapter
    from app.modules.channels.adapters.reddit import RedditAdapter
    from app.modules.channels.adapters.threads import ThreadsAdapter
    from app.modules.channels.adapters.x import XAdapter

    channel_registry.register(XAdapter())
    channel_registry.register(LinkedInAdapter())
    channel_registry.register(RedditAdapter())
    channel_registry.register(BlueskyAdapter())
    channel_registry.register(MastodonAdapter())
    channel_registry.register(FacebookAdapter())
    channel_registry.register(InstagramAdapter())
    channel_registry.register(ThreadsAdapter())


init_default_adapters()
