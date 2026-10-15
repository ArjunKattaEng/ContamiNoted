"""Process-wide service singletons, injected with FastAPI Depends (tests override them)."""

from functools import lru_cache

from api.config import settings
from api.services.llm import GeminiLLM
from api.services.openfda import OpenFdaClient
from api.services.summarizer import Summarizer


@lru_cache
def get_openfda() -> OpenFdaClient:
    return OpenFdaClient(api_key=settings.openfda_api_key)


@lru_cache
def get_summarizer() -> Summarizer:
    key = settings.gemini_api_key
    if not key:
        return Summarizer(None)
    main, fallback = settings.gemini_model, settings.gemini_fallback_model
    # Full summaries: the stronger model first. One-liners: the fast model first.
    return Summarizer(GeminiLLM(key, main, fallback), GeminiLLM(key, fallback, main))
