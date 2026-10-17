"""Watchlist re-check (docs/api-contract.md).

  POST /api/watchlist/check   { "items": [{ id, upc?, name, brand? }], "since"?: "YYYY-MM-DD" } → WatchCheckResult

Guest mode: stateless. The app sends the products it keeps on the device and turns matches into alerts.
"""

from fastapi import APIRouter, Depends, Response

from api.deps import get_watchlist_checker
from api.models import WatchCheckRequest, WatchCheckResult
from api.services.watchlist import WatchlistChecker

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.post("/check", response_model=WatchCheckResult, response_model_exclude_none=True)
async def check_watchlist(
    body: WatchCheckRequest,
    response: Response,
    checker: WatchlistChecker = Depends(get_watchlist_checker),
) -> WatchCheckResult:
    response.headers["Cache-Control"] = "no-store"
    return await checker.check(body.items, body.since)
