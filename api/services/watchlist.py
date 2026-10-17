"""Re-check scanned products against recalls reported recently (guest mode: stateless).

The app sends the products it keeps on the device and the date of its last check. We fetch every recall
reported since then (minus an overlap, because openFDA publishes records days after their report date) and
match each product locally with the same rules as a scan. No product lookups are needed: the app already has
each product's barcode, name and brand from its scan. The app turns matches into alerts on the device.

Recalls are fetched per calendar month, in parallel (no skip-paging through records that share a report
date), and each month is cached and shared by every device. The endpoint needs no login, so the window is
capped (MAX_WINDOW_DAYS) and the cache keeps repeated calls off the shared openFDA quota.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from api.errors import ApiError
from api.models import WatchCheckItem, WatchCheckMatch, WatchCheckResult, to_recall_ref
from api.services.barcode import canonical_barcode, is_valid_gtin
from api.services.cache import TTLCache
from api.services.matching import PreparedRecall, brand_words, classify, name_words, prepare
from api.services.openfda import MAX_SKIP, OpenFdaClient

logger = logging.getLogger("recallguard.watchlist")

# openFDA can publish a record days after its report_date, so look back further than the last check
OVERLAP_DAYS = 14
# Without a last check, look at the last month (each scan already checked everything older)
DEFAULT_WINDOW_DAYS = 30
# This endpoint needs no login, so it looks back at most this far (a device that hasn't opened the app for
# longer misses recalls in between; each scan checks the full 2 years)
MAX_WINDOW_DAYS = 90
PAGE_SIZE = 1000  # openFDA's maximum
PARALLEL_REQUESTS = 4

# Recalls per calendar month ("2026-10"), ready for matching. Shared by every device: a past month rarely
# changes, the current one does weekly. At most 4 months are needed per request, so memory stays bounded.
past_months: TTLCache[list[PreparedRecall]] = TTLCache(maxsize=6, ttl_seconds=6 * 3600)
current_month: TTLCache[list[PreparedRecall]] = TTLCache(maxsize=2, ttl_seconds=10 * 60)


def check_window(since: date | None, today: date) -> date:
    """First report date to check: the last check minus the overlap, at most MAX_WINDOW_DAYS back and never
    later than today (a device clock can be wrong)."""
    oldest = today - timedelta(days=MAX_WINDOW_DAYS)
    start = (since - timedelta(days=OVERLAP_DAYS)) if since else today - timedelta(days=DEFAULT_WINDOW_DAYS)
    return min(max(start, oldest), today)


def months_between(start: date, end: date) -> list[tuple[date, date]]:
    """(first day, last day) of each calendar month from start's month to end's month."""
    months = []
    first = start.replace(day=1)
    while first <= end:
        next_first = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
        months.append((first, next_first - timedelta(days=1)))
        first = next_first
    return months


class WatchlistChecker:
    def __init__(
        self,
        openfda: OpenFdaClient,
        past: TTLCache[list[PreparedRecall]] = past_months,
        current: TTLCache[list[PreparedRecall]] = current_month,
        today: date | None = None,
    ):
        self._openfda = openfda
        self._past = past
        self._current = current
        self._today = today

    async def _fetch(self, start: date, end: date, limit: asyncio.Semaphore) -> list[PreparedRecall]:
        search = f"report_date:[{start:%Y%m%d}+TO+{end:%Y%m%d}]"
        recalls = []
        async with limit:
            for skip in range(0, MAX_SKIP + 1, PAGE_SIZE):
                batch, total = await self._openfda.query(search, limit=PAGE_SIZE, skip=skip)
                recalls += batch
                if len(recalls) >= total or not batch:
                    unique = {r.recall_number: r for r in recalls}
                    return [prepare(r) for r in unique.values()]
        # Over 25,000 records in one month: never seen in practice; fail rather than check part of it
        raise ApiError("upstream_error", "There are too many recalls to check right now. Please try again later.", 502)

    async def _month(self, first: date, last: date, today: date, limit: asyncio.Semaphore) -> list[PreparedRecall]:
        cache = self._current if last >= today else self._past
        key = f"{first:%Y-%m}"
        cached = cache.get(key)
        if cached is None:
            cached = await self._fetch(first, min(last, today), limit)
            cache.set(key, cached)
        return cached

    async def _recalls_between(self, start: date, today: date) -> list[PreparedRecall]:
        limit = asyncio.Semaphore(PARALLEL_REQUESTS)
        months = await asyncio.gather(*(self._month(a, b, today, limit) for a, b in months_between(start, today)))
        floor = start.isoformat()  # report dates are YYYY-MM-DD, so they compare as strings
        unique = {p.recall.recall_number: p for month in months for p in month if p.recall.report_date >= floor}
        return list(unique.values())

    async def check(self, items: list[WatchCheckItem], since: date | None) -> WatchCheckResult:
        today = self._today or date.today()
        start = check_window(since, today)
        checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        if not items:
            return WatchCheckResult(checked_at=checked_at, since=start.isoformat(), matches=[])

        recalls = await self._recalls_between(start, today)
        matches: list[WatchCheckMatch] = []
        for item in {i.id: i for i in items}.values():  # one entry per product id
            upc = canonical_barcode(item.upc) if item.upc else None
            upc = upc if upc and is_valid_gtin(upc) else None
            brand_ws = brand_words(item.brand)
            name_ws = name_words(item.name, brand_ws)
            for prepared in recalls:
                match = classify(prepared, upc=upc, brand_ws=brand_ws, name_ws=name_ws)
                if match:
                    matches.append(
                        WatchCheckMatch(
                            item_id=item.id,
                            recall_number=prepared.recall.recall_number,
                            confidence=match,
                            recall=to_recall_ref(prepared.recall),
                        )
                    )
        logger.info("Watchlist check: %d item(s), %d recall(s) since %s, %d match(es)", len(items), len(recalls), start, len(matches))
        return WatchCheckResult(checked_at=checked_at, since=start.isoformat(), matches=matches)
