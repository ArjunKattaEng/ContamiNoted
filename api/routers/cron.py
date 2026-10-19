"""Vercel Cron endpoint: daily recall notification emails.

GET /api/cron/notify-recalls is called by Vercel Cron at 09:00 UTC each day (vercel.json).
Vercel sets Authorization: Bearer <CRON_SECRET> automatically; we verify it.

This endpoint is INACTIVE until Firebase accounts are live in production (VITE_ACCOUNTS=true set in
Vercel Production). Until then, the Firestore Admin SDK has no users to query and the function
returns immediately. Set CRON_SECRET and RESEND_API_KEY in Vercel env vars to activate.

Flow:
  1. Fetch yesterday's new active recalls from openFDA.
  2. For each recall with a category, query Firestore for users who want that category.
  3. Deduplicate per user (one digest per user, even if they match multiple categories).
  4. Send email via Resend; log counts.
"""

import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request

from api.config import settings
from api.deps import get_openfda
from api.services.categories import CATEGORY_IDS
from api.services.email import RecallEmailItem, send_recall_alert
from api.services.openfda import OpenFdaClient, STATUS_SEARCH, within_days

logger = logging.getLogger("recallguard.cron")

router = APIRouter()

_firebase_app: object | None = None


def _get_db():
    """Lazily initialize the Firebase Admin SDK and return the Firestore client."""
    global _firebase_app
    if _firebase_app is None:
        import firebase_admin  # noqa: PLC0415
        from firebase_admin import credentials, firestore  # noqa: PLC0415
        if not settings.firebase_service_account_json:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not set")
        cred_data = json.loads(settings.firebase_service_account_json)
        cred = credentials.Certificate(cred_data)
        _firebase_app = firebase_admin.initialize_app(cred)
    from firebase_admin import firestore  # noqa: PLC0415
    return firestore.client()


def _check_secret(request: Request) -> None:
    if not settings.cron_secret:
        raise HTTPException(status_code=403, detail="CRON_SECRET not configured")
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {settings.cron_secret}":
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/api/cron/notify-recalls")
async def notify_recalls(
    request: Request,
    openfda: OpenFdaClient = Depends(get_openfda),
    days: int = 1,
) -> dict:
    _check_secret(request)

    if not settings.firebase_service_account_json:
        logger.info("Cron: FIREBASE_SERVICE_ACCOUNT_JSON not set; accounts not live yet — skipping")
        return {"status": "skipped", "reason": "accounts_not_live"}

    if not settings.resend_api_key:
        logger.warning("Cron: RESEND_API_KEY not set; cannot send emails")
        return {"status": "skipped", "reason": "resend_not_configured"}

    # Cap the lookback window (the ?days param is only for manual testing)
    lookback = max(1, min(days, 30))

    # Fetch new active recalls in the lookback window
    today = date.today()
    yesterday = today - timedelta(days=1)
    search = within_days(STATUS_SEARCH["active"], lookback, today=today)
    recalls, _ = await openfda.query(search, limit=200, sort="report_date:desc")
    categorized = [r for r in recalls if r.category]
    logger.info("Cron: %d new recalls, %d with a category", len(recalls), len(categorized))

    if not categorized:
        return {"status": "ok", "recalls": 0, "emails_sent": 0}

    # For each category, find users who subscribed to it
    try:
        db = _get_db()
    except Exception as exc:
        logger.error("Cron: Firebase init failed: %s", exc)
        raise HTTPException(status_code=500, detail="Firebase unavailable") from exc

    # Build a per-user list of matching recalls (deduplicates across categories)
    user_items: dict[str, tuple[str, list[RecallEmailItem]]] = {}  # uid → (email, items)
    for category in CATEGORY_IDS:
        cat_recalls = [r for r in categorized if r.category == category]
        if not cat_recalls:
            continue
        try:
            docs = db.collection("users").where("prefs.notifyCategories", "array_contains", category).stream()
            for user_doc in docs:
                data = user_doc.to_dict() or {}
                email = data.get("email")
                uid = data.get("uid", user_doc.id)
                if not email:
                    continue
                if uid not in user_items:
                    user_items[uid] = (email, [])
                user_items[uid][1].extend(
                    RecallEmailItem(recall=r, category=category) for r in cat_recalls
                )
        except Exception as exc:
            logger.error("Cron: Firestore query for category %s failed: %s", category, exc)

    emails_sent = 0
    for uid, (email, items) in user_items.items():
        if send_recall_alert(email, items):
            emails_sent += 1

    logger.info("Cron: notified %d user(s) for %s", emails_sent, yesterday)
    return {"status": "ok", "recalls": len(categorized), "emails_sent": emails_sent}
