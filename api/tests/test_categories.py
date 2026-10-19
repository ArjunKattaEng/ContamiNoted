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
    # Dairy
    ("Whole Milk, 1 gallon", "Dairy"),
    ("Assorted Cheeses, 8 oz", "Dairy"),
    ("Unsalted Butter, 16 oz", "Dairy"),
    ("Vanilla Yogurt, 6 oz cups", "Dairy"),
    ("Heavy Whipping Cream", "Dairy"),
    ("Grade A Large Eggs, 1 dozen", "Dairy"),
    # Meat & Poultry
    ("Ground Beef Products, various weights", "Meat & Poultry"),
    ("Rotisserie Chicken", "Meat & Poultry"),
    ("Sliced Turkey Deli Meat", "Meat & Poultry"),
    ("Pork Sausage Links", "Meat & Poultry"),
    # Seafood
    ("Wild-Caught Atlantic Salmon Fillets", "Seafood"),
    ("Canned Tuna in Water", "Seafood"),
    ("Cooked Shrimp, peeled and deveined", "Seafood"),
    ("Fresh Oysters", "Seafood"),
    # Produce
    ("Whole Romaine Lettuce Hearts", "Produce"),
    ("Baby Spinach, 5 oz bag", "Produce"),
    ("Mixed Berry Blend, frozen", "Produce"),
    ("Sliced Apples", "Produce"),
    # Bakery & Snacks
    ("Assorted Crackers, 12 oz", "Bakery & Snacks"),
    ("Chocolate Chip Cookies", "Bakery & Snacks"),
    ("Kettle-Cooked Potato Chips", "Bakery & Snacks"),
    ("Sourdough Bread, 24 oz loaf", "Bakery & Snacks"),
    ("Quaker Oats, 18 oz canister", "Bakery & Snacks"),
    ("Instant Oatmeal Packets, Maple & Brown Sugar", "Bakery & Snacks"),
    ("All-Purpose Flour, 5 lb bag", "Bakery & Snacks"),
    # Nuts & Seeds
    ("Dry Roasted Peanuts, 16 oz", "Nuts & Seeds"),
    ("Sliced Almonds", "Nuts & Seeds"),
    ("Cashew Butter, creamy", "Nuts & Seeds"),
    ("Mixed Nuts Variety Pack", "Nuts & Seeds"),
    ("Organic Tahini, sesame seed paste", "Nuts & Seeds"),
    # Ready-to-Eat
    ("Fresh Salad Kit, Southwest style", "Ready-to-Eat"),
    ("Roasted Garlic Hummus, 10 oz", "Ready-to-Eat"),
    ("Frozen Burrito, bean and cheese", "Ready-to-Eat"),
    ("Ready-to-Eat Chicken Soup", "Ready-to-Eat"),
    ("Prepared Caesar Salad, 10 oz", "Ready-to-Eat"),
    # Beverages
    ("Orange Juice, not from concentrate", "Beverages"),
    ("Green Tea, bottled", "Beverages"),
    ("Coconut Water Beverage", "Beverages"),
    ("Energy Drink, 16 fl oz", "Beverages"),
    # Baby & Infant
    ("Infant Formula Powder, 12.5 oz", "Baby & Infant"),
    ("Organic Baby Food, Peas and Carrots", "Baby & Infant"),
    ("Toddler Snack Puffs", "Baby & Infant"),
    # Pet Food
    ("Premium Dry Dog Food, 20 lb bag", "Pet Food"),
    ("Wet Cat Food, Salmon Flavor", "Pet Food"),
    ("Pet Food, various flavors", "Pet Food"),
    # Supplements (new)
    ("Vitamin C Tablets, 500 mg, 100 count", "Supplements"),
    ("Whey Protein Powder, Chocolate, 2 lb", "Supplements"),
    ("Probiotic Capsules, 30 count", "Supplements"),
    ("Fish Oil Softgels, Omega-3, 1000 mg", "Supplements"),
    # Spices & Condiments (new)
    ("Ground Black Pepper, 4 oz", "Spices & Condiments"),
    ("Red Pepper Flakes, 2 oz", "Spices & Condiments"),
    ("Sriracha Hot Sauce, 17 oz", "Spices & Condiments"),
    ("Ranch Salad Dressing, 16 fl oz", "Spices & Condiments"),
    ("Raw Wildflower Honey, 12 oz", "Spices & Condiments"),
    ("Chicken Bouillon Cubes", "Spices & Condiments"),
])
def test_categorize(description: str, expected: str) -> None:
    assert categorize_recall(_recall(description)) == expected


