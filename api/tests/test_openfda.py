import asyncio
import re

import httpx
import pytest

from api.errors import ApiError
from datetime import date

from api.services.openfda import (
    STATUS_SEARCH,
    OpenFdaClient,
    build_url,
    normalize,
    recall_number_query,
    recall_numbers_query,
    search_query,
    within_days,
)


def run(coro):
    return asyncio.run(coro)


def client_returning(status: int, body: dict | None = None, seen: list[str] | None = None) -> OpenFdaClient:
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(str(request.url))
        return httpx.Response(status, json=body or {})

    return OpenFdaClient(http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))


class TestNormalize:
    def test_real_records_match_the_contract(self, openfda_body):
        for raw in openfda_body["results"]:
            recall = normalize(raw)
            assert recall.recall_number == raw["recall_number"]
            assert recall.status in ("Ongoing", "Completed", "Terminated")
            assert recall.classification in ("Class I", "Class II", "Class III")
            assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", recall.report_date)
            assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", recall.recall_initiation_date)
            assert recall.summary is None
            if raw.get("termination_date"):
                assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", recall.termination_date or "")

    def test_dates_codes_and_missing_fields(self):
        recall = normalize(
            {
                "recall_number": "F-0123-2026",
                "event_id": 98765,
                "status": "Pending",
                "classification": "Class I",
                "product_description": "  Baby Spinach 5 oz  ",
                "reason_for_recall": "Listeria",
                "recalling_firm": "Firm",
                "code_info": "UPC 0 12345 67890 5",
                "more_code_info": "Lots 1-3",
                "recall_initiation_date": "20261001",
                "report_date": "20261008",
                "city": "",
            }
        )
        assert recall.event_id == "98765"
        assert recall.status == "Ongoing"
        assert recall.product_description == "Baby Spinach 5 oz"
        assert recall.code_info == "UPC 0 12345 67890 5 Lots 1-3"
        assert (recall.recall_initiation_date, recall.report_date) == ("2026-10-01", "2026-10-08")
        assert recall.termination_date is None
        assert recall.city is None

    def test_camel_case_json(self, recalls):
        body = recalls[0].model_dump(by_alias=True, exclude_none=True)
        assert {"recallNumber", "productDescription", "reportDate"} <= body.keys()
        assert "recall_number" not in body


class TestQueries:
    def test_search_requires_every_word_in_some_field(self):
        q = search_query("Listeria  cheese!")
        assert q == (
            '(product_description:"listeria"+recalling_firm:"listeria"+reason_for_recall:"listeria")'
            '+AND+(product_description:"cheese"+recalling_firm:"cheese"+reason_for_recall:"cheese")'
        )

    def test_search_without_words_is_invalid(self):
        with pytest.raises(ApiError) as err:
            search_query("!!")
        assert err.value.code == "invalid_request"

    def test_recall_number_validation(self):
        assert recall_number_query("H-1407-2026") == 'recall_number:"H-1407-2026"'
        with pytest.raises(ApiError) as err:
            recall_number_query("../etc")
        assert err.value.status == 404

    def test_date_window(self):
        today = date(2026, 10, 14)
        assert within_days('status:"Ongoing"', 30, today) == 'status:"Ongoing"+AND+report_date:[20260914+TO+20261014]'
        assert within_days('status:"Ongoing"', None, today) == 'status:"Ongoing"'
        assert within_days("x", 7, today, field="termination_date") == "x+AND+termination_date:[20261007+TO+20261014]"
        url = build_url(within_days(STATUS_SEARCH["active"], 7, today), limit=1)
        assert "report_date:[20261007+TO+20261014]" in url

    def test_several_recall_numbers(self):
        assert recall_numbers_query(["H-1-2026", "H-1407-2026", "H-1407-2026", "bad"]) == 'recall_number:("H-1407-2026")'
        with pytest.raises(ApiError):
            recall_numbers_query(["nope"])

    def test_url_keeps_plus_literal_and_encodes_quotes(self):
        url = build_url(STATUS_SEARCH["resolved"], limit=20, skip=40, api_key="k")
        assert 'status:(%22Completed%22+%22Terminated%22)' in url
        assert "sort=report_date:desc&limit=20&skip=40&api_key=k" in url


class TestClient:
    def test_parses_results_and_total(self, openfda_body):
        seen: list[str] = []
        recalls, total = run(client_returning(200, openfda_body, seen).query(STATUS_SEARCH["active"], limit=12))
        assert len(recalls) == 12 and total == openfda_body["meta"]["results"]["total"]
        assert seen[0].startswith("https://api.fda.gov/food/enforcement.json?search=status:")

    def test_no_matches_is_empty_not_an_error(self):
        assert run(client_returning(404, {"error": {"code": "NOT_FOUND"}}).query("x", limit=5)) == ([], 0)

    @pytest.mark.parametrize("status", [429, 500])
    def test_upstream_failures(self, status):
        with pytest.raises(ApiError) as err:
            run(client_returning(status).query("x", limit=5))
        assert (err.value.code, err.value.status) == ("upstream_error", 502)

    def test_last_updated(self):
        assert run(client_returning(200, {"meta": {"last_updated": "2026-10-07"}}).last_updated()) == "2026-10-07"
        with pytest.raises(ApiError) as err:
            run(client_returning(500).last_updated())
        assert err.value.code == "upstream_error"

    def test_get_unknown_recall(self):
        with pytest.raises(ApiError) as err:
            run(client_returning(404).get("F-0000-2026"))
        assert err.value.code == "not_found"

    def test_skip_beyond_openfda_limit_returns_empty_without_calling(self):
        seen: list[str] = []
        assert run(client_returning(200, {}, seen).query("x", limit=20, skip=30_000)) == ([], 0)
        assert seen == []
