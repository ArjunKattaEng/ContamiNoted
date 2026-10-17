"""Scan endpoints (docs/api-contract.md).

  POST /api/scan/barcode   { "code": "012345678905" } → Scan

Guest mode: stateless. The scan isn't stored on the server; the app keeps it on the device.
"""

from fastapi import APIRouter, Depends, Response
from pydantic import Field

from api.deps import get_barcode_checker
from api.models import CamelModel, Scan
from api.services.barcode_check import BarcodeChecker

router = APIRouter(prefix="/api/scan", tags=["scan"])


class BarcodeRequest(CamelModel):
    code: str = Field(min_length=1, max_length=40, description="Barcode digits as scanned or typed")


@router.post("/barcode", response_model=Scan, response_model_exclude_none=True)
async def scan_barcode(
    body: BarcodeRequest,
    response: Response,
    checker: BarcodeChecker = Depends(get_barcode_checker),
) -> Scan:
    response.headers["Cache-Control"] = "no-store"
    return await checker.check(body.code)
