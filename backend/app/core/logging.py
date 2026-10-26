"""Remove credentials from outbound request logs before any handler formats them."""

import logging
import re
import traceback

_CREDENTIAL = re.compile(
    r"(?i)([\"']?(?:access_token|refresh_token|client_secret|client_assertion|"
    r"appsecret_proof|code_verifier|api_key|authorization)[\"']?\s*[:=]\s*)"
    r"(?:\"[^\"]*\"|'[^']*'|[^\s&\"',;})]+)"
)
_AUTHORIZATION = re.compile(r"(?i)\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+")
_OAUTH_QUERY = re.compile(r"(?i)([?&](?:code|state)=)[^\s&\"'<>]+")


def redact_credentials(message: str) -> str:
    message = _AUTHORIZATION.sub(r"\1 [REDACTED]", message)
    # OAuth callback codes/state are secrets too. Match query parameters only so
    # numeric provider diagnostics such as "code=190" remain useful in logs.
    message = _OAUTH_QUERY.sub(r"\1[REDACTED]", message)
    return _CREDENTIAL.sub(r"\1[REDACTED]", message)


def configure_safe_logging() -> None:
    """Protect propagated HTTP/client logs in both API and worker processes."""
    previous_factory = logging.getLogRecordFactory()
    if getattr(previous_factory, "redacts_credentials", False):
        return

    def safe_factory(*args, **kwargs):
        record = previous_factory(*args, **kwargs)
        record.msg = redact_credentials(record.getMessage())
        record.args = ()
        if record.exc_info:
            record.exc_text = redact_credentials(
                "".join(traceback.format_exception(*record.exc_info))
            )
            record.exc_info = None
        return record

    safe_factory.redacts_credentials = True
    logging.setLogRecordFactory(safe_factory)
