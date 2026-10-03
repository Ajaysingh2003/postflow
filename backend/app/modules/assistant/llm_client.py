"""Provider-agnostic LLM client for structured text generation.

Supports any OpenAI-compatible completions endpoint with JSON mode.
Deterministic output is available only with an explicit development/test mock flag.
"""

import json
import logging
import re
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.modules.assistant.base import LLMMessage, LLMResponse

logger = logging.getLogger("assistant.llm")

T = TypeVar("T", bound=BaseModel)


class LLMGenerationError(ValueError):
    def __init__(self, tokens_used):
        super().__init__("Provider output did not match the requested schema")
        self.tokens_used = tokens_used


def make_strict_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Recursively enforce 'additionalProperties: False' for strict JSON Schema mode."""
    cloned = json.loads(json.dumps(schema))

    def _recurse(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object" or "properties" in node:
                if not isinstance(node.get("additionalProperties"), dict):
                    node["additionalProperties"] = False
                if "properties" in node:
                    node["required"] = list(node["properties"])
            for v in node.values():
                _recurse(v)
        elif isinstance(node, list):
            for item in node:
                _recurse(item)

    _recurse(cloned)
    return cloned


class LLMClient:
    """Provider-agnostic LLM interface."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.llm_provider_api_key
        self.base_url = (base_url or settings.llm_provider_url or "").rstrip("/")
        self.model = model or settings.llm_model
        self._http_client = http_client

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is not None:
            return self._http_client
        return httpx.AsyncClient(timeout=60.0)

    async def generate_structured(
        self,
        messages: list[LLMMessage],
        response_model: type[T],
        temperature: float = 0.7,
    ) -> tuple[T, LLMResponse]:
        """
        Generate structured output parsed and validated against response_model.
        """
        settings = get_settings()
        if not self.api_key and not settings.llm_mock_enabled:
            from fastapi import HTTPException

            raise HTTPException(503, "AI provider is not configured")
        if settings.llm_mock_enabled and self._http_client is None:
            mock_data = self._generate_mock_output(response_model, messages)
            parsed = response_model.model_validate(mock_data)
            resp = LLMResponse(
                content=json.dumps(mock_data),
                parsed=parsed,
                tokens_prompt=50,
                tokens_completion=100,
                total_tokens=150,
                model="mock-deterministic",
            )
            return parsed, resp

        if not self.base_url or not self.model:
            from fastapi import HTTPException

            raise HTTPException(503, "Configure an AI provider URL and model")
        client = await self._get_client()
        raw_schema = response_model.model_json_schema()
        strict_schema = make_strict_json_schema(raw_schema)

        payload = {
            "model": self.model,
            "max_tokens": get_settings().llm_max_output_tokens,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": response_model.__name__,
                    "strict": True,
                    "schema": strict_schema,
                },
            },
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            r = await client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            # Fallback to simple json_object mode if the provider rejects strict json_schema
            if r.status_code != 200 and (
                "json_schema" in r.text.lower() or "schema" in r.text.lower()
            ):
                logger.info("Provider rejected strict json_schema, retrying with json_object mode")
                fallback_payload = {
                    "model": self.model,
                    "max_tokens": get_settings().llm_max_output_tokens,
                    "messages": [{"role": m.role, "content": m.content} for m in messages]
                    + [
                        {
                            "role": "system",
                            "content": f"Output must strictly match this JSON schema: {json.dumps(raw_schema)}",
                        }
                    ],
                    "temperature": temperature,
                    "response_format": {"type": "json_object"},
                }
                r = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=fallback_payload,
                    headers=headers,
                )
        finally:
            if self._http_client is None:
                await client.aclose()

        if r.status_code != 200:
            logger.error("LLM provider returned error %s: %s", r.status_code, r.text)
            raise RuntimeError(f"LLM API error ({r.status_code}): {r.text}")

        res_json = r.json()
        choice = res_json.get("choices", [{}])[0]
        content_str = choice.get("message", {}).get("content", "{}")
        usage = res_json.get("usage", {})

        try:
            data = json.loads(content_str)
            parsed = response_model.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise LLMGenerationError(usage.get("total_tokens", 0)) from exc
        llm_resp = LLMResponse(
            content=content_str,
            parsed=parsed,
            tokens_prompt=usage.get("prompt_tokens", 0),
            tokens_completion=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            model=self.model,
        )
        return parsed, llm_resp

    def _generate_mock_output(
        self, response_model: type[BaseModel], messages: list[LLMMessage]
    ) -> dict[str, Any]:
        """
        Produce a valid schema-compliant mock dictionary based on field annotations.
        """
        # Extract user prompt content if available
        user_content = ""
        for m in reversed(messages):
            if m.role == "user":
                user_content = m.content
                break

        fields = response_model.model_fields
        result: dict[str, Any] = {}

        for field_name, field_info in fields.items():
            ann = field_info.annotation
            ann_str = str(ann)

            if "list" in ann_str.lower() or "list" in getattr(ann, "__name__", "").lower():
                if "hook" in field_name:
                    result[field_name] = [
                        "Curiosity hook: Most people get this completely wrong.",
                        "Contrarian angle: Why standard industry advice is broken.",
                        "Data-driven hook: 87% of teams fail because of this one mistake.",
                    ]
                elif "hashtag" in field_name:
                    result[field_name] = ["#Productivity", "#Tech", "#SocialGrowth"]
                elif "question" in field_name:
                    result[field_name] = [
                        "What is your biggest roadblock with this right now?",
                        "Have you tried this method before? Drop your thoughts below!",
                    ]
                elif "angle" in field_name:
                    result[field_name] = [
                        {"subreddit": "technology", "angle": "Focus on infrastructure and scale."},
                        {"subreddit": "startups", "angle": "Focus on founder lessons and ROI."},
                    ]
                elif "slide" in field_name or "carousel" in field_name:
                    result[field_name] = [
                        {
                            "slide_number": 1,
                            "title": "The Big Shift",
                            "content": "Why traditional scheduling is changing.",
                        },
                        {
                            "slide_number": 2,
                            "title": "Key Insight",
                            "content": "Multi-channel alignment drives reach.",
                        },
                        {
                            "slide_number": 3,
                            "title": "Take Action",
                            "content": "Audit your platform variants today.",
                        },
                    ]
                elif "adapted_posts" in field_name:
                    result[field_name] = [
                        {
                            "subreddit": "programming",
                            "title": "Lessons learned scaling asynchronous distributed queues in Python",
                            "body": "Here is an architectural breakdown of queue isolation and rate limits.",
                            "recommended_flair": "Discussion",
                            "post_type": "text",
                            "community_angle": "Technical architecture focus",
                        },
                        {
                            "subreddit": "webdev",
                            "title": "How we designed multi-platform social dispatch with zero cascading failures",
                            "body": "A deep dive into decoupled webhook workers and Redis rate limiters.",
                            "recommended_flair": "Tutorial",
                            "post_type": "text",
                            "community_angle": "Developer implementation guide",
                        },
                    ]
                elif "thread" in field_name or "posts" in field_name or "items" in field_name:
                    result[field_name] = [
                        "1/3 Here is a breakdown of how modern distributed publishing works in 2025.",
                        "2/3 Each platform adapter isolates network calls and validates constraints before publish.",
                        "3/3 Conclusion: Never compromise reliability for speed.",
                    ]
                elif "tag" in field_name:
                    result[field_name] = ["en"]
                elif "rule" in field_name or "issue" in field_name:
                    result[field_name] = [
                        "Complies with community standards; no promotional spam detected."
                    ]
                elif "strengths" in field_name:
                    result[field_name] = [
                        "Strong technical depth",
                        "Fits community discussion norms",
                    ]
                elif "risk_factors" in field_name:
                    result[field_name] = ["Ensure external links are omitted from title"]
                elif "recommendations" in field_name:
                    result[field_name] = ["Add a TL;DR summary at the bottom"]
                elif "recommended_windows" in field_name:
                    result[field_name] = ["Tuesday 14:00 - 17:00 UTC", "Thursday 13:00 - 16:00 UTC"]
                elif "peak_activity_days" in field_name:
                    result[field_name] = ["Tuesday", "Wednesday", "Thursday"]
                elif "suggestions" in field_name:
                    if "reply" in response_model.__name__.lower():
                        result[field_name] = [
                            {
                                "tone": "helpful",
                                "text": "Thanks for pointing that out! Here is how we handled concurrency...",
                                "reasoning": "Direct and insightful answer",
                            },
                            {
                                "tone": "appreciative",
                                "text": "Great perspective, completely agree on the database lock trade-off.",
                                "reasoning": "Validates commenter and builds goodwill",
                            },
                        ]
                    else:
                        result[field_name] = [
                            "Ensure no promotional links in title",
                            "Add concrete technical breakdown",
                        ]
                elif "recommended_subreddits" in field_name:
                    result[field_name] = [
                        {
                            "subreddit": "programming",
                            "subscriber_scale": "5.8M",
                            "match_reason": "High interest in architecture",
                            "posting_tips": "Focus on code trade-offs",
                        },
                        {
                            "subreddit": "webdev",
                            "subscriber_scale": "2.4M",
                            "match_reason": "Relevant to API developers",
                            "posting_tips": "Value-first tutorials",
                        },
                    ]
                elif "option" in field_name:
                    result[field_name] = [
                        "Option A: Faster execution",
                        "Option B: Deeper reliability",
                        "Option C: Both",
                    ]
                else:
                    result[field_name] = ["Mock generated item 1", "Mock generated item 2"]

            elif "bool" in ann_str.lower():
                result[field_name] = True

            elif "int" in ann_str.lower():
                if "score" in field_name or "fit" in field_name:
                    result[field_name] = 88
                else:
                    result[field_name] = 42

            elif "dict" in ann_str.lower():
                if field_name in {"variants", "adapted_variants"}:
                    platforms = set(
                        re.findall(
                            r"'(x|linkedin|reddit|bluesky|mastodon|facebook|instagram|threads)'",
                            user_content,
                        )
                    )
                    result[field_name] = {
                        p: "Practical lessons from building reliable software." for p in platforms
                    }
                else:
                    result[field_name] = {"variant": "mock_data"}

            elif "str" in ann_str.lower():
                if field_name == "post_type":
                    result[field_name] = "text"
                elif "title" in field_name:
                    result[field_name] = "How to Build Resilient Social Scheduling Architectures"
                elif "alignment" in field_name:
                    result[field_name] = "High"
                elif "rationale" in field_name or "reason" in field_name:
                    result[field_name] = "Peak community activity occurs mid-week afternoon UTC."
                elif (
                    "caption" in field_name
                    or "body" in field_name
                    or "content" in field_name
                    or "post" in field_name
                ):
                    snippet = (
                        user_content[:80] if user_content else "Modern distributed publishing."
                    )
                    result[field_name] = (
                        f"Key takeaway: {snippet} Clean architecture ensures zero cross-platform cascading failures."
                    )
                elif "hook" in field_name:
                    result[field_name] = (
                        "Why 90% of developers build scheduling pipelines wrong (and how to fix it):"
                    )
                elif "first_comment" in field_name:
                    result[field_name] = (
                        "Drop a comment if you'd like the complete architecture blueprint!"
                    )
                elif "flair" in field_name:
                    result[field_name] = "Discussion"
                elif "alt_text" in field_name:
                    result[field_name] = (
                        "Diagram showing decoupled social media platform adapters and workers."
                    )
                elif "warning" in field_name or "spoiler" in field_name:
                    result[field_name] = "Engineering architecture insights"
                elif "script" in field_name:
                    result[field_name] = (
                        "Hook: Stop hardcoding social integrations! Visual: show code refactor. Body: Use adapters."
                    )
                else:
                    result[field_name] = f"Mock {field_name} text"
            else:
                result[field_name] = "mock_value"

        return result


default_llm_client = LLMClient()
