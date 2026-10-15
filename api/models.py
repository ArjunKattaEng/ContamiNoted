"""Response models. Field names are snake_case in Python and camelCase in JSON, matching
src/types/index.ts and docs/api-contract.md."""

from typing import Literal

from pydantic import BaseModel, ConfigDict
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