def test_no_match_plain_grain() -> None:
    assert categorize_recall(_recall("White Rice, long grain, 10 lb")) is None


def test_empty_description_returns_none() -> None:
    assert categorize_recall(_recall("")) is None


# --- Ordering / priority ---

def test_pet_food_before_meat_poultry() -> None:
    """Chicken-flavored dog food must be Pet Food, not Meat & Poultry."""
    assert categorize_recall(_recall("Chicken-Flavored Dry Dog Food, 15 lb")) == "Pet Food"


def test_baby_infant_formula_before_dairy() -> None:
    """Infant formula (which contains milk) must be Baby & Infant, not Dairy."""
    assert categorize_recall(_recall("Milk-Based Infant Formula, Stage 1")) == "Baby & Infant"


def test_supplements_before_bakery() -> None:
    """Fish oil supplement must not land in Seafood."""
    assert categorize_recall(_recall("Fish Oil Softgels, Omega-3, 60 count")) == "Supplements"


def test_nuts_before_dairy_cashew_butter() -> None:
    """Cashew Butter must be Nuts & Seeds, not Dairy."""
    assert categorize_recall(_recall("Creamy Cashew Butter, 16 oz")) == "Nuts & Seeds"


def test_ready_to_eat_before_produce_salad() -> None:
    """A packaged prepared salad must be Ready-to-Eat, not Produce."""
    assert categorize_recall(_recall("Prepared Greek Salad, 8 oz")) == "Ready-to-Eat"


def test_salad_sprouting_mixture_is_produce() -> None:
    """'Salad' used as an adjective (salad sprouts) must not pull a produce recall into Ready-to-Eat."""
    assert categorize_recall(_recall(
        "Salad Sprouting Mixture - Broccoli, Mustard, Alfalfa and Cabbage, "
        "packaged in heat-sealed resealable bags"
    )) == "Produce"


# --- Exclude rules ---

def test_exclude_eggplant_from_dairy() -> None:
    assert categorize_recall(_recall("Eggplant Parmesan, frozen")) != "Dairy"


def test_exclude_hot_dog_bun_from_meat() -> None:
    assert categorize_recall(_recall("Hot Dog Buns, 8 count")) == "Bakery & Snacks"


def test_exclude_coconut_water_from_nuts() -> None:
    assert categorize_recall(_recall("Coconut Water, 11.1 fl oz")) == "Beverages"


def test_exclude_potato_chips_from_produce() -> None:
    assert categorize_recall(_recall("Kettle Brand Potato Chips, Sea Salt")) == "Bakery & Snacks"


def test_exclude_black_pepper_from_produce() -> None:
    """Produce includes 'pepper' but black pepper must go to Spices & Condiments."""
    assert categorize_recall(_recall("Ground Black Pepper, 4 oz")) == "Spices & Condiments"


def test_exclude_fish_oil_from_seafood() -> None:
    assert categorize_recall(_recall("Fish Oil Omega-3 Supplement")) == "Supplements"


def test_exclude_goldfish_crackers_from_seafood() -> None:
    # Seafood excludes "goldfish crackers"; it lands in Dairy because "Cheddar" is in the description.
    # This is correct: a recall of cheddar-flavored Goldfish should reach Dairy watchers.
    assert categorize_recall(_recall("Goldfish Crackers, Cheddar, 6.6 oz")) == "Dairy"


def test_exclude_oat_milk_from_dairy() -> None:
    assert categorize_recall(_recall("Oat Milk, Barista Edition")) == "Bakery & Snacks"


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
