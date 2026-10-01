"""Feature and profile registry for the AI assistant module."""

from fastapi import HTTPException, status

from app.modules.assistant.base import AssistantFeature, AssistantProfile
from app.modules.assistant.features import ALL_FEATURES
from app.modules.assistant.profiles import ALL_PROFILES


class AssistantRegistry:
    """Registry coordinating all AI assistant features and platform profiles."""

    def __init__(self) -> None:
        self._features: dict[str, AssistantFeature] = {}
        self._profiles: dict[str, AssistantProfile] = {}

        # Register default platform profiles
        for profile in ALL_PROFILES.values():
            self.register_profile(profile)

        # Register default features
        for feature in ALL_FEATURES:
            self.register_feature(feature)

    def register_profile(self, profile: AssistantProfile) -> None:
        self._profiles[profile.platform.lower()] = profile

    def register_feature(self, feature: AssistantFeature) -> None:
        self._features[feature.id.lower()] = feature

    def get_feature(self, feature_id: str) -> AssistantFeature | None:
        return self._features.get(feature_id.lower())

    def require_feature(self, feature_id: str) -> AssistantFeature:
        feat = self.get_feature(feature_id)
        if not feat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assistant feature '{feature_id}' is not registered.",
            )
        return feat

    def get_profile(self, platform: str) -> AssistantProfile | None:
        return self._profiles.get(platform.lower())

    def list_profiles(self) -> list[AssistantProfile]:
        return list(self._profiles.values())

    def list_features(self, platform: str | None = None) -> list[AssistantFeature]:
        if not platform:
            return list(self._features.values())
        plat = platform.lower()
        return [
            f
            for f in self._features.values()
            if "*" in f.platforms or plat in [p.lower() for p in f.platforms]
        ]


assistant_registry = AssistantRegistry()
