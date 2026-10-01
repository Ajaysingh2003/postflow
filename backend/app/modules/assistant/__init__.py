"""AI Assistant module with platform profiles and feature registry."""

from app.modules.assistant.base import AssistantFeature, AssistantProfile
from app.modules.assistant.models import AssistantRun, VoiceProfile
from app.modules.assistant.registry import assistant_registry
from app.modules.assistant.router import router
from app.modules.assistant.service import execute_feature, train_voice_profile

__all__ = [
    "AssistantFeature",
    "AssistantProfile",
    "AssistantRun",
    "VoiceProfile",
    "assistant_registry",
    "execute_feature",
    "router",
    "train_voice_profile",
]
