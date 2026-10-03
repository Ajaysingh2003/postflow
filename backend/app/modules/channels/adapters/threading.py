"""Resumable thread sequencing shared by adapters with reply support."""

from types import SimpleNamespace

from app.modules.channels.adapters.media import save_state
from app.modules.channels.base import Issue, PublishResult


async def validate_thread(adapter, variant):
    items = variant.payload["thread"]
    if not isinstance(items, list) or not 1 <= len(items) <= 25:
        return [Issue(field="thread", message="A thread must contain 1–25 posts")]
    issues = []
    for item in items:
        if not isinstance(item, (str, dict)):
            return [Issue(field="thread", message="Invalid thread post")]
        payload = {"text": item} if isinstance(item, str) else item
        if "thread" in payload:
            return [Issue(field="thread", message="Nested threads are not supported")]
        issues.extend(
            await adapter.validate(
                SimpleNamespace(
                    payload=payload, validation_account=getattr(variant, "validation_account", None)
                )
            )
        )
    return issues


async def publish_thread(adapter, account, variant, reply_builder):
    items = variant.payload["thread"]
    completed = list((getattr(variant, "publish_state", None) or {}).get("thread_posts", []))
    for index, item in enumerate(items[len(completed) :], start=len(completed)):
        payload = {"text": item} if isinstance(item, str) else dict(item)
        payload.update(reply_builder(completed))
        child = SimpleNamespace(
            payload=payload, idempotency_key=f"{variant.idempotency_key}:{index}"
        )
        result = await adapter.publish(account, child)
        if not result.success:
            return result
        if not result.external_post_id:
            return PublishResult(
                success=False,
                outcome_unknown=True,
                error_message="Thread post was accepted without an identifier",
            )
        completed.append({"id": result.external_post_id, "response": result.raw_response})
        await save_state(variant, thread_posts=completed)
    return PublishResult(
        success=True, external_post_id=completed[0]["id"], raw_response={"thread_posts": completed}
    )
