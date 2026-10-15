import json
from pathlib import Path

import pytest

from api.models import Recall
from api.services.openfda import normalize

FIXTURE = Path(__file__).parent / "fixtures" / "openfda_food_enforcement.json"


@pytest.fixture
def openfda_body() -> dict:
    """Real openFDA food enforcement response (trimmed sample from the old food-recall pipeline)."""
    return json.loads(FIXTURE.read_text())


@pytest.fixture
def recalls(openfda_body) -> list[Recall]:
    return [normalize(r) for r in openfda_body["results"]]
