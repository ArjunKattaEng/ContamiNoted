import asyncio
import re
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from api.deps import get_openfda
from api.errors import ApiError
from api.index import app
from api.models import WatchCheckItem
from api.services.cache import TTLCache
from api.services import watchlist
from api.services.watchlist import PAGE_SIZE, WatchlistChecker, check_window, current_month, months_between, past_months

TODAY = date(2026, 10, 16)


def in_range(search: str, recalls):
    """The recalls whose report date falls in the search's report_date:[A+TO+B] range, like openFDA."""
    start, end = re.search(r"report_date:\[(\d{8})\+TO\+(\d{8})\]", search).groups()
    return [r for r in recalls if start <= r.report_date.replace("-", "") <= end]


class PagedOpenFda:
    """Serves the recalls in each searched date range, page by page (honoring skip), and records each search."""

    def __init__(self, recalls):
        self.recalls = recalls
        self.calls: list[tuple[str, int, int]] = []
        self.fail_on_call: int | None = None  # 1-based

    async def query(self, search, *, limit, skip=0, sort="report_date:desc"):
        self.calls.append((search, limit, skip))
        if self.fail_on_call is not None and len(self.calls) >= self.fail_on_call:
            raise ApiError("upstream_error", "The FDA recall service isn’t responding. Please try again.", 502)
        found = in_range(search, self.recalls)
        return found[skip : skip + limit], len(found)


@pytest.fixture
def watch(recalls):
    # The fixture recalls are from 2025: report them a few days ago, inside any re-check window
    recent = (date.today() - timedelta(days=3)).isoformat()
    fda = PagedOpenFda([r.model_copy(update={"report_date": recent}) for r in recalls])
    app.dependency_overrides[get_openfda] = lambda: fda
    past_months.clear()
    current_month.clear()
    yield TestClient(app), fda
    app.dependency_overrides.clear()
    past_months.clear()
    current_month.clear()


def checker(fda):
    return WatchlistChecker(fda, past=TTLCache(), current=TTLCache(), today=TODAY)


def check(client, items, since=None):
    body = {"items": items, **({"since": since} if since else {})}
    return client.post("/api/watchlist/check", json=body)


class TestWindow:
    def test_last_check_minus_overlap(self):
        assert check_window(date(2026, 10, 10), TODAY) == date(2026, 9, 26)

    def test_never_older_than_90_days(self):
        assert check_window(date(2020, 1, 1), TODAY) == date(2026, 7, 18)

    def test_without_a_last_check_looks_at_the_last_month(self):
        assert check_window(None, TODAY) == date(2026, 9, 16)

    def test_never_after_today(self):
        assert check_window(date(2030, 1, 1), TODAY) == TODAY

    def test_calendar_months_cover_the_window(self):
        assert months_between(date(2026, 8, 20), TODAY) == [
            (date(2026, 8, 1), date(2026, 8, 31)),
            (date(2026, 9, 1), date(2026, 9, 30)),
            (date(2026, 10, 1), date(2026, 10, 31)),
        ]
        assert months_between(date(2025, 12, 20), date(2026, 1, 5))[-1] == (date(2026, 1, 1), date(2026, 1, 31))


