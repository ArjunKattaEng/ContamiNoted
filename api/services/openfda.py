"""openFDA food enforcement client (https://open.fda.gov/apis/food/enforcement/).

Query building and record normalization are pure functions so they can be unit-tested against
real response fixtures. Request handling follows the old food-recall-pipeline's data_fetcher.py.
"""

import logging
import re
from typing import Any, Literal
from urllib.parse import quote

import httpx

from api.errors import ApiError
from api.models import Recall
from api.services.loop import PerLoop

logger = logging.getLogger("recallguard.openfda")

FOOD_ENFORCEMENT_URL = "https://api.fda.gov/food/enforcement.json"
MAX_SKIP = 25_000  # openFDA rejects larger skip values

# openFDA treats "+" (space) as OR and "+AND+" as AND
STATUS_SEARCH: dict[str, str] = {
    "active": 'status:"Ongoing"',
    "resolved": 'status:("Completed"+"Terminated")',
}

SEARCH_FIELDS = ("product_description", "recalling_firm", "reason_for_recall")


def search_query(q: str) -> str:
    """Every word must appear in the product description, firm or reason (up to 6 words)."""
    words = re.findall(r"[a-z0-9]+", q.lower())[:6]
    if not words:
        raise ApiError("invalid_request", "Search for a product, brand or hazard.", 400)
    clauses = ["(" + "+".join(f'{field}:"{word}"' for field in SEARCH_FIELDS) + ")" for word in words]
    return "+AND+".join(clauses)


def recall_number_query(recall_number: str) -> str:
    if not re.fullmatch(r"[A-Z]-\d{3,5}-\d{4}", recall_number):
        raise ApiError("not_found", "We couldn’t find that recall.", 404)
    return f'recall_number:"{recall_number}"'


def recall_numbers_query(recall_numbers: list[str]) -> str:
    valid = [n for n in dict.fromkeys(recall_numbers) if re.fullmatch(r"[A-Z]-\d{3,5}-\d{4}", n)]
    if not valid:
        raise ApiError("invalid_request", "Give at least one valid recall number.", 400)
    return "recall_number:(" + "+".join(f'"{n}"' for n in valid) + ")"


def build_url(search: str | None, *, limit: int, skip: int = 0, sort: str | None = "report_date:desc", api_key: str | None = None) -> str:
    # Build the query string by hand: openFDA needs "+" kept literal (it is the OR/AND separator)
    params: list[tuple[str, str]] = []
    if search:
        params.append(("search", search))
    if sort:
        params.append(("sort", sort))
    params += [("limit", str(limit)), ("skip", str(skip))]
    if api_key:
        params.append(("api_key", api_key))
    return FOOD_ENFORCEMENT_URL + "?" + "&".join(f"{k}={quote(v, safe=':+()[]')}" for k, v in params)


def _date(value: str | None) -> str | None:
    """openFDA YYYYMMDD → YYYY-MM-DD."""
    if not value or not re.fullmatch(r"\d{8}", value):
        return None
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def _status(value: str | None) -> Literal["Ongoing", "Completed", "Terminated"]:
    if value in ("Completed", "Terminated"):
        return value  # type: ignore[return-value]
    return "Ongoing"  # "Ongoing" and the occasional "Pending"


def _classification(value: str | None) -> Literal["Class I", "Class II", "Class III"]:
    return value if value in ("Class I", "Class II", "Class III") else "Class III"  # type: ignore[return-value]


def _clean(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def normalize(record: dict[str, Any]) -> Recall:
    """openFDA enforcement record → contract Recall (no summary)."""
    code_info = " ".join(filter(None, [_clean(record.get("code_info")), _clean(record.get("more_code_info"))])) or None
    initiated = _date(record.get("recall_initiation_date"))
    reported = _date(record.get("report_date")) or initiated or ""
    return Recall(
        recall_number=record.get("recall_number", ""),
        event_id=str(record.get("event_id", "")),
        status=_status(record.get("status")),
        classification=_classification(record.get("classification")),
        product_description=_clean(record.get("product_description")) or "Product description not provided",
        reason_for_recall=_clean(record.get("reason_for_recall")) or "Reason not provided",
        recalling_firm=_clean(record.get("recalling_firm")) or "Unknown firm",
        city=_clean(record.get("city")),
        state=_clean(record.get("state")),
        distribution_pattern=_clean(record.get("distribution_pattern")),
        product_quantity=_clean(record.get("product_quantity")),
        code_info=code_info,
        recall_initiation_date=initiated or reported,
        report_date=reported,
        voluntary_mandated=_clean(record.get("voluntary_mandated")),
    )


class OpenFdaClient:
    def __init__(self, api_key: str | None = None, http: httpx.AsyncClient | None = None):
        self._api_key = api_key
        self._http = PerLoop(lambda: http or httpx.AsyncClient(timeout=httpx.Timeout(15.0)))

    async def query(self, search: str | None, *, limit: int, skip: int = 0, sort: str | None = "report_date:desc") -> tuple[list[Recall], int]:
        """Returns (recalls, total matches). No matches is an empty list, not an error."""
        if skip > MAX_SKIP:
            return [], 0
        url = build_url(search, limit=limit, skip=skip, sort=sort, api_key=self._api_key)
        try:
            response = await self._http.get().get(url)
        except httpx.HTTPError as exc:
            logger.warning("openFDA request failed: %s", exc)
            raise ApiError("upstream_error", "The FDA recall service isn’t responding. Please try again.", 502) from exc

        if response.status_code == 404:
            return [], 0  # openFDA answers "no matches" with 404 NOT_FOUND
        if response.status_code == 429:
            raise ApiError("upstream_error", "The FDA recall service is busy. Please try again in a minute.", 502)
        if response.status_code >= 400:
            logger.warning("openFDA %s for %s: %s", response.status_code, url, response.text[:300])
            raise ApiError("upstream_error", "The FDA recall service returned an error.", 502)

        body = response.json()
        results = [normalize(r) for r in body.get("results", [])]
        total = int(body.get("meta", {}).get("results", {}).get("total", len(results)))
        return results, total

    async def get_many(self, recall_numbers: list[str]) -> list[Recall]:
        """Recalls for the given numbers (unknown ones are simply missing), in one request."""
        results, _ = await self.query(recall_numbers_query(recall_numbers), limit=min(len(recall_numbers), 50), sort=None)
        return results

    async def get(self, recall_number: str) -> Recall:
        results, _ = await self.query(recall_number_query(recall_number), limit=1, sort=None)
        if not results:
            raise ApiError("not_found", "We couldn’t find that recall.", 404)
        return results[0]
