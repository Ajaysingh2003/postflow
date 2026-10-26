import logging

import httpx
import pytest

from app.core.logging import configure_safe_logging, redact_credentials


@pytest.mark.parametrize(
    "message, secrets",
    [
        (
            "https://graph.threads.net/container?fields=status&access_token=test_query_secret",
            ["test_query_secret"],
        ),
        (
            '{"access_token": "test_access_secret", "refresh_token": "test_refresh_secret"}',
            ["test_access_secret", "test_refresh_secret"],
        ),
        ("Authorization: Bearer test_bearer_secret", ["test_bearer_secret"]),
        ("Authorization: Basic test_basic_secret", ["test_basic_secret"]),
        ("client_secret=test_client_secret&grant_type=refresh_token", ["test_client_secret"]),
        (
            "https://api.example/callback?code=test_oauth_code&state=test_oauth_state",
            ["test_oauth_code", "test_oauth_state"],
        ),
    ],
)
def test_credentials_are_removed_without_hiding_request_context(message, secrets):
    safe = redact_credentials(message)
    for secret in secrets:
        assert secret not in safe
    assert "[REDACTED]" in safe


def test_oauth_query_redaction_preserves_numeric_provider_diagnostics():
    message = "Threads OAuth rejected http_status=400 code=190 subcode=42"
    assert redact_credentials(message) == message


@pytest.mark.anyio
async def test_httpx_query_token_is_redacted_in_actual_log_record(caplog):
    configure_safe_logging()
    configure_safe_logging()  # API/worker initialization is safe to repeat.
    with caplog.at_level(logging.INFO, logger="httpx"):
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(200))
        ) as client:
            await client.get(
                "https://graph.threads.net/test-container",
                params={"fields": "status", "access_token": "test_threads_secret"},
            )
    assert "test_threads_secret" not in caplog.text
    assert "/test-container" in caplog.text
    assert "200 OK" in caplog.text
    assert "[REDACTED]" in caplog.text


def test_exception_trace_and_parameterized_logs_do_not_expose_tokens(caplog):
    configure_safe_logging()
    logger = logging.getLogger("test.provider")
    with caplog.at_level(logging.ERROR, logger=logger.name):
        try:
            raise ValueError("https://provider.example/status?access_token=test_trace_secret")
        except ValueError:
            logger.exception("Request failed: %s", "refresh_token=test_log_secret")
    assert "test_trace_secret" not in caplog.text
    assert "test_log_secret" not in caplog.text
    assert "ValueError" in caplog.text
    assert "Traceback" in caplog.text
