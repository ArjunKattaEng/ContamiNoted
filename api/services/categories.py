"""Food category taxonomy for recall notifications.

Each recall's product_description is matched against these keyword patterns in order. The first
match wins, so more-specific categories (Pet Food, Baby & Infant) come before broad ones (Meat).
These category IDs are the contract between the backend and the frontend (src/lib/categories.ts).
"""

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.models import Recall

CATEGORIES: list[tuple[str, re.Pattern[str]]] = [
    # More-specific categories first to avoid false matches from broad keywords
    ("Pet Food",        re.compile(r"\b(dog food|cat food|pet food|animal food|kibble|bird food|hamster food|rabbit food)s?\b", re.I)),
    ("Baby & Infant",   re.compile(r"\b(infant formula|baby formula|baby food|infant food|toddler|infant cereal|puree)s?\b", re.I)),
    # Nuts & Seeds before Dairy so "Cashew Butter" → Nuts & Seeds, not Dairy
    ("Nuts & Seeds",    re.compile(r"\b(peanut|almond|walnut|cashew|pistachio|pecan|hazelnut|nut butter|tahini|sunflower seed|pumpkin seed|mixed nuts)s?\b", re.I)),
    # Ready-to-Eat before Produce so "Salad Kit" → Ready-to-Eat, not Produce
    ("Ready-to-Eat",    re.compile(r"\b(salad kit|meal kit|sandwich|soup|dip|hummus|guacamole|burrito|wrap|ready.to.eat|prepared meal|frozen meal|entree)s?\b", re.I)),
    ("Dairy",           re.compile(r"\b(milk|cheese|butter|yogurt|cream|ice cream|whey|cheddar|mozzarella|brie|gouda|dairy|kefir|ghee)s?\b", re.I)),
    ("Meat & Poultry",  re.compile(r"\b(beef|chicken|turkey|pork|ham|sausage|deli meat|hot dog|salami|pepperoni|lamb|veal|bison|venison|prosciutto|bacon)s?\b", re.I)),
    # anchovy/anchovies handled explicitly (irregular plural); s? covers the rest
    ("Seafood",         re.compile(r"\b(fish|shrimp|salmon|tuna|shellfish|crab|lobster|clam|oyster|scallop|anchovy|anchovies|tilapia|cod|halibut|squid|mahi)s?\b", re.I)),
    # berry/berries handled explicitly (irregular plural); salad here catches "green salad" not "salad kit"
    ("Produce",         re.compile(r"\b(fruit|vegetable|lettuce|spinach|berry|berries|apple|tomato|onion|cucumber|pepper|greens|salad|herb|broccoli|celery|carrot|kale|arugula|mushroom|avocado)s?\b", re.I)),
    ("Bakery & Snacks", re.compile(r"\b(bread|cracker|cookie|chip|granola|pretzel|wafer|cake|muffin|roll|bagel|tortilla|popcorn|snack bar|cereal bar)s?\b", re.I)),
    ("Beverages",       re.compile(r"\b(juice|tea|water|smoothie|kombucha|coffee|lemonade|energy drink|soda|beverage|drink|cider|sports drink)s?\b", re.I)),
]

CATEGORY_IDS: list[str] = [name for name, _ in CATEGORIES]


def categorize_recall(recall: "Recall") -> str | None:
    """Return the first matching category ID for this recall, or None."""
    text = recall.product_description or ""
    for name, pattern in CATEGORIES:
        if pattern.search(text):
            return name
    return None
