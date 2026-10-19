"""Open Food Facts product lookup (https://openfoodfacts.github.io/openfoodfacts-server/api/).

Free, no key. Open Food Facts asks apps to send a User-Agent naming themselves. An unknown product is
None; an outage raises ProductLookupError, so callers can tell the two apart (and not cache an outage).
Either way the scan still checks the barcode itself against recalls.
"""

import logging
import re
from typing import Any

import httpx

from api.models import Product
from api.services.cache import TTLCache
from api.services.loop import PerLoop

logger = logging.getLogger("recallguard.openfoodfacts")

PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
FIELDS = "code,product_name,product_name_en,generic_name,brands,quantity,image_front_small_url,categories,expiration_date"
USER_AGENT = "RecallGuard/0.1 (student food-recall app; https://contami-noted.vercel.app)"
MAX_TEXT = 120


class ProductLookupError(Exception):
    """Open Food Facts couldn't be reached or answered with an error."""


def _text(value: Any) -> str | None:
    text = " ".join(str(value).split()) if value is not None else ""
    return text[:MAX_TEXT] or None


def _first(value: Any) -> str | None:
    """First entry of a comma-separated Open Food Facts list ("Ferrero, Nutella" → "Ferrero")."""
    return _text(str(value).split(",")[0]) if value else None


# Matches DD/MM/YYYY or MM/DD/YYYY (treated as MM/DD/YYYY for US products) and YYYY-MM or YYYY-MM-DD
_DATE_SLASH = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
_DATE_YM = re.compile(r"^(\d{4})-(\d{2})(?:-(\d{2}))?$")


def _parse_expiry(raw: Any) -> str | None:
    """Normalize an Open Food Facts expiration_date to YYYY-MM-DD, or None if unparseable."""
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    m = _DATE_SLASH.match(raw)
    if m:
        # Open Food Facts uses DD/MM/YYYY in most locales, but US entries often use MM/DD/YYYY.
        # We can't tell which, so we return the value as-is for the user to confirm.
        a, b, year = m.group(1), m.group(2), m.group(3)
        # Treat first part as month (US convention); if > 12, swap.
        month, day = (a, b) if int(a) <= 12 else (b, a)
        try:
            return f"{year}-{int(month):02d}-{int(day):02d}"
        except ValueError:
            return None
    m = _DATE_YM.match(raw)
    if m:
        year, month, day = m.group(1), m.group(2), m.group(3) or "01"
        return f"{year}-{month}-{day}"
    return None


def parse_product(body: dict[str, Any], code: str) -> Product | None:
    """Open Food Facts response → Product, or None when the product is unknown or has no usable name."""
    product = body.get("product")
    if body.get("status") != 1 or not isinstance(product, dict):
        return None
    brand = _first(product.get("brands"))
    name = _text(product.get("product_name")) or _text(product.get("product_name_en")) or _text(product.get("generic_name"))
    if not name and not brand:
        return None
    image = product.get("image_front_small_url")
    return Product(
        upc=code,
        name=name or brand or "Unknown product",
        brand=brand,
        size=_text(product.get("quantity")),
        category=_first(product.get("categories")),
        image_url=image if isinstance(image, str) and image.startswith("https://") else None,
        expiry_date=_parse_expiry(product.get("expiration_date")),
    )


class OpenFoodFactsClient:
    def __init__(self, http: httpx.AsyncClient | None = None, timeout: float = 6.0):
        self._http = PerLoop(
            lambda: http or httpx.AsyncClient(timeout=httpx.Timeout(timeout), headers={"User-Agent": USER_AGENT})
        )
        # Found and not-found answers are cached for a day; failures aren't cached
        self._cache: TTLCache[tuple[Product | None]] = TTLCache(maxsize=2000, ttl_seconds=24 * 3600)

    async def lookup(self, code: str) -> Product | None:
        """The product, or None if Open Food Facts doesn't know it. Raises ProductLookupError on an outage."""
        cached = self._cache.get(code)
        if cached is not None:
            return cached[0]
        # Open Food Facts stores many US products under their 13-digit EAN form
        for candidate in [code, "0" + code] if len(code) == 12 else [code]:
            try:
                response = await self._http.get().get(PRODUCT_URL.format(code=candidate), params={"fields": FIELDS})
            except httpx.HTTPError as exc:
                logger.warning("Open Food Facts request failed: %s", exc)
                raise ProductLookupError(str(exc)) from exc
            if response.status_code == 404:
                continue  # unknown product
            if response.status_code != 200:
                logger.warning("Open Food Facts %s for %s", response.status_code, candidate)
                raise ProductLookupError(f"HTTP {response.status_code}")
            try:
                product = parse_product(response.json(), code)
            except ValueError as exc:
                logger.warning("Open Food Facts returned invalid JSON for %s", candidate)
                raise ProductLookupError("invalid JSON") from exc
            if product:
                self._cache.set(code, (product,))
                return product
        self._cache.set(code, (None,))
        return None
