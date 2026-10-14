"""Server-only Resend/SMTP delivery for OTPs and transactional auth links."""

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_email(email, subject, text, html_body, idempotency_key):
    settings = get_settings()
    if settings.resend_api_key:
        try:
            with httpx.Client(timeout=15) as client:
                response = client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": "Bearer " + settings.resend_api_key,
                        "Idempotency-Key": idempotency_key,
                    },
                    json={
                        "from": settings.resend_from_email or settings.mail_from,
                        "to": [email],
                        "subject": subject,
                        "text": text,
                        "html": html_body,
                    },
                )
            if not response.is_success:
                logger.warning("Resend email delivery rejected (HTTP %s)", response.status_code)
                raise HTTPException(503, "Email delivery is temporarily unavailable. Please retry")
            try:
                accepted = isinstance(response.json().get("id"), str)
            except (ValueError, AttributeError):
                accepted = False
            if not accepted:
                raise HTTPException(503, "Email delivery could not be confirmed. Please retry")
        except httpx.HTTPError as exc:
            raise HTTPException(
                503, "Email delivery is temporarily unavailable. Please retry"
            ) from exc
        return
    if not settings.smtp_host:
        if settings.app_env == "test":
            return
        raise HTTPException(503, "Email delivery is not configured")
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = email
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password or "")
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(503, "Email delivery is temporarily unavailable. Please retry") from exc


def deliver_otp(email, code, challenge_id):
    minutes = get_settings().otp_ttl_seconds // 60
    text = f"Your Draftva verification code is {code}. It expires in {minutes} minutes.\n\nIf you did not request this, ignore this email."
    body = f"<h2>Verify your Draftva email</h2><p>Your verification code:</p><p style='font-size:32px;font-weight:700;letter-spacing:8px'>{html.escape(code)}</p><p>Expires in {minutes} minutes. Use the latest code you requested.</p><p>If you did not request this, ignore this email.</p>"
    send_email(email, "Your Draftva verification code", text, body, "verify-" + challenge_id)


def deliver_token(email: str, token: str, purpose: str):
    subject = {
        "verify-email": "Verify your Draftva email",
        "reset-password": "Reset your Draftva password",
        "invitations/accept": "Join a Draftva workspace",
    }[purpose]
    url = (
        get_settings().frontend_url.rstrip("/") + "/" + purpose + "?" + urlencode({"token": token})
    )
    text = (
        "Open this link to continue:\n"
        + url
        + "\n\nIf you did not request this, ignore this message."
    )
    body = f"<h2>{html.escape(subject)}</h2><p><a href='{html.escape(url, quote=True)}'>Continue securely</a></p><p>If you did not request this, ignore this message.</p>"
    from app.core.security import token_hash

    send_email(email, subject, text, body, purpose.replace("/", "-") + "-" + token_hash(token))
