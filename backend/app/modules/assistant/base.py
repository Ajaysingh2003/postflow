"""Core protocols and data classes for the AI assistant system.

Features declare Pydantic input/output schemas and prompt templates.
Platform profiles declare style guidelines, limits, and available feature IDs.
"""

from dataclasses import dataclass, field
from typing import Any, TypeVar

from pydantic import BaseModel

TInput = TypeVar("TInput", bound=BaseModel)
TOutput = TypeVar("TOutput", bound=BaseModel)


@dataclass
class AssistantProfile:
    """Platform-specific assistant profile defining tone, constraints, and features."""

    platform: str
    display_name: str
    system_instructions: str
    style_guidelines: list[str] = field(default_factory=list)
    character_limit: int = 500
    feature_ids: list[str] = field(default_factory=list)


@dataclass
class AssistantFeature:
    """Declarative specification for an AI assistant feature."""

    id: str
    name: str
    description: str
    platforms: list[str]  # e.g. ["x"] or ["*"] for shared
    input_schema: type[BaseModel]
    output_schema: type[BaseModel]
    prompt_template: str  # Jinja-style or python format template


@dataclass
class LLMMessage:
    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMResponse:
    content: str
    parsed: Any | None = None
    tokens_prompt: int = 0
    tokens_completion: int = 0
    total_tokens: int = 0
    model: str = "mock"
