"""Consumer-friendly recall summaries via an LLM with structured output (Gemini, see llm.py).

Prompt adapted from food-recall-pipeline/src/summarizer/utils/prompt_builder.py (same sections,
grounded in the openFDA record only). Summaries are optional: with no GEMINI_API_KEY, or on any
model error or timeout, callers get None and the app shows the FDA text instead.
"""

import json
import logging
from datetime import datetime, timezone

from pydantic import BaseModel

from api.models import Recall, RecallSummary, RecallSummarySections
from api.services.cache import TTLCache
from api.services.llm import StructuredLLM

logger = logging.getLogger("recallguard.summarizer")

FDA_RECALLS_URL = "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts"

SYSTEM_PROMPT = f"""You are a food safety analyst writing clear, consumer-friendly summaries of FDA food recalls.
Use ONLY facts present in the recall data you are given. Never invent product names, codes, dates, states,
phone numbers, websites, illnesses or injuries. If something isn't in the data, leave it out.
Write plain American English for a general audience. Match the tone to the severity: FDA Class I is the most serious.
Formatting: Markdown only (short paragraphs, "- " bullet lists, **bold** for key facts). No headings, no emojis,
no code fences. The fixed FDA reference link is {FDA_RECALLS_URL}."""

SHORT_INSTRUCTIONS = """For EACH recall, write one sentence of about 20–25 words that names the company, the product,
and the primary reason for the recall. No lists, quotes or emojis. Return one item per recall, using its exact
recall_number."""

FULL_INSTRUCTIONS = f"""Summarize this recall for a consumer. Fill every field:
- short_summary: one sentence (~20–25 words) naming the company, the product and the primary reason.
- overview: 2–3 sentences: what is recalled, by whom, why, whether it is ongoing or closed, and what the FDA class means.
- product_details: bullet list of product name, sizes/packaging, and the codes/UPCs/lots/dates to check, if present.
- reason: plain-language explanation of the problem.
- health_risks: who is at risk and what symptoms to watch for; say who is NOT at risk when relevant (e.g. allergens).
- distribution: where it was sold ("nationwide" means across the U.S.; otherwise name the states or regions given).
- action_required: bullet list of concrete steps (stop using, check codes, return or dispose, contact a doctor if symptoms).
- additional_info: bullet list of recall number, event ID, initiation date, report date, classification, status and voluntary/mandated.
- contact: the firm name and city/state; add phone, email or website ONLY if present in the data; end with "Reference: [FDA Recalls, Market Withdrawals & Safety Alerts]({FDA_RECALLS_URL})"."""


class _ShortItem(BaseModel):
    recall_number: str
    short_summary: str


class _ShortBatch(BaseModel):
    items: list[_ShortItem]


class _FullSummary(BaseModel):
    short_summary: str
    overview: str
    product_details: str
    reason: str
    health_risks: str
    distribution: str
    action_required: str
    additional_info: str
    contact: str


def recall_facts(recall: Recall) -> dict[str, str]:
    """The fields the model may use, trimmed to save tokens (cf. optimize_recall_data in the old pipeline)."""
    data = recall.model_dump(exclude={"summary"}, exclude_none=True)
    data["firm_location"] = ", ".join(filter(None, [recall.city, recall.state]))
    return {k: v for k, v in data.items() if v not in (None, "")}


def _describe(exc: BaseException) -> str:
    return "timed out" if isinstance(exc, TimeoutError) else (str(exc) or type(exc).__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key(recall: Recall) -> str:
    return f"{recall.recall_number}:{recall.report_date}:{recall.status}"


class Summarizer:
    def __init__(self, full_llm: StructuredLLM | None, short_llm: StructuredLLM | None = None):
        """`short_llm` (one-line batches, a fast model first) defaults to `full_llm`."""
        self._llm = full_llm
        self._short_llm = short_llm or full_llm
        self._short: TTLCache[tuple[str, str]] = TTLCache()  # (short summary, model)
        self._full: TTLCache[RecallSummary] = TTLCache(maxsize=500)

    @property
    def enabled(self) -> bool:
        return self._llm is not None

    def cached_short(self, recall: Recall) -> RecallSummary | None:
        hit = self._short.get(_key(recall))
        if hit is None:
            full = self._full.get(_key(recall))
            hit = (full.short_summary, full.model) if full else None
        if hit is None:
            return None
        text, model = hit
        return RecallSummary(short_summary=text, generated_at=_now(), model=model) if text else None

    def cached_full(self, recall: Recall) -> RecallSummary | None:
        return self._full.get(_key(recall))

    async def short_summaries(self, recalls: list[Recall], timeout_per_model: float = 12.0) -> dict[str, RecallSummary]:
        """One batched model call for every recall without a cached short summary."""
        result = {r.recall_number: s for r in recalls if (s := self.cached_short(r))}
        missing = [r for r in recalls if r.recall_number not in result]
        if not missing or not self._short_llm:
            return result
        try:
            generated = await self._short_llm.generate(
                instructions=SYSTEM_PROMPT + "\n\n" + SHORT_INSTRUCTIONS,
                input=json.dumps([recall_facts(r) for r in missing], ensure_ascii=False),
                schema=_ShortBatch,
                timeout_per_model=timeout_per_model,
            )
        except Exception as exc:  # summaries are optional; never fail the request
            logger.warning("short summaries failed (%d recalls): %s", len(missing), _describe(exc))
            return result
        if generated is None:
            return result
        by_number = {r.recall_number: r for r in missing}
        for item in generated.value.items:
            recall = by_number.get(item.recall_number)
            text = item.short_summary.strip()
            if recall and text:
                self._short.set(_key(recall), (text, generated.model))
                result[recall.recall_number] = RecallSummary(short_summary=text, generated_at=_now(), model=generated.model)
        return result

    async def full_summary(self, recall: Recall, timeout_per_model: float = 20.0) -> RecallSummary | None:
        cached = self._full.get(_key(recall))
        if cached or not self._llm:
            return cached
        try:
            generated = await self._llm.generate(
                instructions=SYSTEM_PROMPT + "\n\n" + FULL_INSTRUCTIONS,
                input=json.dumps(recall_facts(recall), ensure_ascii=False),
                schema=_FullSummary,
                timeout_per_model=timeout_per_model,
            )
        except Exception as exc:
            logger.warning("full summary failed for %s: %s", recall.recall_number, _describe(exc))
            return None
        if generated is None:
            return None
        out = generated.value
        summary = RecallSummary(
            short_summary=out.short_summary.strip(),
            sections=RecallSummarySections(**out.model_dump(exclude={"short_summary"})),
            generated_at=_now(),
            model=generated.model,
        )
        self._full.set(_key(recall), summary)
        self._short.set(_key(recall), (summary.short_summary, summary.model))
        return summary
