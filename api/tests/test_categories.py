"""Tests for api/services/categories.py — one test per category, plus edge cases."""

import pytest
from api.services.categories import categorize_recall, CATEGORY_IDS
from api.models import Recall


def _recall(description: str) -> Recall:
    return Recall(
        recall_number="F-0001-2026",
        event_id="1",
        status="Ongoing",
        classification="Class I",
        product_description=description,
        reason_for_recall="Test",
        recalling_firm="Test Firm",
        recall_initiation_date="2026-01-01",
        report_date="2026-01-01",
    )


@pytest.mark.parametrize("description,expected", [
    ("Whole Milk, 1 gallon", "Dairy"),
    ("Assorted Cheeses, 8 oz", "Dairy"),
    ("Unsalted Butter, 16 oz", "Dairy"),
    ("Vanilla Yogurt, 6 oz cups", "Dairy"),
    ("Heavy Whipping Cream", "Dairy"),
    ("Ground Beef Products, various weights", "Meat & Poultry"),
    ("Rotisserie Chicken", "Meat & Poultry"),
    ("Sliced Turkey Deli Meat", "Meat & Poultry"),
    ("Pork Sausage Links", "Meat & Poultry"),
    ("Wild-Caught Atlantic Salmon Fillets", "Seafood"),
    ("Canned Tuna in Water", "Seafood"),
    ("Cooked Shrimp, peeled and deveined", "Seafood"),
    ("Fresh Oysters", "Seafood"),
    ("Whole Romaine Lettuce Hearts", "Produce"),
    ("Baby Spinach, 5 oz bag", "Produce"),
    ("Mixed Berry Blend, frozen", "Produce"),
    ("Sliced Apples", "Produce"),
    ("Assorted Crackers, 12 oz", "Bakery & Snacks"),
    ("Chocolate Chip Cookies", "Bakery & Snacks"),
    ("Kettle-Cooked Potato Chips", "Bakery & Snacks"),
    ("Sourdough Bread, 24 oz loaf", "Bakery & Snacks"),
    ("Dry Roasted Peanuts, 16 oz", "Nuts & Seeds"),
    ("Sliced Almonds", "Nuts & Seeds"),
    ("Cashew Butter, creamy", "Nuts & Seeds"),
    ("Mixed Nuts Variety Pack", "Nuts & Seeds"),
    ("Fresh Salad Kit, Southwest style", "Ready-to-Eat"),
    ("Roasted Garlic Hummus, 10 oz", "Ready-to-Eat"),
    ("Frozen Burrito, bean and cheese", "Ready-to-Eat"),
    ("Ready-to-Eat Chicken Soup", "Ready-to-Eat"),
    ("Orange Juice, not from concentrate", "Beverages"),
    ("Green Tea, bottled", "Beverages"),
    ("Coconut Water Beverage", "Beverages"),
    ("Energy Drink, 16 fl oz", "Beverages"),
    ("Infant Formula Powder, 12.5 oz", "Baby & Infant"),
    ("Organic Baby Food, Peas and Carrots", "Baby & Infant"),
    ("Toddler Snack Puffs", "Baby & Infant"),
    ("Premium Dry Dog Food, 20 lb bag", "Pet Food"),
    ("Wet Cat Food, Salmon Flavor", "Pet Food"),
    ("Pet Food, various flavors", "Pet Food"),
])
def test_categorize(description: str, expected: str) -> None:
    assert categorize_recall(_recall(description)) == expected


def test_no_match_returns_none() -> None:
    """All-purpose flour doesn't match any category."""
    assert categorize_recall(_recall("All-Purpose Flour, 5 lb bag")) is None


def test_no_match_plain_grain() -> None:
    assert categorize_recall(_recall("White Rice, long grain, 10 lb")) is None


def test_pet_food_before_meat_poultry() -> None:
    """Chicken-flavored dog food must be Pet Food, not Meat & Poultry."""
    assert categorize_recall(_recall("Chicken-Flavored Dry Dog Food, 15 lb")) == "Pet Food"


def test_baby_infant_formula_before_dairy() -> None:
    """Infant formula (which contains milk) must be Baby & Infant, not Dairy."""
    assert categorize_recall(_recall("Milk-Based Infant Formula, Stage 1")) == "Baby & Infant"


def test_empty_description_returns_none() -> None:
    assert categorize_recall(_recall("")) is None


def test_category_ids_are_unique() -> None:
    assert len(CATEGORY_IDS) == len(set(CATEGORY_IDS))


def test_normalize_attaches_category(monkeypatch: pytest.MonkeyPatch) -> None:
    """normalize() in openfda.py should attach the category."""
    from api.services.openfda import normalize
    record = {
        "recall_number": "F-0002-2026",
        "event_id": "2",
        "status": "Ongoing",
        "classification": "Class I",
        "product_description": "Cheddar Cheese Slices, 8 oz",
        "reason_for_recall": "Listeria monocytogenes",
        "recalling_firm": "Test Dairy Co.",
        "recall_initiation_date": "20260101",
        "report_date": "20260101",
    }
    result = normalize(record)
    assert result.category == "Dairy"


def test_normalize_none_for_unmatched() -> None:
    from api.services.openfda import normalize
    record = {
        "recall_number": "F-0003-2026",
        "event_id": "3",
        "status": "Ongoing",
        "classification": "Class III",
        "product_description": "Cornstarch, 16 oz",
        "reason_for_recall": "Undeclared sulfites",
        "recalling_firm": "Pantry Co.",
        "recall_initiation_date": "20260101",
        "report_date": "20260101",
    }
    result = normalize(record)
    assert result.category is None
