"""Food category taxonomy for recall notifications.

Each recall's product_description is matched against these keyword patterns in order. The first
include match that is not excluded wins, so more-specific categories (Pet Food, Baby & Infant,
Supplements) come before broad ones (Dairy, Produce). Category IDs are the contract between the
backend and the frontend (src/lib/categories.ts) — keep them in sync.
"""

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.models import Recall

# (category_id, include_pattern, exclude_pattern | None)
# Searched against product_description only (not reason_for_recall) to prevent false positives
# such as "undeclared milk allergen" tagging a peanut butter recall as Dairy.
# s?\b at the end of include patterns handles regular plurals (cheeses, oysters, almonds …).
# Irregular plurals (berries, anchovies, peaches …) are listed explicitly.
CATEGORIES: list[tuple[str, re.Pattern[str], re.Pattern[str] | None]] = [
    (
        "Pet Food",
        re.compile(
            r"\b(dog food|cat food|pet food|pet treat|dog treat|cat treat|kibble|canine|feline"
            r"|for dogs|for cats|puppy|kitten|rawhide|bully stick|pig ear|animal feed|livestock feed)s?\b",
            re.I,
        ),
        None,
    ),
    (
        "Baby & Infant",
        re.compile(
            r"\b(infant formula|baby food|baby cereal|toddler|puree pouch|teething"
            r"|follow.up formula|for babies|newborn|infant)s?\b",
            re.I,
        ),
        None,
    ),
    (
        "Supplements",
        re.compile(
            r"\b(dietary supplement|supplement|capsule|tablet|softgel|multivitamin|probiotic"
            r"|protein powder|pre.workout|herbal supplement|kratom|moringa|cleanse|detox"
            r"|weight loss|male enhancement|sexual enhancement|fish oil|omega.3|collagen"
            r"|melatonin|vitamin)s?\b",
            re.I,
        ),
        None,
    ),
    (
        "Nuts & Seeds",
        re.compile(
            r"\b(peanut|almond|walnut|cashew|pistachio|pecan|hazelnut|macadamia|brazil nut"
            r"|pine nut|mixed nut|nut butter|peanut butter|almond butter|tahini|sesame"
            r"|sunflower seed|pumpkin seed|chia|flaxseed|flax|hemp seed|seed|nut)s?\b",
            re.I,
        ),
        re.compile(
            r"peanut.free|nut.free|tree nut free|may contain|coconut|doughnut|donut"
            r"|nutmeg|butternut",
            re.I,
        ),
    ),
    (
        "Ready-to-Eat",
        re.compile(
            r"\b(ready to eat|ready.to.eat|rte|sandwich|sub|wrap|burrito|salad kit|meal kit"
            r"|salad|entree|entrée|prepared|deli|sushi|hummus|salsa|guacamole|pesto|dip"
            r"|pasta salad|dumpling|soup|pizza|quiche|parfait|bowl|lunch kit|fresh cut"
            r"|cut fruit|fruit cup|fruit mix)s?\b",
            re.I,
        ),
        re.compile(
            r"salad dressing|soup base mix|salad oil|dip mix|seasoning|deli meat",
            re.I,
        ),
    ),
    (
        "Seafood",
        re.compile(
            r"\b(fish|salmon|tuna|shrimp|prawn|crab|lobster|oyster|clam|mussel|scallop|cod"
            r"|tilapia|catfish|sardine|anchovy|anchovies|mackerel|herring|squid|octopus"
            r"|seafood|shellfish|roe|caviar|fish sauce|shrimp paste|surimi|bonito|smoked fish"
            r"|dried fish)s?\b",
            re.I,
        ),
        re.compile(
            r"fish oil|swedish fish|goldfish cracker|cod liver oil",
            re.I,
        ),
    ),
    (
        "Dairy",
        # Eggs follow grocery-store convention ("Dairy & Eggs"). Shell eggs are FDA-regulated.
        re.compile(
            r"\b(milk|cheese|queso|requeson|yogurt|yoghurt|butter|cream|sour cream|ice cream"
            r"|gelato|kefir|whey|ghee|cottage cheese|cream cheese|mozzarella|cheddar|brie"
            r"|ricotta|paneer|crema|custard|dairy|egg|shell egg)s?\b",
            re.I,
        ),
        re.compile(
            r"peanut butter|almond butter|cashew butter|nut butter|sunflower butter|seed butter"
            r"|cocoa butter|shea butter|apple butter|coconut milk|almond milk|oat milk|soy milk"
            r"|rice milk|cream of tartar|dairy.free|dairy free|non.dairy|milk thistle"
            r"|egg.free|egg free|eggless|eggplant",
            re.I,
        ),
    ),
    (
        "Meat & Poultry",
        re.compile(
            r"\b(beef|pork|chicken|turkey|lamb|veal|goat meat|ham|bacon|sausage|salami"
            r"|pepperoni|chorizo|jerky|gyro|meatball|hot links|prosciutto|bologna|deli meat"
            r"|poultry|duck|venison|bison|hot dog)s?\b",
            re.I,
        ),
        re.compile(
            r"hot dog bun|turkey hill|chicken of the sea|eggplant|egg.free|egg free|eggless"
            r"|chicken.free|plant.based|meatless|beefsteak tomato|duck sauce|bouillon",
            re.I,
        ),
    ),
    (
        "Produce",
        # "fresh" omitted — too broad ("Fresh Baked Bread" would false-match).
        re.compile(
            r"\b(frozen vegetable|vegetable|fruit|cucumber|tomato|onion|leek|lettuce|spinach"
            r"|kale|romaine|cabbage|celery|carrot|pepper|peas|okra|corn|broccoli|cauliflower"
            r"|mushroom|enoki|sprout|alfalfa|herb|basil|cilantro|parsley|green onion|scallion"
            r"|apple|peach|peaches|nectarine|plum|cantaloupe|melon|honeydew|watermelon|berries"
            r"|berry|strawberry|strawberries|blueberries|raspberries|grapes|mango|pineapple"
            r"|papaya|avocado|banana|citrus|lemon|lime|orange|salad mix|potato)s?\b",
            re.I,
        ),
        re.compile(
            r"fruit snacks?|fruit punch|fruit flavored|lemon flavored|lime flavored"
            r"|orange flavored|strawberry flavor|potato chip|corn chip|corn syrup|corn tortilla"
            r"|popcorn|caramel corn|pepperoni|dr pepper|red pepper flakes|black pepper"
            r"|white pepper|ground pepper|orange juice|apple juice|lemonade|iced lemon"
            r"|cherry pepper|herbal tea|herbal supplement|onion flavored|sour cream and onion"
            r"|basil pesto|bell pepper hummus",
            re.I,
        ),
    ),
    (
        "Bakery & Snacks",
        # oat / oatmeal added (e.g. "Quaker Oats"). flour added for baking recalls.
        re.compile(
            r"\b(bread|bun|bagel|roll|muffin|croissant|cake|cupcake|brownie|cookie|galletas"
            r"|cookie dough|pastry|donut|doughnut|pie|tart|biscuit|cracker|chip|pretzel"
            r"|popcorn|snack|trail mix|granola|bar|candy|chocolate|caramel|toffee|fudge"
            r"|gummy|gummies|marshmallow|cereal|sourdough|tortilla|brioche|toast|sweets"
            r"|mithai|oat|oatmeal|flour)s?\b",
            re.I,
        ),
        re.compile(
            r"chocolate milk|salad bar|bar code|chocolate flavored drink",
            re.I,
        ),
    ),
    (
        "Spices & Condiments",
        re.compile(
            r"\b(spice|seasoning|curry powder|cinnamon|turmeric|paprika|chili powder|cumin"
            r"|asafoetida|hing|garam masala|black pepper|ground pepper|red pepper flakes"
            r"|oregano|sauce|sriracha|hot sauce|ketchup|mustard|mayonnaise|dressing"
            r"|salad dressing|olive oil|oil|vinegar|honey|syrup|jam|jelly|paste|soup base"
            r"|bouillon)s?\b",
            re.I,
        ),
        re.compile(
            r"fish oil|tomato paste.free",
            re.I,
        ),
    ),
    (
        "Beverages",
        # fl oz / fl. oz omitted — unit of measure, not a category signal.
        re.compile(
            r"\b(juice|beverage|drink|water|sparkling water|soda|soft drink|tea|iced tea"
            r"|green tea|kombucha|coffee|cold brew|lemonade|smoothie|energy drink|sports drink"
            r"|electrolyte|hydration|powerade|gatorade|cider|nectar|tisane|teabag)s?\b",
            re.I,
        ),
        re.compile(
            r"water chestnut|watermelon|watercress|tea cake|coffee cake|toffee",
            re.I,
        ),
    ),
]

CATEGORY_IDS: list[str] = [name for name, _, __ in CATEGORIES]


def categorize_recall(recall: "Recall") -> str | None:
    """Return the first matching category ID for this recall, or None.

    Checks include pattern first; if it matches, checks the exclude pattern (if any). The first
    category whose include matches and exclude does not wins. Returns None if nothing matches.
    """
    text = recall.product_description or ""
    for name, include_pat, exclude_pat in CATEGORIES:
        if include_pat.search(text):
            if exclude_pat is None or not exclude_pat.search(text):
                return name
    return None
