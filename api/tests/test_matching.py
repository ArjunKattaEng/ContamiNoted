import pytest

from api.services.matching import brand_query_terms, brand_words, classify, name_words, product_text, words


def by_number(recalls, number):
    return next(r for r in recalls if r.recall_number == number)


# Real openFDA text (H-0682-2026): the ingredient and allergen statements name foods the product isn't
MADELEINES = (
    "Kirkland Signature Traditional Madeleines 12 Count/net wt. 18oz., Item #2000012, UPC 000020000127. Plastic "
    "clamshell container is packed with 9 pieces of Filled Heart Madeleines.  Distributed by Costco Wholesale Corp. "
    "Seattle, WA.   Label of recalled package is read in part: TRADITIONAL MADELEINES***INGREDIENTS: WHEAT FLOUR "
    "**EGGS, BUTTER (CREAM) ***ALLERGEN INFORMATION: CONTAINS WHEAT, EGG, MILK*** PRODUCED ON EQUIPMENT THAT ALSO "
    "PROCESSES PEANUTS, TREE NUTS AND SESAME***."
)


def with_text(recall, description, firm=None):
    return recall.model_copy(update={"product_description": description, "recalling_firm": firm or recall.recalling_firm})


def check(recall, *, upc="012345678905", brand=None, name=None):
    bw = brand_words(brand)
    return classify(recall, upc=upc, brand_ws=bw, name_ws=name_words(name, bw))


class TestWords:
    def test_apostrophes_plurals_and_case(self):
        assert words("Emily Kate's Cookies") == ["emily", "kate", "cookie"]
        assert words("Glass") == ["glass"]  # -ss isn't a plural

    def test_brand_words_drop_legal_and_generic_words(self):
        assert brand_words("Kraft Foods Inc.") == ["kraft"]
        assert brand_words("C Sweet") == ["sweet"]
        assert brand_words(None) == []

    def test_name_words_drop_brand_sizes_and_stopwords(self):
        assert name_words("Bonya Organic Raspberry Yogurt Parfait 8oz", ["bonya"]) == ["raspberry", "yogurt", "parfait"]

    def test_brand_query_terms_use_words_as_written(self):
        assert brand_query_terms("Nature Mills") == [["nature"], ["mills"]]  # not the singular "mill"
        assert brand_query_terms("Nature's Path Inc.") == [["nature's", "natures", "nature"], ["path"]]
        assert brand_query_terms("Emily Kate’s") == [["emily"], ["kate's", "kates", "kate"]]
        assert brand_query_terms("Kraft Foods") == [["kraft"]]
        assert brand_query_terms(None) == []

    @pytest.mark.parametrize(
        "brand,expected",
        [
            ("O'Doul's", [["o'doul's", "odouls", "o'doul"]]),
            ("Land O'Lakes", [["land"], ["o'lakes", "olakes"]]),
            ("Nestlé", [["nestlé", "nestle"]]),
            ("Häagen-Dazs", [["häagen", "haagen"], ["dazs"]]),
            ("M&M's", [["m's", "ms"]]),  # no single-letter "m"
        ],
    )
    def test_brand_query_terms_for_apostrophes_and_accents(self, brand, expected):
        assert brand_query_terms(brand) == expected
        # Same words as local matching, so a searchable brand is never an empty query
        assert len(brand_query_terms(brand)) == len(brand_words(brand))

    @pytest.mark.parametrize(
        "description,expected",
        [
            (MADELEINES, MADELEINES[: MADELEINES.index("INGREDIENTS")]),
            ("Junebar Chocolate Cherry Snack Bar; INGREDIENT: dates", "Junebar Chocolate Cherry Snack Bar; "),
            ("Granola; Manufactured in a facility that processes peanuts", "Granola; Manufactured in a "),
            ("Trail Mix. Contains: peanuts", "Trail Mix. "),
            ("Pure Ground Ingredients-Organic Peppermint Leaf Powder", "Pure Ground Ingredients-Organic Peppermint Leaf Powder"),
            (None, ""),
        ],
    )
    def test_product_text_stops_at_ingredients_allergens_and_facilities(self, description, expected):
        assert product_text(description) == expected

    def test_accents_are_folded_for_matching(self):
        assert words("Nestlé Häagen") == ["nestle", "haagen"]


class TestClassify:
    def test_barcode_in_description_is_confirmed(self, recalls):
        assert check(by_number(recalls, "H-0254-2025"), upc="852664042694") == "confirmed"

    def test_barcode_in_code_info_is_confirmed(self, recalls):
        assert check(by_number(recalls, "F-0801-2025"), upc="642147152459") == "confirmed"
        assert check(by_number(recalls, "H-0088-2025"), upc="740235500110") == "confirmed"

    def test_brand_and_name_is_possible(self, recalls):
        parfait = by_number(recalls, "F-0769-2025")
        assert check(parfait, brand="Bonya", name="Raspberry Yogurt Parfait") == "possible"

    def test_most_words_are_enough_for_long_names(self, recalls):
        parfait = by_number(recalls, "F-0769-2025")
        assert check(parfait, brand="Bonya", name="Raspberry Yogurt Parfait with Granola Topping") == "possible"

    @pytest.mark.parametrize(
        "brand,name",
        [
            ("Chobani", "Raspberry Yogurt Parfait"),  # other brand
            ("Bonya", "Chocolate Pudding"),  # other product
            (None, "Raspberry Yogurt Parfait"),  # no brand: never a name-only match
            ("Bonya", "Bonya"),  # no name beyond the brand: never a brand-only match
        ],
    )
    def test_no_match(self, recalls, brand, name):
        assert check(by_number(recalls, "F-0769-2025"), brand=brand, name=name) is None

    def test_recall_listing_other_upcs_is_still_a_possible_match(self, recalls):
        # The recall prints UPCs and ours isn't found among them; it could be printed in a form we miss, so
        # brand + name still flags it for the user to compare
        maamoul = by_number(recalls, "H-0254-2025")
        assert check(maamoul, upc="012345678905", brand="C Sweet", name="Maamoul with Dates") == "possible"

    def test_brand_alone_is_not_a_match(self, recalls):
        rice = by_number(recalls, "H-0076-2025")
        assert check(rice, brand="Nature Mills", name="Nature Mills") is None
        assert check(rice, brand="Nature Mills", name="Vallarai Rice Mix") == "possible"

    def test_ingredients_and_allergen_warnings_are_not_the_product(self, recalls):
        # Kirkland peanut butter matched this recall on "BUTTER (CREAM)" and "PROCESSES PEANUTS"
        madeleines = with_text(recalls[0], MADELEINES, "Costco Wholesale Corporation")
        assert check(madeleines, brand="Kirkland Signature", name="Organic Creamy Peanut Butter") is None
        assert check(madeleines, brand="Kirkland Signature", name="Traditional Madeleines") == "possible"

    def test_brand_only_in_the_firm_is_not_a_match(self, recalls):
        # The firm (Knockroe Inc) can own many brands; the recalled product's brand is the one in its description
        assert check(by_number(recalls, "F-0769-2025"), brand="Knockroe", name="Raspberry Yogurt Parfait") is None
