"""Barcode scan: look the product up, find candidate recalls, match them, and write the verdict.

Stateless (guest mode): nothing is stored on the server. The app keeps the returned Scan on the device.
The verdict is written from templates, not by the AI, so a model outage can't change or block a result.

  1. Validate and normalize the barcode (400 invalid_barcode).
  2. In parallel: Open Food Facts (name, brand, size) and openFDA recalls that print this barcode.
  3. With a brand and a name: openFDA recalls that mention every brand word.
  4. classify() each candidate: confirmed (barcode printed) or possible (brand + name), else dropped.

Candidates are recalls still ongoing, or reported in the last MATCH_WINDOW_DAYS. openFDA failing is a 502:
we never answer "no recall found" without having checked. Only complete checks are cached.
"""

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from api.errors import ApiError
from api.models import Product, Recall, Scan, ScanCounts, ScanItem, ScanVerdict
from api.services.barcode import canonical_barcode, format_upc, is_valid_gtin, upc_search_terms
from api.services.cache import TTLCache
from api.services.matching import Match, brand_query_terms, brand_words, classify, name_check_possible, name_words
from api.services.openfda import BRAND_FIELDS, UPC_FIELDS, OpenFdaClient, all_words_query, any_phrase_query, ongoing_or_recent
from api.services.openfoodfacts import OpenFoodFactsClient, ProductLookupError
from api.services.summarizer import Summarizer

logger = logging.getLogger("recallguard.scan")

MATCH_WINDOW_DAYS = 730
MAX_MATCHES = 10
BRAND_QUERY_LIMIT = 300
UNKNOWN_PRODUCT = "Unknown product"
USDA_NOTE = "Meat, poultry and egg products are regulated by the USDA, and their recalls aren’t included yet."

_STATUS_RANK = {"Ongoing": 0, "Completed": 1, "Terminated": 1}
_UPC_MENTION = re.compile(r"\bupc\b", re.IGNORECASE)
_MARKDOWN_SPECIAL = re.compile(r"([\\`*_{}\[\]()#+\-.!<>|~])")


@dataclass(frozen=True)
class CheckResult:
    product: Product | None
    matches: list[tuple[Match, Recall]]
    lookup_failed: bool = False  # Open Food Facts was down, so only the barcode was checked
    complete: bool = True  # every query succeeded; only complete results are cached
    truncated: bool = False  # the brand has more recalls than one search returns; the newest were compared


# Shared by every request in this serverless instance
result_cache: TTLCache[CheckResult] = TTLCache(maxsize=500, ttl_seconds=15 * 60)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _md(text: str) -> str:
    """Escape crowd-sourced text (Open Food Facts names) before it goes into markdown."""
    return _MARKDOWN_SPECIAL.sub(r"\\\1", text)


def _clip(text: str, limit: int = 220) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip(" ,;.") + "…"


def _barcode_label(code: str) -> str:
    return f"UPC {format_upc(code)}" if len(code) == 12 else f"barcode {code}"


def _sort_key(entry: tuple[Match, Recall]) -> tuple[int, int, int]:
    match, recall = entry
    try:
        newest_first = -date.fromisoformat(recall.report_date).toordinal()
    except ValueError:
        newest_first = 0
    # confirmed first, then active recalls, then newest
    return (0 if match == "confirmed" else 1, _STATUS_RANK[recall.status], newest_first)


def build_verdict(result: CheckResult, code: str) -> ScanVerdict:
    product, matches = result.product, result.matches
    barcode = _barcode_label(code)
    confirmed = [r for m, r in matches if m == "confirmed"]
    possible = [r for m, r in matches if m == "possible"]

    if confirmed:
        first = confirmed[0]
        active = any(r.status == "Ongoing" for r in confirmed)
        listed = (
            f"recall **{first.recall_number}** ({first.classification})"
            if len(confirmed) == 1
            else f"{len(confirmed)} recalls, including **{first.recall_number}** ({first.classification})"
        )
        status = (
            "The recall is still active."
            if active
            else "FDA has closed this recall, but recalled packages can still be in kitchens and pantries."
        )
        return ScanVerdict(
            headline="This product is on an FDA recall" if active else "This product was on an FDA recall",
            details=f"Its {barcode} is listed in {listed}. Reason: {_clip(first.reason_for_recall)}\n\n{status}",
            next_steps=[
                "Don’t eat or serve it.",
                "Compare the lot code and dates on your package with the recall notice. Some recalls cover only certain lots.",
                "Return it to the store for a refund, or throw it away.",
            ],
        )

    if possible:
        first = possible[0]
        brand = _md(product.brand) if product and product.brand else "This brand"
        more = f" and {len(possible) - 1} more" if len(possible) > 1 else ""
        lists_upcs = any(_UPC_MENTION.search(t or "") for t in (first.product_description, first.code_info))
        return ScanVerdict(
            headline="Possible recall match",
            details=(
                f"This barcode isn’t listed in any recall we found, but **{brand}** has a recall for a product with a "
                f"similar name: recall **{first.recall_number}**{more}. It may or may not be your product."
                + (" That recall lists specific barcodes, so compare them with the one on your package." if lists_upcs else "")
            ),
            next_steps=[
                "Compare the product name, size, barcode, lot code and dates on your package with the recall notice.",
                "If they match, don’t eat it. Return it to the store or throw it away.",
            ],
        )

    if product is None or not name_check_possible(product.brand, product.name):
        if result.lookup_failed:
            why = "We couldn’t look up this product’s name right now"
        elif product is None:
            why = "We couldn’t find this product’s name"
        elif not product.brand:
            why = f"We found **{_md(product.name)}**, but without its brand"
        else:
            why = f"We found **{_md(product.name)}**, but not enough of its name to compare with recalls"
        return ScanVerdict(
            headline="No recall lists this barcode",
            details=(
                f"{why}, so we could only check its {barcode}. No active FDA food recall, and none from the "
                f"last 2 years, lists it.\n\n{USDA_NOTE}"
            ),
            next_steps=["To be thorough, search Recalls for the product’s brand or name."],
        )

    label = " ".join(dict.fromkeys(filter(None, [product.brand, product.name])))
    scope = (
        f" **{_md(product.brand or '')}** has many recalls, so we compared the newest {BRAND_QUERY_LIMIT} by name."
        if result.truncated
        else ""
    )
    checked = "active FDA food recalls" if result.truncated else "every active FDA food recall"
    return ScanVerdict(
        headline="No FDA recall found",
        details=(
            f"We checked {checked} and those reported in the last 2 years. None lists this "
            f"barcode or matches **{_md(label)}**.{scope}\n\n{USDA_NOTE}"
        ),
        next_steps=[],
    )


