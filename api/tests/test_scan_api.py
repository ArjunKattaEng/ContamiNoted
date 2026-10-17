import pytest
from fastapi.testclient import TestClient

from api.deps import get_openfda, get_openfoodfacts, get_summarizer
from api.errors import ApiError
from api.index import app
from api.models import Product
from api.services.barcode_check import result_cache
from api.services.openfoodfacts import ProductLookupError

from .test_api import FakeSummarizer


class CandidateOpenFda:
    """Returns every fixture recall for any search, like a generous openFDA, so the local matching decides."""

    def __init__(self, recalls):
        self.recalls = recalls
        self.searches: list[str] = []
        self.fail = False
        self.fail_after = None  # fail every query after this many calls
        self.calls = 0

    async def query(self, search, *, limit, skip=0, sort="report_date:desc"):
        self.calls += 1
        if self.fail or (self.fail_after is not None and self.calls > self.fail_after):
            raise ApiError("upstream_error", "The FDA recall service isn’t responding. Please try again.", 502)
        self.searches.append(search)
        return self.recalls[:limit], len(self.recalls)


class FakeOpenFoodFacts:
    def __init__(self):
        self.product: Product | None = None
        self.down = False
        self.lookups: list[str] = []

    async def lookup(self, code):
        self.lookups.append(code)
        if self.down:
            raise ProductLookupError("down")
        return self.product.model_copy(update={"upc": code}) if self.product else None


@pytest.fixture
def scan(recalls):
    fda, off, summarizer = CandidateOpenFda(recalls), FakeOpenFoodFacts(), FakeSummarizer()
    app.dependency_overrides[get_openfda] = lambda: fda
    app.dependency_overrides[get_openfoodfacts] = lambda: off
    app.dependency_overrides[get_summarizer] = lambda: summarizer
    result_cache.clear()
    yield TestClient(app), fda, off, summarizer
    app.dependency_overrides.clear()
    result_cache.clear()


def post(client, code):
    return client.post("/api/scan/barcode", json={"code": code})


def test_confirmed_by_barcode(scan):
    client, fda, off, summarizer = scan
    off.product = Product(upc="", name="Maamoul with Dates", brand="C Sweet")
    summarizer.cached.add("H-0254-2025")
    response = post(client, "852664042694")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    item = body["items"][0]
    assert (body["type"], item["status"], item["recallNumbers"]) == ("barcode", "confirmed", ["H-0254-2025"])
    assert body["counts"] == {"total": 1, "confirmed": 1, "possible": 0, "clear": 0, "error": 0}
    # The sibling Kaak recall (same brand, other UPC) is not shown
    assert [r["recallNumber"] for r in body["matchedRecalls"]] == ["H-0254-2025"]
    assert body["matchedRecalls"][0]["summary"]["shortSummary"] == "cached"
    assert body["verdict"]["headline"] == "This product was on an FDA recall"  # Completed recall
    assert "UPC 8 52664 04269 4" in body["verdict"]["details"]
    assert body["product"] == {"upc": "852664042694", "name": "Maamoul with Dates", "brand": "C Sweet"}
    assert "Barcode listed in recall H-0254-2025" in item["note"]


def test_active_recall_found_without_product_info(scan):
    client, fda, off, _ = scan
    body = post(client, "609465693477").json()
    assert body["items"][0]["status"] == "confirmed"
    assert body["verdict"]["headline"] == "This product is on an FDA recall"
    assert body["product"]["name"] == "Unknown product"
    assert len(fda.searches) == 1  # no brand, so no brand search


