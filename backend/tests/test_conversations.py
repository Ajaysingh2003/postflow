"""Durable, private chats, safe context restoration and exactly-once turn execution."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.assistant import service
from app.modules.assistant.base import LLMResponse
from app.modules.assistant.models import AssistantConversation, AssistantRun, AssistantTurn
from app.modules.identity.models import User
from app.modules.workspaces.models import WorkspaceMembership

URL = "/api/v1/assistant/conversations"
RUN = "/api/v1/assistant/features/rewrite_with_tone/run"


class ChatLLM:
    def __init__(self):
        self.calls = []

    async def generate_structured(self, messages, response_model):
        self.calls.append(messages)
        return response_model(
            rewritten_text=f"Draft number {len(self.calls)}", notes="A clearer opening"
        ), LLMResponse(content="", total_tokens=15)


@pytest.fixture
def llm(monkeypatch):
    provider = ChatLLM()
    monkeypatch.setattr(service, "default_llm_client", provider)
    return provider


def chat(client, auth, title="Write about my work"):
    result = client.post(
        URL,
        headers=auth,
        json={
            "platform": "x",
            "title": title,
            "context": {
                "source_text": "Original idea",
                "origin_scope": "draft-a",
                "account_name": "Jamie",
            },
        },
    )
    assert result.status_code == 201, result.text
    return result.json()


def turn(chat_id, request_id=None, prompt="Make it clearer"):
    return {
        "platform": "x",
        "input_data": {"text": "Original idea", "tone": prompt},
        "conversation_id": chat_id,
        "request_id": request_id or str(uuid4()),
        "conversation_prompt": prompt,
        "conversation_source": "Original idea",
    }


def test_create_run_reopen_and_continue_with_saved_context(client, auth, llm):
    saved = chat(client, auth)
    assert client.get(URL, headers=auth).json()["items"] == []
    result = client.post(RUN, headers=auth, json=turn(saved["id"]))
    assert result.status_code == 200, result.text
    reopened = client.get(f"{URL}/{saved['id']}", headers=auth).json()
    assert reopened["context"]["source_text"] == "Original idea"
    assert reopened["turns"][0]["prompt"] == "Make it clearer"
    assert reopened["turns"][0]["response_data"]["output"]["rewritten_text"] == "Draft number 1"
    continued = client.post(
        f"{URL}/{saved['id']}/messages",
        headers=auth,
        json={"prompt": "Make that shorter", "request_id": str(uuid4())},
    )
    assert continued.status_code == 200, continued.text
    messages = llm.calls[1]
    assert [message.role for message in messages] == ["system", "user", "assistant", "user"]
    assert "Make it clearer" in messages[1].content
    assert "Draft number 1" in messages[2].content
    assert "Draft number 1" in messages[-1].content
    assert "Make that shorter" in messages[-1].content
    assert "Conversation history" in messages[0].content
    assert client.get(f"{URL}/{saved['id']}", headers=auth).json()["turn_count"] == 2


def test_message_retry_does_not_charge_twice_or_change_its_result(client, auth, llm):
    saved = chat(client, auth)
    payload = turn(saved["id"])
    first = client.post(RUN, headers=auth, json=payload)
    second = client.post(RUN, headers=auth, json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert len(llm.calls) == 1
    with SessionLocal() as db:
        assert len(list(db.scalars(select(AssistantTurn)))) == 1
        assert len(list(db.scalars(select(AssistantRun)))) == 1
    changed = {**payload, "conversation_prompt": "Something different"}
    assert client.post(RUN, headers=auth, json=changed).status_code == 409
    request = {"prompt": "Another revision", "request_id": str(uuid4())}
    first = client.post(f"{URL}/{saved['id']}/messages", headers=auth, json=request)
    again = client.post(f"{URL}/{saved['id']}/messages", headers=auth, json=request)
    assert first.json() == again.json() and len(llm.calls) == 2


def test_chats_are_private_even_between_workspace_editors(client, auth, llm):
    saved = chat(client, auth)
    assert client.post(RUN, headers=auth, json=turn(saved["id"])).status_code == 200
    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "other-chat@example.com",
            "password": "correct horse battery",
            "name": "Other",
        },
    ).json()
    other_auth = (
        {
            "Authorization": f"Bearer {other['access_token']}",
            "X-Workspace-ID": saved["workspace_id"],
        }
        if "workspace_id" in saved
        else {"Authorization": f"Bearer {other['access_token']}"}
    )
    with SessionLocal.begin() as db:
        conversation = db.get(AssistantConversation, saved["id"])
        other_user = db.scalar(select(User).where(User.email == "other-chat@example.com"))
        db.add(
            WorkspaceMembership(
                workspace_id=conversation.workspace_id, user_id=other_user.id, role="editor"
            )
        )
        other_auth["X-Workspace-ID"] = conversation.workspace_id
    assert client.get(URL, headers=other_auth).json()["items"] == []
    assert client.get(f"{URL}/{saved['id']}", headers=other_auth).status_code == 404
    assert client.post(RUN, headers=other_auth, json=turn(saved["id"])).status_code == 404
    assert (
        client.get(
            f"{URL}/{saved['id']}", headers={**auth, "X-Workspace-ID": str(uuid4())}
        ).status_code
        == 403
    )


def test_new_chat_preserves_old_and_history_search_is_literal_and_paginated(client, auth, llm):
    first = chat(client, auth, "X_% ideas")
    second = chat(client, auth, "Weekly notes")
    for saved in [first, second]:
        assert client.post(RUN, headers=auth, json=turn(saved["id"])).status_code == 200
    page = client.get(URL, headers=auth, params={"limit": 1}).json()
    assert len(page["items"]) == 1 and page["next_cursor"] == 1
    next_page = client.get(URL, headers=auth, params={"limit": 1, "cursor": 1}).json()
    assert next_page["items"][0]["id"] != page["items"][0]["id"]
    assert "source_text" not in page["items"][0]["context"]
    matches = client.get(URL, headers=auth, params={"search": "%"}).json()
    assert [item["id"] for item in matches["items"]] == [first["id"]]
    assert client.get(f"{URL}/{first['id']}", headers=auth).status_code == 200


def test_earlier_turns_load_in_order_and_viewers_can_read_their_own_history(client, auth, llm):
    saved = chat(client, auth)
    for i in range(3):
        assert (
            client.post(
                RUN, headers=auth, json=turn(saved["id"], prompt=f"Revision {i}")
            ).status_code
            == 200
        )
    page = client.get(f"{URL}/{saved['id']}", headers=auth, params={"limit": 1}).json()
    assert page["turns"][0]["sequence"] == 3 and page["next_cursor"] == 3
    earlier = client.get(
        f"{URL}/{saved['id']}", headers=auth, params={"cursor": page["next_cursor"], "limit": 2}
    ).json()
    assert [message["sequence"] for message in earlier["turns"]] == [1, 2]
    assert earlier["next_cursor"] is None
    with SessionLocal.begin() as db:
        db.scalar(select(WorkspaceMembership)).role = "viewer"
    assert client.get(f"{URL}/{saved['id']}", headers=auth).json()["can_continue"] is False
    assert (
        client.post(
            f"{URL}/{saved['id']}/messages",
            headers=auth,
            json={"prompt": "A revision", "request_id": str(uuid4())},
        ).status_code
        == 403
    )


def test_context_cannot_be_swapped_or_account_forged(client, auth, llm):
    assert (
        client.post(
            URL,
            headers=auth,
            json={"title": "Foreign", "platform": "x", "connected_account_id": str(uuid4())},
        ).status_code
        == 404
    )
    saved = chat(client, auth)
    assert (
        client.post(
            RUN, headers=auth, json={**turn(saved["id"]), "platform": "linkedin"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{URL}/{saved['id']}/messages",
            headers=auth,
            json={
                "prompt": "A revision",
                "request_id": str(uuid4()),
                "input_data": {"text": "Another draft"},
            },
        ).status_code
        == 422
    )
    assert not llm.calls


def test_pending_reply_prevents_duplicate_turns(client, auth, llm):
    saved = chat(client, auth)
    with SessionLocal.begin() as db:
        db.get(AssistantConversation, saved["id"]).turn_count = 1
        db.add(
            AssistantTurn(
                conversation_id=saved["id"],
                request_id=str(uuid4()),
                sequence=1,
                prompt="Still working",
                original_text="",
                request_data={},
                response_data={},
                status="running",
                created_at=datetime.now(UTC),
            )
        )
    assert client.post(RUN, headers=auth, json=turn(saved["id"])).status_code == 409
    assert not llm.calls


def test_failed_reply_is_preserved_without_leaking_provider_secrets(client, auth, monkeypatch):
    class FailingLLM:
        async def generate_structured(self, **kwargs):
            raise ValueError("api-secret-must-not-leak")

    monkeypatch.setattr(service, "default_llm_client", FailingLLM())
    saved = chat(client, auth)
    with pytest.raises(ValueError):
        client.post(RUN, headers=auth, json=turn(saved["id"]))
    reopened = client.get(f"{URL}/{saved['id']}", headers=auth).json()
    assert reopened["turns"][0]["status"] == "failed"
    assert "api-secret" not in reopened["turns"][0]["error"]
    assert client.get(URL, headers=auth).json()["items"][0]["id"] == saved["id"]


def test_turn_constraints_have_distinct_postgresql_names():
    from sqlalchemy import UniqueConstraint

    names = [
        constraint.name
        for constraint in AssistantTurn.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    ]
    assert len(names) == 2 and len(set(names)) == 2


def test_disconnected_accounts_keep_history_but_cannot_continue(client, auth, llm):
    from app.modules.channels.models import ConnectedAccount

    with SessionLocal.begin() as db:
        membership = db.scalar(select(WorkspaceMembership))
        account = ConnectedAccount(
            id=str(uuid4()),
            workspace_id=membership.workspace_id,
            platform="x",
            external_account_id="test",
            display_name="Jamie",
            status="active",
        )
        db.add(account)
        account_id = account.id
    saved = client.post(
        URL,
        headers=auth,
        json={"title": "Account history", "platform": "x", "connected_account_id": account_id},
    ).json()
    payload = {**turn(saved["id"]), "connected_account_id": account_id}
    assert client.post(RUN, headers=auth, json=payload).status_code == 200
    with SessionLocal.begin() as db:
        db.get(ConnectedAccount, account_id).status = "disabled"
    reopened = client.get(f"{URL}/{saved['id']}", headers=auth).json()
    assert reopened["turns"] and not reopened["can_continue"]
    assert "Reconnect" in reopened["continue_notice"]
    assert (
        client.post(
            f"{URL}/{saved['id']}/messages",
            headers=auth,
            json={"prompt": "A revision", "request_id": str(uuid4())},
        ).status_code
        == 409
    )