def test_matches_by_barcode_and_by_brand_and_name(watch):
    client, fda = watch
    response = check(
        client,
        [
            {"id": "barcode-852664042694", "upc": "852664042694", "name": "Maamoul with Dates", "brand": "C Sweet"},
            {"id": "barcode-012345678905", "upc": "012345678905", "name": "Raspberry Yogurt Parfait", "brand": "Bonya"},
            {"id": "barcode-3017620422003", "upc": "3017620422003", "name": "Nutella", "brand": "Ferrero"},
        ],
        since="2026-10-01",
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    found = {(m["itemId"], m["recallNumber"], m["confidence"]) for m in body["matches"]}
    assert ("barcode-852664042694", "H-0254-2025", "confirmed") in found
    assert ("barcode-012345678905", "F-0769-2025", "possible") in found
    assert not any(item == "barcode-3017620422003" for item, _, _ in found)
    match = next(m for m in body["matches"] if m["recallNumber"] == "F-0769-2025")
    assert set(match["recall"]) >= {"recallNumber", "productDescription", "classification", "status", "reportDate"}
    assert "codeInfo" not in match["recall"]  # a compact snapshot
    assert body["since"] < "2026-10-01"  # overlap before the last check
    # One request per calendar month from (since − 14 days) to today, the current month only up to today
    today = date.today()
    months = months_between(check_window(date(2026, 10, 1), today), today)
    expected = [f"report_date:[{a:%Y%m%d}+TO+{min(b, today):%Y%m%d}]" for a, b in months]
    assert sorted(search for search, _, _ in fda.calls) == sorted(expected)
    assert all((limit, skip) == (PAGE_SIZE, 0) for _, limit, skip in fda.calls)


def test_unknown_product_matches_only_by_barcode(watch):
    client, _ = watch
    body = check(client, [{"id": "a", "upc": "609465693477", "name": "Unknown product"}]).json()
    assert [(m["recallNumber"], m["confidence"]) for m in body["matches"]] == [("F-0801-2025", "confirmed")]


def test_no_items_skips_openfda(watch):
    client, fda = watch
    body = check(client, []).json()
    assert body["matches"] == [] and fda.calls == []


def test_months_are_cached_and_shared_across_windows(recalls):
    fda = PagedOpenFda(recalls)
    c = checker(fda)
    items = [WatchCheckItem(id="a", name="Nutella", brand="Ferrero")]
    asyncio.run(c.check(items, date(2020, 1, 1)))  # capped at 90 days: July → October
    assert len(fda.calls) == 4
    asyncio.run(c.check(items, date(2026, 9, 3)))  # another device, another window: same months
    asyncio.run(c.check(items, date(2026, 10, 12)))
    assert len(fda.calls) == 4


def test_only_recalls_inside_the_window_are_matched(recalls):
    # Fixture recalls are from 2025; pretend one was reported inside the window and one just before it
    inside = recalls[0].model_copy(update={"report_date": "2026-10-01"})
    before = recalls[3].model_copy(update={"report_date": "2026-09-15"})  # C Sweet maamoul, UPC 852664042694
    c = checker(PagedOpenFda([inside, before]))
    items = [
        WatchCheckItem(id="cookies", upc="740235500110", name="x"),
        WatchCheckItem(id="maamoul", upc="852664042694", name="x"),
    ]
    result = asyncio.run(c.check(items, date(2026, 10, 1)))  # window starts Sep 17
    assert [m.item_id for m in result.matches] == ["cookies"]


def test_a_large_month_is_paged(recalls):
    class Big(PagedOpenFda):
        async def query(self, search, *, limit, skip=0, sort="report_date:desc"):
            self.calls.append((search, limit, skip))
            return ([] if skip >= 2 * PAGE_SIZE else self.recalls), 2 * PAGE_SIZE + 5

    fda = Big(recalls)
    asyncio.run(checker(fda).check([WatchCheckItem(id="a", name="Nutella", brand="Ferrero")], date(2026, 10, 25)))
    assert [skip for _, _, skip in fda.calls] == [0, PAGE_SIZE, 2 * PAGE_SIZE]  # October only


@pytest.mark.parametrize("fail_on_call", [1, 3])
def test_openfda_failure_anywhere_is_502(watch, fail_on_call):
    client, fda = watch
    fda.fail_on_call = fail_on_call  # the first range, or a later one
    response = check(client, [{"id": "a", "upc": "012345678905", "name": "Nutella"}], since="2026-08-01")
    assert response.status_code == 502


def test_each_recall_is_prepared_once_however_many_products(recalls, monkeypatch):
    many = [
        r.model_copy(update={"recall_number": f"F-{i:04d}-{j}", "report_date": "2026-10-05"})
        for i in range(400)
        for j, r in enumerate(recalls)
    ]  # 4,800

    class Many(PagedOpenFda):
        async def query(self, search, *, limit, skip=0, sort="report_date:desc"):
            found = in_range(search, many)
            return found[skip : skip + limit], len(found)

    prepared = []
    real_prepare = watchlist.prepare
    monkeypatch.setattr(watchlist, "prepare", lambda r: prepared.append(r) or real_prepare(r))
    items = [WatchCheckItem(id=str(i), upc="012345678905", name="Raspberry Yogurt Parfait", brand="Bonya") for i in range(100)]
    result = asyncio.run(checker(Many(recalls)).check(items, date(2026, 10, 10)))
    assert len(prepared) == len(many)  # once per recall, not per (product, recall) pair
    assert len(result.matches) == 100 * 400  # every copy of the parfait recall, for every product


@pytest.mark.parametrize(
    "items",
    [
        [{"id": "a", "name": ""}],  # empty name
        [{"id": "", "name": "x"}],  # empty id
        [{"id": str(i), "name": "x"} for i in range(101)],  # too many items
    ],
)
def test_invalid_requests(watch, items):
    client, fda = watch
    response = check(client, items)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"
    assert fda.calls == []


def test_invalid_barcode_on_an_item_is_ignored(watch):
    client, _ = watch
    body = check(client, [{"id": "a", "upc": "012345678900", "name": "Raspberry Yogurt Parfait", "brand": "Bonya"}]).json()
    assert [(m["recallNumber"], m["confidence"]) for m in body["matches"]] == [("F-0769-2025", "possible")]