def test_possible_by_brand_and_name(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Raspberry Yogurt Parfait", brand="Bonya", size="8 oz")
    body = post(client, "012345678905").json()
    item = body["items"][0]
    assert (item["status"], item["recallNumbers"]) == ("possible", ["F-0769-2025"])
    assert body["verdict"]["headline"] == "Possible recall match"
    assert "**Bonya**" in body["verdict"]["details"]
    assert "lists specific barcodes" not in body["verdict"]["details"]
    assert any('"bonya"' in s for s in fda.searches)


def test_possible_when_the_recall_lists_other_upcs(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Maamoul with Dates", brand="C Sweet")
    body = post(client, "012345678905").json()
    assert body["items"][0]["status"] == "possible"
    assert "lists specific barcodes" in body["verdict"]["details"]


def test_brand_search_requires_every_brand_word(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Organic Rolled Oats", brand="Nature's Path")
    post(client, "012345678905")
    brand_search = fda.searches[1]
    assert 'product_description:"nature\'s"+recalling_firm:"nature\'s"+product_description:"natures"' in brand_search
    assert 'product_description:"nature"+recalling_firm:"nature")' in brand_search
    assert '+AND+(product_description:"path"+recalling_firm:"path")' in brand_search


def test_no_brand_search_without_a_name_to_match(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Nature Mills", brand="Nature Mills")  # name is just the brand
    body = post(client, "012345678905").json()
    assert len(fda.searches) == 1
    assert body["items"][0]["status"] == "clear"
    assert body["verdict"]["headline"] == "No recall lists this barcode"
    assert "not enough of its name to compare" in body["verdict"]["details"]


def test_no_brand_search_when_the_brand_has_no_searchable_words(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Sparkling Water", brand="!!!")
    body = post(client, "012345678905").json()
    assert len(fda.searches) == 1  # never an empty brand query
    assert body["verdict"]["headline"] == "No recall lists this barcode"


def test_truncated_brand_search_is_disclosed(scan, monkeypatch):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Nutella", brand="Ferrero")
    monkeypatch.setattr("api.services.barcode_check.BRAND_QUERY_LIMIT", 5)  # fixture has 12 recalls
    details = post(client, "3017620422003").json()["verdict"]["details"]
    assert "**Ferrero** has many recalls, so we compared the newest 5 by name." in details
    assert details.startswith("We checked active FDA food recalls and those")


def test_clear_for_a_known_product(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Nutella", brand="Ferrero")
    body = post(client, "3017620422003").json()
    assert body["items"][0]["status"] == "clear"
    assert body["items"][0]["recallNumbers"] == []
    assert body["matchedRecalls"] == []
    assert body["verdict"]["headline"] == "No FDA recall found"
    assert "USDA" in body["verdict"]["details"]
    assert body["counts"]["clear"] == 1


def test_clear_for_an_unknown_product_says_only_the_barcode_was_checked(scan):
    client, *_ = scan
    body = post(client, "012345678905").json()
    assert body["items"][0]["status"] == "clear"
    assert body["verdict"]["headline"] == "No recall lists this barcode"
    assert "couldn’t find this product’s name" in body["verdict"]["details"]
    assert body["verdict"]["nextSteps"]


def test_clear_without_a_brand_doesnt_claim_a_name_check(scan):
    client, _, off, _ = scan
    off.product = Product(upc="", name="Whole Milk")
    details = post(client, "012345678905").json()["verdict"]["details"]
    assert "without its brand" in details and "only check its UPC 0 12345 67890 5" in details


def test_product_text_is_escaped_in_the_verdict(scan):
    client, _, off, _ = scan
    off.product = Product(upc="", name="[Recall cleared](https://evil.example)", brand="Acme")
    details = post(client, "3017620422003").json()["verdict"]["details"]
    assert "](" not in details and "\\[Recall cleared\\]" in details


def test_open_food_facts_outage_still_checks_the_barcode(scan):
    client, _, off, _ = scan
    off.down = True
    body = post(client, "609465693477").json()
    assert body["items"][0]["status"] == "confirmed"
    assert body["product"]["name"] == "Unknown product"


def test_open_food_facts_outage_isnt_cached(scan):
    client, _, off, _ = scan
    off.down = True
    first = post(client, "012345678905").json()
    assert "couldn’t look up this product’s name right now" in first["verdict"]["details"]
    off.down, off.product = False, Product(upc="", name="Nutella", brand="Ferrero")
    second = post(client, "012345678905").json()
    assert second["product"]["name"] == "Nutella"  # recovered on the next scan


def test_brand_search_failure_keeps_a_confirmed_match(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Maamoul with Dates", brand="C Sweet")
    fda.fail_after = 1  # UPC search works, brand search fails
    body = post(client, "852664042694").json()
    assert body["items"][0]["status"] == "confirmed"
    calls = fda.calls
    post(client, "852664042694")
    assert fda.calls > calls  # the incomplete result wasn't cached, so openFDA is asked again


def test_brand_search_failure_without_a_confirmed_match_is_502(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Raspberry Yogurt Parfait", brand="Bonya")
    fda.fail_after = 1
    response = post(client, "012345678905")
    assert response.status_code == 502


def test_searches_use_upc_forms_and_the_ongoing_or_recent_window(scan):
    client, fda, *_ = scan
    post(client, "040264101280")
    upc_search = fda.searches[0]
    assert 'code_info:"040264+10128"' in upc_search
    assert 'more_code_info:"040264101280"' in upc_search
    assert '+AND+(status:"Ongoing"+report_date:[' in upc_search


def test_input_is_normalized(scan):
    client, _, off, _ = scan
    body = post(client, " 0852664042694 ").json()  # EAN-13 form of the UPC
    assert body["product"]["upc"] == "852664042694"
    assert off.lookups == ["852664042694"]
    assert body["items"][0]["status"] == "confirmed"


@pytest.mark.parametrize("code", ["012345678900", "abc", "12345"])
def test_invalid_barcode(scan, code):
    client, fda, *_ = scan
    response = post(client, code)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_barcode"
    assert fda.searches == []


def test_missing_code_is_invalid_request(scan):
    client, *_ = scan
    response = client.post("/api/scan/barcode", json={"code": ""})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_openfda_failure_is_502_never_clear(scan):
    client, fda, *_ = scan
    fda.fail = True
    response = post(client, "012345678905")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "upstream_error"


def test_repeat_scans_reuse_the_check_but_get_new_ids(scan):
    client, fda, off, _ = scan
    off.product = Product(upc="", name="Nutella", brand="Ferrero")
    first = post(client, "3017620422003").json()
    searches = len(fda.searches)
    second = post(client, "3017620422003").json()
    assert len(fda.searches) == searches
    assert first["id"] != second["id"] and first["items"][0]["id"] != second["items"][0]["id"]
