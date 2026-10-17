import asyncio

import httpx
import pytest

from api.services.openfoodfacts import OpenFoodFactsClient, ProductLookupError, parse_product


def run(coro):
    return asyncio.run(coro)


NUTELLA = {
    "status": 1,
    "product": {
        "product_name": "Nutella",
        "brands": "Ferrero, Nutella",
        "quantity": "400 g",
        "categories": "Spreads, Sweet spreads",
        "image_front_small_url": "https://images.openfoodfacts.org/x.jpg",
    },
}


def client(handler, seen=None):
    def wrapped(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request.url.path)
        return handler(request)

    return OpenFoodFactsClient(http=httpx.AsyncClient(transport=httpx.MockTransport(wrapped)))


class TestParse:
    def test_product_fields(self):
        product = parse_product(NUTELLA, "3017620422003")
        assert product is not None
        assert (product.upc, product.name, product.brand, product.size, product.category) == (
            "3017620422003",
            "Nutella",
            "Ferrero",
            "400 g",
            "Spreads",
        )
        assert product.image_url == "https://images.openfoodfacts.org/x.jpg"

    def test_unknown_or_nameless_products(self):
        assert parse_product({"status": 0}, "1") is None
        assert parse_product({"status": 1, "product": {"quantity": "1 L"}}, "1") is None

    def test_brand_stands_in_for_a_missing_name(self):
        product = parse_product({"status": 1, "product": {"brands": "Acme"}}, "1")
        assert product is not None and product.name == "Acme"

    def test_insecure_image_is_dropped(self):
        body = {"status": 1, "product": {"product_name": "X", "image_front_small_url": "http://a/b.jpg"}}
        assert parse_product(body, "1").image_url is None


class TestLookup:
    def test_retries_upc_as_ean13_then_caches(self):
        seen: list[str] = []

        def handler(request):
            if request.url.path.endswith("/0012345678905.json"):
                return httpx.Response(200, json=NUTELLA)
            return httpx.Response(404, json={"status": 0})

        off = client(handler, seen)
        product = run(off.lookup("012345678905"))
        assert product is not None and product.brand == "Ferrero"
        assert [p.rsplit("/", 1)[-1] for p in seen] == ["012345678905.json", "0012345678905.json"]
        run(off.lookup("012345678905"))
        assert len(seen) == 2  # served from the cache

    def test_unknown_product_is_cached_as_none(self):
        seen: list[str] = []
        off = client(lambda r: httpx.Response(404, json={"status": 0}), seen)
        assert run(off.lookup("3017620422003")) is None
        assert run(off.lookup("3017620422003")) is None
        assert len(seen) == 1

    def test_outage_raises_and_is_not_cached(self):
        seen: list[str] = []

        def handler(request):
            raise httpx.ConnectTimeout("down")

        off = client(handler, seen)
        with pytest.raises(ProductLookupError):
            run(off.lookup("3017620422003"))
        with pytest.raises(ProductLookupError):
            run(off.lookup("3017620422003"))
        assert len(seen) == 2

    def test_server_error_raises(self):
        off = client(lambda r: httpx.Response(503, text="busy"))
        with pytest.raises(ProductLookupError):
            run(off.lookup("3017620422003"))
