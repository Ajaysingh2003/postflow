"""Configured email delivery for verification and password-reset links."""

import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import HTTPException

from app.core.config import get_settings


def deliver_token(email: str, token: str, purpose: str):
    settings = get_settings()
    if not settings.smtp_host:
        if settings.debug:
            return
        raise HTTPException(503, "Email delivery is not configured")
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = email
    message["Subject"] = {
        "verify-email": "Verify your postflow email",
        "reset-password": "Reset your postflow password",
        "invitations/accept": "Join a postflow workspace",
    }[purpose]
    url = settings.frontend_url.rstrip("/") + "/" + purpose + "?" + urlencode({"token": token})
    message.set_content(
        "Open this link to continue:\n"
        + url
        + "\n\nIf you did not request this, ignore this message."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password or "")
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(503, "Email delivery is temporarily unavailable") from exc
