"""Email notification service using Resend.

Used by the daily cron job (api/routers/cron.py) to notify users of new recalls matching their
category preferences. Requires RESEND_API_KEY in the environment.

This service is inactive until Firebase accounts are live in production (VITE_ACCOUNTS=true).
"""

import logging
from dataclasses import dataclass

from api.config import settings
from api.models import Recall

logger = logging.getLogger("recallguard.email")

APP_URL = "https://www.contaminoted.com"

_client: object | None = None


def _resend():
    global _client
    if _client is None:
        import resend  # noqa: PLC0415
        resend.api_key = settings.resend_api_key
        _client = resend
    return _client


@dataclass
class RecallEmailItem:
    recall: Recall
    category: str


def send_recall_alert(to_email: str, items: list[RecallEmailItem]) -> bool:
    """Send a digest email for one user's category matches. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set; skipping email to %s", to_email)
        return False
    if not items:
        return False

    subject = (
        f"FDA recall alert: {items[0].recall.product_description[:60]}"
        if len(items) == 1
        else f"FDA recall alerts: {len(items)} new recalls matching your preferences"
    )

    rows = "\n".join(
        f"""
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
            <strong style="color:#111827;">{_esc(item.recall.product_description[:120])}</strong><br>
            <span style="color:#6b7280;font-size:13px;">{_esc(item.recall.recalling_firm)} &bull; {item.category} &bull; {item.recall.classification}</span><br>
            <a href="{APP_URL}/recalls/{item.recall.recall_number}"
               style="color:#16a34a;font-size:13px;">View recall &rarr;</a>
          </td>
        </tr>"""
        for item in items
    )

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:24px 16px;">
  <p style="font-size:20px;font-weight:700;color:#111827;margin:0 0 4px;">New FDA recall {_plural("alert", len(items))}</p>
  <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">
    These recalls match food categories you're watching in RecallGuard.
  </p>
  <table style="width:100%;border-collapse:collapse;">{rows}
  </table>
  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
    You're receiving this because you selected recall categories in RecallGuard.
    <a href="{APP_URL}/profile" style="color:#6b7280;">Manage preferences</a>
  </p>
</body>
</html>"""

    try:
        r = _resend()
        r.Emails.send({
            "from": "RecallGuard <onboarding@resend.dev>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info("Sent recall alert email to %s (%d recall(s))", to_email, len(items))
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


def _esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _plural(word: str, n: int) -> str:
    return word if n == 1 else f"{word}s"
