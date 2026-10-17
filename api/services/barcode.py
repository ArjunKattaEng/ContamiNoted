"""Barcode helpers: a Python port of src/lib/barcode.ts, plus UPC-E expansion and the ways FDA recall
notices print a UPC (grouped with spaces or dashes, sometimes without the check digit).

Pure functions, so they are unit-tested directly (api/tests/test_barcode.py).
"""

import re
from dataclasses import dataclass
from functools import lru_cache

GTIN_LENGTHS = (8, 12, 13, 14)


def normalize_barcode(raw: str) -> str:
    """Keep only ASCII digits (scanners and people add spaces, dashes and stray characters)."""
    return re.sub(r"[^0-9]", "", raw)


def is_valid_gtin(code: str) -> bool:
    """Validates a GTIN (EAN-8, UPC-A, EAN-13, GTIN-14) using its check digit."""
    if not re.fullmatch(r"[0-9]+", code) or len(code) not in GTIN_LENGTHS:
        return False
    digits = [int(c) for c in code]
    check = digits.pop()
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits)))
    return (10 - total % 10) % 10 == check


def expand_upc_e(code: str) -> str | None:
    """8-digit UPC-E (number system 0 or 1) → 12-digit UPC-A, or None if it isn't UPC-E shaped."""
    if not re.fullmatch(r"[01][0-9]{7}", code):
        return None
    ns, d, check = code[0], code[1:7], code[7]
    last = d[5]
    if last in "012":
        body = d[0:2] + last + "0000" + d[2:5]
    elif last == "3":
        body = d[0:3] + "00000" + d[3:5]
    elif last == "4":
        body = d[0:4] + "00000" + d[4]
    else:
        body = d[0:5] + "0000" + last
    return ns + body + check


def canonical_barcode(raw: str) -> str:
    """The form recalls are matched on: UPC-E expanded to UPC-A, and EAN-13 / GTIN-14 codes with leading
    zeros shortened to UPC-A. Other codes (EAN-13 from outside North America, EAN-8) are left as they are.
    Validate the result with is_valid_gtin."""
    code = normalize_barcode(raw)
    if len(code) == 8:
        upc_a = expand_upc_e(code)
        # 8-digit codes starting with 0/1 in US stores are UPC-E; fall back to EAN-8 when that doesn't check out
        if upc_a and is_valid_gtin(upc_a):
            return upc_a
    while len(code) > 12 and code.startswith("0"):
        code = code[1:]  # leading zeros don't change a GTIN's check digit
    return code


def format_upc(upc: str) -> str:
    """UPC-A as printed under the bars: "0 12345 67890 5"."""
    return f"{upc[0]} {upc[1:6]} {upc[6:11]} {upc[11]}" if len(upc) == 12 else upc


def compress_upc_a(upc: str) -> str | None:
    """12-digit UPC-A → its 8-digit UPC-E form, when it has one (number system 0/1 and enough zeros)."""
    if not re.fullmatch(r"[01][0-9]{11}", upc):
        return None
    ns, m, p, check = upc[0], upc[1:6], upc[6:11], upc[11]
    if m[2] in "012" and m[3:5] == "00" and p[:2] == "00":
        six = m[0:2] + p[2:5] + m[2]
    elif m[3:5] == "00" and p[:3] == "000":
        six = m[0:3] + p[3:5] + "3"
    elif m[4] == "0" and p[:4] == "0000":
        six = m[0:4] + p[4] + "4"
    elif p[:4] == "0000" and p[4] in "56789":
        six = m[0:5] + p[4]
    else:
        return None
    return ns + six + check


# ---- Finding a barcode in recall text -----------------------------------------------------------------

# A printed number: digit groups joined by one to three spaces or dashes ("0 40264 10128 0", "0-86112-00412-9")
_GROUPED_NUMBER = re.compile(r"[0-9]+(?:[\s\-\u2010\u2011\u2013]{1,3}[0-9]+)*")
_RUN_LENGTHS = range(12, 15)  # forms with a check digit that may sit anywhere in a printed number
# An 8-digit code (UPC-E, EAN-8) could pass for a lot code or a date, so it also needs a label right before it
_LABEL_BEFORE = re.compile(r"(?:upc|gtin|ean|barcode|item)[^0-9]{0,15}$", re.IGNORECASE)
_LABEL_WINDOW = 30


