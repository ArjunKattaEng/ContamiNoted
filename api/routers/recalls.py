"""Recall endpoints (docs/api-contract.md).

Lists and detail return FDA data immediately, with summaries only when already cached; the app then
asks the summary endpoints, so a slow or overloaded model never holds up the recall itself.

  GET /api/recalls/recent | /search           page of recalls (cached short summaries only)
  GET /api/recalls/summaries?numbers=A,B,…    one-line summaries, generated in one batched model call
  GET /api/recalls/{recallNumber}             one recall (cached full summary only)
  GET /api/recalls/{recallNumber}/summary     full sectioned summary
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response

from api.deps import get_openfda, get_summarizer
from api.errors import ApiError
from api.models import Recall, RecallPage, RecallSummary, SummaryMap
from api.services.openfda import STATUS_SEARCH, OpenFdaClient, search_query
from api.services.summarizer import Summarizer

router = APIRouter(prefix="/api/recalls", tags=["recalls"])

# Shared CDN caching: openFDA updates weekly, so 15 minutes is plenty fresh. Much shorter for
# summary responses that came back incomplete (model overloaded), so a retry can fill them in.
FULL_CACHE = "public, max-age=0, s-maxage=900, stale-while-revalidate=86400"
PARTIAL_CACHE = "public, max-age=0, s-maxage=30"
MAX_SUMMARY_BATCH = 25


def _with_cached_summaries(recalls: list[Recall], summarizer: Summarizer) -> list[Recall]:
    return [r.model_copy(update={"summary": summarizer.cached_short(r)}) for r in recalls]


async def _page(openfda: OpenFdaClient, summarizer: Summarizer, search: str, page: int, page_size: int, response: Response) -> RecallPage:
    recalls, total = await openfda.query(search, limit=page_size, skip=(page - 1) * page_size)
    response.headers["Cache-Control"] = FULL_CACHE
    return RecallPage(
        items=_with_cached_summaries(recalls, summarizer),
        page=page,
        page_size=page_size,
        total=total,
        has_more=page * page_size < total,
    )


@router.get("/recent", response_model=RecallPage, response_model_exclude_none=True)
async def recent(
    response: Response,
    status: Literal["active", "resolved"] = "active",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50, alias="pageSize"),
    openfda: OpenFdaClient = Depends(get_openfda),
    summarizer: Summarizer = Depends(get_summarizer),
) -> RecallPage:
    return await _page(openfda, summarizer, STATUS_SEARCH[status], page, page_size, response)


@router.get("/search", response_model=RecallPage, response_model_exclude_none=True)
async def search(
    response: Response,
    q: str = Query(min_length=2, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50, alias="pageSize"),
    openfda: OpenFdaClient = Depends(get_openfda),
    summarizer: Summarizer = Depends(get_summarizer),
) -> RecallPage:
    return await _page(openfda, summarizer, search_query(q), page, page_size, response)


@router.get("/summaries", response_model=SummaryMap, response_model_exclude_none=True)
async def summaries(
    response: Response,
    numbers: str = Query(min_length=1, max_length=MAX_SUMMARY_BATCH * 16, description="Comma-separated recall numbers"),
    openfda: OpenFdaClient = Depends(get_openfda),
    summarizer: Summarizer = Depends(get_summarizer),
) -> SummaryMap:
    wanted = list(dict.fromkeys(n.strip() for n in numbers.split(",") if n.strip()))
    if not wanted or len(wanted) > MAX_SUMMARY_BATCH:
        raise ApiError("invalid_request", f"Ask for 1 to {MAX_SUMMARY_BATCH} recall numbers.", 400)
    recalls = await openfda.get_many(wanted)
    result = await summarizer.short_summaries(recalls)
    complete = not summarizer.enabled or len(result) == len(recalls)
    response.headers["Cache-Control"] = FULL_CACHE if complete else PARTIAL_CACHE
    return SummaryMap(summaries=result)


@router.get("/{recall_number}", response_model=Recall, response_model_exclude_none=True)
async def get_recall(
    recall_number: str,
    response: Response,
    openfda: OpenFdaClient = Depends(get_openfda),
    summarizer: Summarizer = Depends(get_summarizer),
) -> Recall:
    recall = await openfda.get(recall_number)
    response.headers["Cache-Control"] = FULL_CACHE
    return recall.model_copy(update={"summary": summarizer.cached_full(recall) or summarizer.cached_short(recall)})


@router.get("/{recall_number}/summary", response_model=RecallSummary | None, response_model_exclude_none=True)
async def get_summary(
    recall_number: str,
    response: Response,
    openfda: OpenFdaClient = Depends(get_openfda),
    summarizer: Summarizer = Depends(get_summarizer),
) -> RecallSummary | None:
    """Full summary, or null when summaries are off or the model failed (the app shows the FDA text)."""
    recall = await openfda.get(recall_number)
    summary = await summarizer.full_summary(recall)
    response.headers["Cache-Control"] = FULL_CACHE if summary is not None or not summarizer.enabled else PARTIAL_CACHE
    return summary
