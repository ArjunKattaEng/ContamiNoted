"""GET /api/meta/data-source (docs/api-contract.md): where recall data comes from and how fresh it is."""

from fastapi import APIRouter, Depends, Response

from api.deps import get_openfda
from api.models import DataSourceStatus
from api.services.openfda import OpenFdaClient

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/data-source", response_model=DataSourceStatus, response_model_exclude_none=True)
async def data_source(response: Response, openfda: OpenFdaClient = Depends(get_openfda)) -> DataSourceStatus:
    # lastWatchCheckAt is per user and arrives with accounts/alerts
    response.headers["Cache-Control"] = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    return DataSourceStatus(source="openFDA food enforcement", open_fda_last_updated=await openfda.last_updated() or "")
