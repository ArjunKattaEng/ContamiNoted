"""Structured-output LLM access behind a small interface, so the summarizer doesn't depend on a vendor.

Current provider: Google Gemini (google-genai SDK). It parses output straight into a Pydantic model via
`response_schema`, replacing the old "return JSON" prompt + truncation repair.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Generic, Protocol, TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from api.services.loop import PerLoop

logger = logging.getLogger("recallguard.llm")

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class Generated(Generic[T]):
    value: T
    model: str  # the model that actually answered (may be the fallback)


class StructuredLLM(Protocol):
    async def generate(
        self, *, instructions: str, input: str, schema: type[T], timeout_per_model: float
    ) -> Generated[T] | None:
        """The model's answer parsed into `schema`, or None if it produced nothing usable."""
        ...


def _overloaded(exc: BaseException) -> bool:
    """Capacity problems worth retrying on another model: timeouts, 5xx (e.g. 503 "high demand"), 429 rate limits."""
    return (
        isinstance(exc, (TimeoutError, errors.ServerError))
        or (isinstance(exc, errors.ClientError) and exc.code == 429)
    )


class GeminiLLM:
    def __init__(self, api_key: str, *models: str | None):
        """`models` in order of preference; later ones are fallbacks."""
        self._models = list(dict.fromkeys(m for m in models if m))
        # The SDK's async client holds connections bound to an event loop
        self._client = PerLoop(lambda: genai.Client(api_key=api_key))

    async def generate(
        self, *, instructions: str, input: str, schema: type[T], timeout_per_model: float
    ) -> Generated[T] | None:
        """Try each model in turn, giving each `timeout_per_model` seconds; overloaded or slow → next model."""
        config = types.GenerateContentConfig(
            system_instruction=instructions,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.2,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        for i, model in enumerate(self._models):
            try:
                response = await asyncio.wait_for(
                    self._client.get().aio.models.generate_content(model=model, contents=input, config=config),
                    timeout=timeout_per_model,
                )
            except Exception as exc:
                if _overloaded(exc) and i + 1 < len(self._models):
                    reason = "timed out" if isinstance(exc, TimeoutError) else f"error {getattr(exc, 'code', '?')}"
                    logger.info("%s %s; falling back to %s", model, reason, self._models[i + 1])
                    continue
                raise
            parsed = response.parsed
            if not isinstance(parsed, schema):
                parsed = schema.model_validate_json(response.text) if response.text else None
            return Generated(parsed, model) if parsed is not None else None
        return None
