import pytest
from fastapi.testclient import TestClient

from api.deps import get_openfda, get_summarizer
from api.errors import ApiError
from api.index import app
from api.models import RecallSummary, RecallSummarySections


class FakeOpenFda:
    def __init__(self, recalls):
        self.recalls = recalls
        self.searches: list[tuple[str, int, int]] = []

    async def query(self, search, *, limit, skip=0, sort="report_date:desc"):
        self.searches.append((search, limit, skip))
        return self.recalls[skip : skip + limit], len(self.recalls)

    async def last_updated(self):
        return "2026-10-07"

    async def get_many(self, numbers):
        return [r for r in self.recalls if r.recall_number in numbers]

    async def get(self, recall_number):
        for r in self.recalls:
            if r.recall_number == recall_number:
                return r
        raise ApiError("not_found", "We couldn’t find that recall.", 404)


def short(text="short"):
    return RecallSummary(short_summary=text, generated_at="t", model="m")


SECTIONS = RecallSummarySections(
    overview="o", product_details="p", reason="r", health_risks="h", distribution="d", action_required="a", additional_info="i", contact="c"
)


class FakeSummarizer:
    def __init__(self):
        self.enabled = True
        self.cached: set[str] = set()  # recall numbers with a cached short summary
        self.fail = False
        self.generated: list[list[str]] = []

    def cached_short(self, recall):
        return short("cached") if recall.recall_number in self.cached else None

    def cached_full(self, recall):
        return None

    async def short_summaries(self, recalls):
        self.generated.append([r.recall_number for r in recalls])
        return {} if self.fail else {r.recall_number: short() for r in recalls}

    async def full_summary(self, recall):
        return None if self.fail or not self.enabled else RecallSummary(short_summary="s", sections=SECTIONS, generated_at="t", model="m")


@pytest.fixture
def api(recalls):
    fake_fda = FakeOpenFda(recalls)
    fake_summarizer = FakeSummarizer()
    app.dependency_overrides[get_openfda] = lambda: fake_fda
    app.dependency_overrides[get_summarizer] = lambda: fake_summarizer
    yield TestClient(app), fake_fda, fake_summarizer
    app.dependency_overrides.clear()


def test_recent_page_shape_and_paging(api):
    client, fda, _ = api
    response = client.get("/api/recalls/recent", params={"status": "active", "page": 2, "pageSize": 5})
    body = response.json()
    assert (body["page"], body["pageSize"], body["total"], body["hasMore"]) == (2, 5, 12, True)
    assert fda.searches[-1] == ('status:"Ongoing"', 5, 5)
    assert "recall_number" not in body["items"][0] and "recallNumber" in body["items"][0]
    assert "s-maxage=900" in response.headers["cache-control"]


def test_lists_never_wait_for_the_model(api, recalls):
    client, _, summarizer = api
    summarizer.cached = {recalls[0].recall_number}
    items = client.get("/api/recalls/recent").json()["items"]
    assert items[0]["summary"]["shortSummary"] == "cached"
    assert "summary" not in items[1]
    assert summarizer.generated == []


def test_summaries_endpoint(api, recalls):
    client, _, summarizer = api
    numbers = [r.recall_number for r in recalls[:3]]
    response = client.get("/api/recalls/summaries", params={"numbers": ",".join(numbers + ["H-9999-2026"])})
    assert response.status_code == 200
    assert set(response.json()["summaries"]) == set(numbers)  # unknown numbers are simply absent
    assert response.json()["summaries"][numbers[0]]["shortSummary"] == "short"
    assert "s-maxage=900" in response.headers["cache-control"]
    summarizer.fail = True
    assert client.get("/api/recalls/summaries", params={"numbers": numbers[0]}).headers["cache-control"] == "public, max-age=0, s-maxage=30"


def test_summaries_validation(api):
    client, _, _ = api
    assert client.get("/api/recalls/summaries", params={"numbers": " , "}).status_code == 400
    too_many = ",".join(f"H-{1000 + i}-2026" for i in range(26))
    assert client.get("/api/recalls/summaries", params={"numbers": too_many}).json()["error"]["code"] == "invalid_request"


def test_search_and_validation(api):
    client, fda, _ = api
    assert client.get("/api/recalls/search", params={"q": "peanut butter"}).status_code == 200
    assert 'product_description:"peanut"' in fda.searches[-1][0]
    bad = client.get("/api/recalls/search", params={"q": "x"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "invalid_request"
    assert client.get("/api/recalls/recent", params={"status": "nope"}).status_code == 400


def test_detail_is_fast_and_summary_is_separate(api, recalls):
    client, _, summarizer = api
    n = recalls[0].recall_number
    body = client.get(f"/api/recalls/{n}").json()
    assert body["recallNumber"] == n and "summary" not in body
    summary = client.get(f"/api/recalls/{n}/summary")
    assert summary.json()["sections"]["actionRequired"] == "a"
    summarizer.fail = True
    failed = client.get(f"/api/recalls/{n}/summary")
    assert failed.status_code == 200 and failed.json() is None
    assert failed.headers["cache-control"] == "public, max-age=0, s-maxage=30"


def test_not_found(api):
    client, _, _ = api
    missing = client.get("/api/recalls/F-0000-2026")
    assert missing.status_code == 404
    assert missing.json() == {"error": {"code": "not_found", "message": "We couldn’t find that recall."}}
    assert client.get("/api/recalls/F-0000-2026/summary").status_code == 404


def test_data_source(api):
    response = api[0].get("/api/meta/data-source")
    assert response.json() == {"source": "openFDA food enforcement", "openFdaLastUpdated": "2026-10-07"}
    assert "s-maxage=3600" in response.headers["cache-control"]


def test_health(api):
    assert api[0].get("/api/health").json()["status"] == "ok"
