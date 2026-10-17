"""Process-wide service singletons, injected with FastAPI Depends (tests override them)."""

from functools import lru_cache

from fastapi import Depends

from api.config import settings
from api.services.barcode_check import BarcodeChecker
from api.services.llm import GeminiLLM
from api.services.openfda import OpenFdaClient
from api.services.openfoodfacts import OpenFoodFactsClient
from api.services.summarizer import Summarizer
from api.services.watchlist import WatchlistChecker


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


@lru_cache
def get_openfoodfacts() -> OpenFoodFactsClient:
    return OpenFoodFactsClient()


def get_barcode_checker(
    openfda: OpenFdaClient = Depends(get_openfda),
    openfoodfacts: OpenFoodFactsClient = Depends(get_openfoodfacts),
    summarizer: Summarizer = Depends(get_summarizer),
) -> BarcodeChecker:
    return BarcodeChecker(openfda, openfoodfacts, summarizer)


def get_watchlist_checker(openfda: OpenFdaClient = Depends(get_openfda)) -> WatchlistChecker:
    return WatchlistChecker(openfda)
