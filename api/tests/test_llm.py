import asyncio
from types import SimpleNamespace

import pytest
from google.genai import errors
from pydantic import BaseModel

from api.services.llm import GeminiLLM


class Out(BaseModel):
    answer: str


class FakeModels:
    """Per-model scripted outcomes for client.aio.models.generate_content."""

    def __init__(self, outcomes: dict):
        self.outcomes = outcomes
        self.calls: list[str] = []

    async def generate_content(self, *, model, contents, config):
        self.calls.append(model)
        outcome = self.outcomes[model]
        if outcome == "hang":
            await asyncio.sleep(10)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def llm_with(outcomes: dict, fallback: str | None = "lite") -> tuple[GeminiLLM, FakeModels]:
    llm = GeminiLLM("key", "main", fallback)
    models = FakeModels(outcomes)
    llm._client = SimpleNamespace(get=lambda: SimpleNamespace(aio=SimpleNamespace(models=models)))
    return llm, models


def server_error(code=503):
    return errors.ServerError(code, {"error": {"code": code, "message": "high demand", "status": "UNAVAILABLE"}})


def ok(answer="ok"):
    return SimpleNamespace(parsed=Out(answer=answer), text=None)


def generate(llm, timeout=5.0):
    return asyncio.run(llm.generate(instructions="i", input="x", schema=Out, timeout_per_model=timeout))


def test_uses_main_model():
    llm, models = llm_with({"main": ok("main"), "lite": ok("lite")})
    result = generate(llm)
    assert (result.value.answer, result.model, models.calls) == ("main", "main", ["main"])


@pytest.mark.parametrize("error", [server_error(503), errors.ClientError(429, {"error": {"code": 429, "message": "rate"}})])
def test_falls_back_when_overloaded(error):
    llm, models = llm_with({"main": error, "lite": ok("lite")})
    result = generate(llm)
    assert (result.value.answer, result.model, models.calls) == ("lite", "lite", ["main", "lite"])


def test_other_errors_are_not_retried():
    llm, models = llm_with({"main": errors.ClientError(400, {"error": {"code": 400, "message": "bad"}}), "lite": ok()})
    with pytest.raises(errors.ClientError):
        generate(llm)
    assert models.calls == ["main"]


def test_without_fallback_the_error_propagates():
    llm, _ = llm_with({"main": server_error()}, fallback=None)
    with pytest.raises(errors.ServerError):
        generate(llm)


def test_parses_text_when_sdk_did_not():
    llm, _ = llm_with({"main": SimpleNamespace(parsed=None, text='{"answer": "from text"}')})
    assert generate(llm).value.answer == "from text"


def test_falls_back_when_main_model_is_too_slow():
    llm, models = llm_with({"main": "hang", "lite": ok("lite")})
    result = generate(llm, timeout=0.05)
    assert (result.model, models.calls) == ("lite", ["main", "lite"])


def test_duplicate_and_empty_models_are_dropped():
    llm = GeminiLLM("key", "a", None, "a", "b")
    assert llm._models == ["a", "b"]