def _note(match: Match | None, recall: Recall | None, product: Product | None) -> str | None:
    if match == "confirmed" and recall:
        return f"Barcode listed in recall {recall.recall_number}."
    if match == "possible" and recall:
        brand = product.brand if product and product.brand else "the same brand"
        return f"Similar product from {brand} in recall {recall.recall_number}. Check the details."
    return None


class BarcodeChecker:
    def __init__(
        self,
        openfda: OpenFdaClient,
        openfoodfacts: OpenFoodFactsClient,
        summarizer: Summarizer,
        cache: TTLCache[CheckResult] = result_cache,
        today: date | None = None,
    ):
        self._openfda = openfda
        self._off = openfoodfacts
        self._summarizer = summarizer
        self._cache = cache
        self._today = today

    async def _lookup(self, code: str) -> tuple[Product | None, bool]:
        """(product, lookup_failed). An Open Food Facts outage doesn't fail the scan."""
        try:
            return await self._off.lookup(code), False
        except ProductLookupError:
            return None, True

    async def _brand_hits(self, product: Product) -> tuple[list[Recall], bool]:
        """(recalls mentioning every brand word, truncated)."""
        terms = brand_query_terms(product.brand)
        if not terms:  # callers check name_check_possible() first; never send an empty search
            return [], False
        search = ongoing_or_recent(all_words_query(terms, BRAND_FIELDS), MATCH_WINDOW_DAYS, self._today)
        hits, total = await self._openfda.query(search, limit=BRAND_QUERY_LIMIT)
        if total > len(hits):
            logger.warning("Brand search for %r: %d recalls, compared the newest %d", product.brand, total, len(hits))
        return hits, total > len(hits)

    async def _check(self, code: str) -> CheckResult:
        upc_search = ongoing_or_recent(any_phrase_query(upc_search_terms(code), UPC_FIELDS), MATCH_WINDOW_DAYS, self._today)
        (product, lookup_failed), (upc_hits, _) = await asyncio.gather(
            self._lookup(code),
            self._openfda.query(upc_search, limit=50),
        )
        brand_ws = brand_words(product.brand if product else None)
        name_ws = name_words(product.name if product else None, brand_ws)

        def matches_in(recalls: list[Recall]) -> list[tuple[Match, Recall]]:
            found = []
            for recall in recalls:
                match = classify(recall, upc=code, brand_ws=brand_ws, name_ws=name_ws)
                if match:
                    found.append((match, recall))
            return found

        matches = matches_in(upc_hits)
        complete, truncated = not lookup_failed, False
        if product and name_check_possible(product.brand, product.name):
            try:
                seen = {r.recall_number for _, r in matches}
                brand_hits, truncated = await self._brand_hits(product)
                matches += matches_in([r for r in brand_hits if r.recall_number not in seen])
            except ApiError:
                # A confirmed match stands on its own; without one we can't say "no recall found"
                if not any(m == "confirmed" for m, _ in matches):
                    raise
                logger.warning("Brand search failed for %s; returning the confirmed match", code)
                complete = False
        matches.sort(key=_sort_key)
        logger.info("Scan %s: product=%s, %d match(es)", code, bool(product), len(matches))
        return CheckResult(product, matches[:MAX_MATCHES], lookup_failed=lookup_failed, complete=complete, truncated=truncated)

    async def check(self, raw_code: str) -> Scan:
        code = canonical_barcode(raw_code)
        if not is_valid_gtin(code):
            raise ApiError(
                "invalid_barcode",
                "That doesn’t look like a valid barcode. Check the 8, 12 or 13 digits under the bars.",
                400,
            )
        result = self._cache.get(code)
        if result is None:
            result = await self._check(code)
            if result.complete:
                self._cache.set(code, result)

        best_match, best_recall = result.matches[0] if result.matches else (None, None)
        status = best_match or "clear"
        shown = result.product or Product(upc=code, name=UNKNOWN_PRODUCT)
        # Only the recalls behind the item's status: a confirmed match shouldn't sit next to name-only guesses
        recalls = [r for m, r in result.matches if m == best_match]
        item = ScanItem(
            id=uuid.uuid4().hex,
            name=shown.name,
            brand=shown.brand,
            upc=code,
            status=status,
            recall_numbers=[r.recall_number for r in recalls],
            note=_note(best_match, best_recall, result.product),
        )
        return Scan(
            id=uuid.uuid4().hex,
            type="barcode",
            created_at=_now(),
            product=shown,
            items=[item],
            matched_recalls=[r.model_copy(update={"summary": self._summarizer.cached_short(r)}) for r in recalls],
            verdict=build_verdict(result, code),
            counts=ScanCounts(
                total=1,
                confirmed=int(status == "confirmed"),
                possible=int(status == "possible"),
                clear=int(status == "clear"),
                error=0,
            ),
        )