@lru_cache(maxsize=4096)
def _forms(code: str) -> tuple[frozenset[str], frozenset[str]]:
    """(anywhere, whole) printed forms of a canonical barcode.

    "anywhere" forms have 12–14 digits including the check digit, so a coincidental match is practically
    impossible: they may start and end on any group boundary of a printed number. Shorter forms (without
    the check digit or leading zero, UPC-E, EAN-8) could appear by chance in lot codes or dates, so they
    must be a whole printed number grouped like a barcode (see _barcode_like), and 8-digit ones need a label.
    """
    anywhere: set[str] = set()
    whole: set[str] = set()
    if len(code) == 12:  # UPC-A
        anywhere |= {code, "0" + code, "00" + code}  # as printed, and in EAN-13 and GTIN-14 form
        whole |= {code[:-1], code[1:-1]}  # without the check digit; also without the number system
        if code.startswith("0"):
            whole.add(code[1:])  # leading zero dropped
        upc_e = compress_upc_a(code)
        if upc_e:
            whole.add(upc_e)
    elif len(code) == 13:  # EAN-13
        anywhere |= {code, "0" + code}
        whole.add(code[:-1])
    elif len(code) == 14:  # GTIN-14
        anywhere.add(code)
    else:  # EAN-8
        whole.add(code)
    return frozenset(anywhere), frozenset(whole)


def _barcode_like(groups: list[str]) -> bool:
    """Grouped the way barcodes are printed: at most 4 groups, each of 4+ digits, except a single digit at
    either end ("0 40264 10128 5", "0 425261 4"). Rejects dates and lot lists ("04-25-2614", "40 26 41 01 28")."""
    if len(groups) > 4:
        return False
    return all(len(g) >= 4 or (len(g) == 1 and i in (0, len(groups) - 1)) for i, g in enumerate(groups))


@dataclass(frozen=True)
class PrintedNumbers:
    """The barcode-shaped numbers printed in a text, computed once so many barcodes can be checked quickly."""

    runs: frozenset[str] = frozenset()  # 12–14-digit runs on group boundaries
    whole: frozenset[str] = frozenset()  # whole numbers grouped like a barcode
    labeled: frozenset[str] = frozenset()  # ...of those, the ones right after "UPC", "item" etc.

    def __or__(self, other: "PrintedNumbers") -> "PrintedNumbers":
        return PrintedNumbers(self.runs | other.runs, self.whole | other.whole, self.labeled | other.labeled)


def printed_numbers(text: str | None) -> PrintedNumbers:
    runs: set[str] = set()
    whole: set[str] = set()
    labeled: set[str] = set()
    for number in _GROUPED_NUMBER.finditer(text or ""):
        groups = re.findall(r"[0-9]+", number.group())
        if _barcode_like(groups):
            digits = "".join(groups)
            whole.add(digits)
            if _LABEL_BEFORE.search(text[max(0, number.start() - _LABEL_WINDOW) : number.start()]):  # type: ignore[index]
                labeled.add(digits)
        for i in range(len(groups)):
            run = ""
            for group in groups[i:]:
                run += group
                if len(run) > _RUN_LENGTHS.stop - 1:
                    break
                if len(run) in _RUN_LENGTHS:
                    runs.add(run)
    return PrintedNumbers(frozenset(runs), frozenset(whole), frozenset(labeled))


def barcode_printed(numbers: PrintedNumbers, code: str) -> bool:
    """True when the barcode `code` (canonical form) is among the printed numbers, in any of the usual forms:
    grouped with spaces or dashes, with extra leading zeros, without the leading zero, as UPC-E, or without
    the check digit."""
    if not code:
        return False
    anywhere, whole = _forms(code)
    if anywhere & numbers.runs:
        return True
    return any(form in (numbers.whole if len(form) > 8 else numbers.labeled) for form in whole)


def upc_appears_in(text: str | None, code: str) -> bool:
    """True when the barcode `code` (canonical form) is printed in `text` (see barcode_printed)."""
    return bool(text) and barcode_printed(printed_numbers(text), code)


def upc_search_terms(code: str) -> list[str]:
    """Phrases to ask openFDA for. Its search splits text into words at spaces and dashes, so each grouping
    a recall might print ("0 40264 10128 0", "040264 10128 0", "40264101280") needs its own phrase.
    upc_appears_in then confirms every hit locally."""
    if len(code) == 12:
        terms = [
            code,
            code[:-1],
            "0" + code,
            f"{code[0]} {code[1:6]} {code[6:11]}",  # 1-5-5(-1)
            f"{code[0:6]} {code[6:11]}",  # 6-5(-1)
            f"{code[1:6]} {code[6:11]}",  # 5-5, also leading zero dropped
            f"{code[0:6]} {code[6:12]}",  # 6-6
            "00" + code,  # GTIN-14
        ]
        if code.startswith("0"):
            terms.append(code[1:])
        upc_e = compress_upc_a(code)
        if upc_e:
            terms += [upc_e, f"{upc_e[0]} {upc_e[1:7]} {upc_e[7]}"]
        return list(dict.fromkeys(terms))
    if len(code) == 13:
        return [code, code[:-1], "0" + code, f"{code[0]} {code[1:7]} {code[7:]}"]
    return [code]
