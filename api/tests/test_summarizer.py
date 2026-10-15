import asyncio
import json

from api.services.llm import Generated
from api.services.summarizer import Summarizer, _FullSummary, _ShortBatch, _ShortItem, recall_facts


class FakeLLM:
    """Stands in for GeminiLLM: records calls, returns a fixed or computed parsed result."""

    model = "fake-model"

    def __init__(self, output=None, error: Exception | None = None):
        self.output = output
        self.error = error
        self.calls: list[dict] = []

    async def generate(self, *, instructions, input, schema, timeout_per_model):
        self.calls.append({"instructions": instructions, "input": input, "schema": schema})
        if self.error:
            raise self.error
        out = self.output(input) if callable(self.output) else self.output
        return Generated(out, self.model) if out is not None else None


def short_for_all(input: str) -> _ShortBatch:
    return _ShortBatch(
        items=[_ShortItem(recall_number=r["recall_number"], short_summary=f"Summary of {r['recall_number']}") for r in json.loads(input)]
    )


def test_disabled_without_llm(recalls):
    s = Summarizer(None)
    assert not s.enabled
    assert asyncio.run(s.short_summaries(recalls)) == {}
    assert asyncio.run(s.full_summary(recalls[0])) is None


def test_short_summaries_are_batched_and_cached(recalls):
    llm = FakeLLM(short_for_all)
    s = Summarizer(llm)
    first = asyncio.run(s.short_summaries(recalls[:5]))
    assert len(llm.calls) == 1 and llm.calls[0]["schema"] is _ShortBatch
    summary = first[recalls[0].recall_number]
    assert summary.short_summary == f"Summary of {recalls[0].recall_number}" and summary.model == "fake-model"
    # Cached: only the new recalls go to the model
    asyncio.run(s.short_summaries(recalls[:7]))
    assert len(llm.calls) == 2
    assert {r["recall_number"] for r in json.loads(llm.calls[1]["input"])} == {r.recall_number for r in recalls[5:7]}


def test_ignores_unknown_recall_numbers_from_the_model(recalls):
    llm = FakeLLM(_ShortBatch(items=[_ShortItem(recall_number="X-1-2026", short_summary="made up")]))
    assert asyncio.run(Summarizer(llm).short_summaries(recalls[:2])) == {}


def test_model_errors_degrade_to_no_summary(recalls):
    s = Summarizer(FakeLLM(error=RuntimeError("quota exceeded")))
    assert asyncio.run(s.short_summaries(recalls[:3])) == {}
    assert asyncio.run(s.full_summary(recalls[0])) is None


def test_empty_model_output_is_no_summary(recalls):
    assert asyncio.run(Summarizer(FakeLLM(None)).full_summary(recalls[0])) is None


def test_full_summary_maps_sections_and_seeds_short_cache(recalls):
    out = _FullSummary(
        short_summary="One sentence.",
        overview="o",
        product_details="p",
        reason="r",
        health_risks="h",
        distribution="d",
        action_required="a",
        additional_info="i",
        contact="c",
    )
    llm = FakeLLM(out)
    s = Summarizer(llm)
    summary = asyncio.run(s.full_summary(recalls[0]))
    assert summary and summary.sections and summary.sections.action_required == "a"
    assert summary.model_dump(by_alias=True)["sections"]["healthRisks"] == "h"
    # Second request is served from cache, and the short summary comes for free
    assert asyncio.run(s.full_summary(recalls[0])) == summary
    assert asyncio.run(s.short_summaries([recalls[0]]))[recalls[0].recall_number].short_summary == "One sentence."
    assert len(llm.calls) == 1


def test_prompt_contains_only_record_facts(recalls):
    facts = recall_facts(recalls[0])
    assert "summary" not in facts
    assert facts["recall_number"] == recalls[0].recall_number
    assert all(v not in (None, "") for v in facts.values())


def test_summary_records_the_model_that_answered(recalls):
    class FallbackLLM(FakeLLM):
        async def generate(self, *, instructions, input, schema, timeout_per_model):
            return Generated(short_for_all(input), "fallback-model")

    summaries = asyncio.run(Summarizer(FallbackLLM()).short_summaries(recalls[:2]))
    assert {s.model for s in summaries.values()} == {"fallback-model"}


def test_one_liners_use_the_short_model(recalls):
    full, fast = FakeLLM(None), FakeLLM(short_for_all)
    s = Summarizer(full, fast)
    assert len(asyncio.run(s.short_summaries(recalls[:2]))) == 2
    assert (len(full.calls), len(fast.calls)) == (0, 1)
