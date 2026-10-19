"""Response models. Field names are snake_case in Python and camelCase in JSON, matching
src/types/index.ts and docs/api-contract.md."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

RecallStatus = Literal["Ongoing", "Completed", "Terminated"]
Classification = Literal["Class I", "Class II", "Class III"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RecallSummarySections(CamelModel):
    overview: str
    product_details: str
    reason: str
    health_risks: str
    distribution: str
    action_required: str
    additional_info: str
    contact: str


class RecallSummary(CamelModel):
    short_summary: str
    sections: RecallSummarySections | None = None
    generated_at: str
    model: str


class Recall(CamelModel):
    recall_number: str
    event_id: str
    status: RecallStatus
    classification: Classification
    product_description: str
    reason_for_recall: str
    recalling_firm: str
    city: str | None = None
    state: str | None = None
    distribution_pattern: str | None = None
    product_quantity: str | None = None
    code_info: str | None = None
    recall_initiation_date: str
    report_date: str
    voluntary_mandated: str | None = None
    termination_date: str | None = None  # when FDA closed the recall (Terminated recalls only)
    summary: RecallSummary | None = None


class RecallPage(CamelModel):
    items: list[Recall]
    page: int
    page_size: int
    total: int
    has_more: bool


class SummaryMap(CamelModel):
    """recallNumber → short summary, for the recalls that got one."""

    summaries: dict[str, RecallSummary]


class DataSourceStatus(CamelModel):
    source: Literal["openFDA food enforcement"]
    open_fda_last_updated: str
    last_watch_check_at: str | None = None


# ---- Scans -------------------------------------------------------------------------------------------

MatchStatus = Literal["confirmed", "possible", "clear", "error"]


class Product(CamelModel):
    upc: str  # canonical barcode: UPC-A (12 digits) where possible
    name: str
    brand: str | None = None
    size: str | None = None
    category: str | None = None
    image_url: str | None = None
    expiry_date: str | None = None  # YYYY-MM-DD from Open Food Facts, when available


class ScanItem(CamelModel):
    id: str
    raw: str | None = None  # receipt line as printed
    name: str
    brand: str | None = None
    upc: str | None = None
    price: float | None = None
    status: MatchStatus
    recall_numbers: list[str]
    note: str | None = None


class ScanVerdict(CamelModel):
    headline: str
    details: str  # markdown
    next_steps: list[str]


class ScanCounts(CamelModel):
    total: int
    confirmed: int
    possible: int
    clear: int
    error: int


class Scan(CamelModel):
    id: str
    type: Literal["receipt", "barcode"]
    created_at: str
    store: str | None = None
    purchase_date: str | None = None
    total: float | None = None
    product: Product | None = None
    items: list[ScanItem]
    matched_recalls: list[Recall]
    verdict: ScanVerdict | None
    counts: ScanCounts


# ---- Watchlist re-check (guest mode) -------------------------------------------------------------------


class RecallRef(CamelModel):
    """Compact recall snapshot embedded in alerts and saved recalls."""

    recall_number: str
    product_description: str
    classification: Classification
    status: RecallStatus
    report_date: str
    termination_date: str | None = None


def to_recall_ref(recall: Recall) -> RecallRef:
    return RecallRef(
        recall_number=recall.recall_number,
        product_description=recall.product_description,
        classification=recall.classification,
        status=recall.status,
        report_date=recall.report_date,
        termination_date=recall.termination_date,
    )


class WatchCheckItem(CamelModel):
    id: str = Field(min_length=1, max_length=100)
    upc: str | None = Field(default=None, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    brand: str | None = Field(default=None, max_length=200)


class WatchCheckRequest(CamelModel):
    items: list[WatchCheckItem] = Field(max_length=100)
    since: date | None = None  # last check; recalls reported since then (minus an overlap) are checked


class WatchCheckMatch(CamelModel):
    item_id: str
    recall_number: str
    confidence: Literal["confirmed", "possible"]
    recall: RecallRef


class WatchCheckResult(CamelModel):
    checked_at: str
    since: str  # first report date checked (YYYY-MM-DD)
    matches: list[WatchCheckMatch]
