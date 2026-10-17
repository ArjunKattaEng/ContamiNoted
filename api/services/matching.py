"""Deterministic recall matching for a scanned product (the AI never decides a match status).

- confirmed: the product's barcode is printed in the recall (description or codes).
- possible:  same brand, and the product name's words appear in the recall description. Needs both a
             brand and a name: either alone matches far too much ("whole milk", every recall of a brand).
             This includes recalls that list other UPCs: the printed form could differ from ours, and a
             missed recall is worse than a "check this" prompt.
- None:      no match.

The name rule is ported from the removed mock layer (src/mocks/matching.ts in git history): every
meaningful word for names of 1–2 words, at least half for longer ones.
"""

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

from api.models import Recall
from api.services.barcode import PrintedNumbers, barcode_printed, printed_numbers

Match = Literal["confirmed", "possible"]

# Words that say nothing about which product it is
NAME_STOPWORDS = frozenset(
    "the and with for from pack count size each fl ct pk gal lb lbs org organic fresh natural new "
    "original flavor flavored style brand family value".split()
)
# Words in brand names that say nothing about which company it is
BRAND_STOPWORDS = frozenset(
    "the and inc llc ltd co corp corporation company brand brands food foods group usa us of".split()
)


def _singular(word: str) -> str:
    return word[:-1] if len(word) > 3 and word.endswith("s") and not word.endswith("ss") else word


def _fold(text: str) -> str:
    """Lowercase, accents removed ("Nestlé" → "nestle"), curly apostrophes made straight."""
    decomposed = unicodedata.normalize("NFKD", text.lower().replace("’", "'"))
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def words(text: str | None) -> list[str]:
    """Lowercase ASCII words without accents or apostrophes ("Kate's" → "kate", "Nestlé" → "nestle") and
    with a simple plural → singular."""
    if not text:
        return []
    return [_singular(w) for w in re.findall(r"[a-z0-9]+", _fold(text).replace("'", ""))]


def brand_words(brand: str | None) -> list[str]:
    return list(dict.fromkeys(w for w in words(brand) if len(w) >= 2 and w not in BRAND_STOPWORDS))


def name_words(name: str | None, brand_ws: list[str]) -> list[str]:
    """Meaningful words of a product name: 3+ letters, no digits, not a stopword and not part of the brand."""
    return list(
        dict.fromkeys(
            w
            for w in words(name)
            if len(w) >= 3 and not any(c.isdigit() for c in w) and w not in NAME_STOPWORDS and w not in brand_ws
        )
    )


def _name_matches(name_ws: list[str], haystack: set[str]) -> bool:
    required = len(name_ws) if len(name_ws) <= 2 else math.ceil(len(name_ws) / 2)
    return sum(1 for w in name_ws if w in haystack) >= required


def can_match_by_name(brand_ws: list[str], name_ws: list[str]) -> bool:
    """Whether a product has enough information for a brand + name ("possible") match."""
    return bool(brand_ws) and bool(name_ws)


@dataclass(frozen=True)
class PreparedRecall:
    """A recall with its printed numbers and words worked out once, for matching many products against it."""

    recall: Recall
    numbers: PrintedNumbers
    company_words: frozenset[str]  # description + recalling firm
    description_words: frozenset[str]


def prepare(recall: Recall) -> PreparedRecall:
    description = words(recall.product_description)
    return PreparedRecall(
        recall=recall,
        numbers=printed_numbers(recall.product_description) | printed_numbers(recall.code_info),
        company_words=frozenset(description + words(recall.recalling_firm)),
        description_words=frozenset(description),
    )


def classify(recall: Recall | PreparedRecall, *, upc: str | None, brand_ws: list[str], name_ws: list[str]) -> Match | None:
    """How a scanned product relates to one recall. Pass a PreparedRecall when matching many products."""
    p = recall if isinstance(recall, PreparedRecall) else prepare(recall)
    if upc and barcode_printed(p.numbers, upc):
        return "confirmed"
    if not can_match_by_name(brand_ws, name_ws):
        return None
    if not all(w in p.company_words for w in brand_ws):
        return None
    if not _name_matches(name_ws, p.description_words):
        return None
    return "possible"


def brand_query_terms(brand: str | None) -> list[list[str]]:
    """openFDA search terms for a brand: one list of alternative spellings per brand word, every word
    required. Built from the same words as brand_words(), so it is empty exactly when that is.

    openFDA matches whole words as written, so each word is searched as printed in the brand ("mills",
    "o'lakes", "nestlé"), without accents ("nestle"), without apostrophes ("olakes"), and without a
    possessive "'s" ("nature's" → "nature"). Only letters, digits and apostrophes reach the query, so
    nothing needs escaping.
    """
    keep = set(brand_words(brand))
    seen: set[str] = set()
    terms: list[list[str]] = []
    for token in re.findall(r"[^\W_]+(?:'[^\W_]+)*", (brand or "").lower().replace("’", "'")):
        for word in words(token):
            if word not in keep or word in seen:
                continue
            seen.add(word)
            folded = _fold(token)
            spellings = [token, folded, folded.replace("'", ""), re.sub(r"'s$", "", folded)]
            # Single letters ("m" from "m's") would match nearly every recall
            terms.append([t for t in dict.fromkeys(spellings) if len(t) >= 2 and re.fullmatch(r"[^\W_]+(?:'[^\W_]+)*", t)])
    return terms


def name_check_possible(brand: str | None, name: str | None) -> bool:
    """Whether a brand + name ("possible") match can be looked for: a searchable brand and a name with
    words of its own."""
    brand_ws = brand_words(brand)
    return can_match_by_name(brand_ws, name_words(name, brand_ws)) and bool(brand_query_terms(brand))
