from api.services.barcode import (
    canonical_barcode,
    compress_upc_a,
    expand_upc_e,
    format_upc,
    is_valid_gtin,
    normalize_barcode,
    upc_appears_in,
    upc_search_terms,
)


class TestValidation:
    def test_normalize_keeps_ascii_digits_only(self):
        assert normalize_barcode(" 0-12345 67890-5 ") == "012345678905"
        assert normalize_barcode("٠١٢") == ""  # non-ASCII digits are not barcode digits

    def test_valid_gtins(self):
        for code in ("012345678905", "4006381333931", "96385074", "10012345678902"):
            assert is_valid_gtin(code), code

    def test_invalid_gtins(self):
        for code in ("012345678900", "12345", "01234567890a", "", "0123456789012345"):
            assert not is_valid_gtin(code), code


class TestCanonical:
    def test_upc_e_expands_to_upc_a(self):
        assert expand_upc_e("01234565") == "012345000065"
        assert expand_upc_e("04252614") == "042100005264"
        assert canonical_barcode("01234565") == "012345000065"
        assert expand_upc_e("96385074") is None

    def test_upc_a_compresses_to_upc_e(self):
        assert compress_upc_a("042100005264") == "04252614"
        assert compress_upc_a("012345000065") == "01234565"
        assert compress_upc_a("012345678905") is None  # not compressible
        assert compress_upc_a("852664042694") is None  # number system 8

    def test_upc_e_round_trips(self):
        for code in ("04252614", "01234565", "00123457", "01200003", "01230004", "01234505"):
            upc_a = expand_upc_e(code)
            assert upc_a is not None and compress_upc_a(upc_a) == code, code

    def test_ean8_that_is_not_upc_e_is_kept(self):
        assert canonical_barcode("96385074") == "96385074"

    def test_leading_zeros_shorten_to_upc_a(self):
        assert canonical_barcode("0012345678905") == "012345678905"  # EAN-13
        assert canonical_barcode("00012345678905") == "012345678905"  # GTIN-14
        assert canonical_barcode("0 012345 678905") == "012345678905"

    def test_other_codes_are_left_alone(self):
        assert canonical_barcode("4006381333931") == "4006381333931"
        assert canonical_barcode("10012345678902") == "10012345678902"

    def test_format_upc(self):
        assert format_upc("012345678905") == "0 12345 67890 5"
        assert format_upc("4006381333931") == "4006381333931"


class TestUpcInText:
    def test_forms_printed_in_real_recalls(self):
        # From the openFDA fixture
        assert upc_appears_in("UPC Code: 7 40235 50011 0 Exp Date-Lot Code 01726-040225", "740235500110")
        assert upc_appears_in("REFRIGERATE AFTER OPENING; UPC 040264 10128 0", "040264101280")
        assert upc_appears_in("C Sweet Maamoul with Dates 8 oz., UPC 852664042694", "852664042694")
        assert upc_appears_in("UPC (5 oz.): 609465693477 UPC (10 0z.): 642147152459", "642147152459")

    def test_spaces_dashes_and_ean13_form(self):
        assert upc_appears_in("UPC 0 84135 00101 9; lots BF2681", "084135001019")
        assert upc_appears_in("UPC 0-86112-00412-9", "086112004129")
        assert upc_appears_in("EAN 0086112004129", "086112004129")

    def test_without_check_digit(self):
        assert upc_appears_in("UPC 0 40264 10128, all lots", "040264101280")
        assert upc_appears_in("Item 40264-10128", "040264101280")

    def test_without_the_leading_zero(self):
        for text in ("UPC 40264101280", "UPC 40264 10128 0", "UPC 40264-10128-0", "UPC 4-02641-01280"):
            assert upc_appears_in(text, "040264101280"), text

    def test_gtin14_and_upc_e_forms(self):
        assert upc_appears_in("GTIN 00012345678905", "012345678905")
        assert upc_appears_in("Acme Gum, UPC 04252614", "042100005264")
        assert upc_appears_in("UPC 012345-678905", "012345678905")

    def test_short_forms_must_be_a_whole_barcode_like_number(self):
        # UPC-E 04252614 and the 10/11-digit forms can't match inside lot codes, dates or digit lists
        assert upc_appears_in("UPC 0 425261 4", "042100005264")
        assert not upc_appears_in("Lot codes 0425 2614 3321", "042100005264")
        assert not upc_appears_in("Best by 04-25-2614", "042100005264")
        assert not upc_appears_in("Lot codes 40 26 41 01 28", "040264101280")
        assert not upc_appears_in("Lot 04252614", "042100005264")  # an 8-digit UPC-E needs a label
        assert upc_appears_in("Item 04252614", "042100005264")
        assert upc_appears_in("EAN 9638-5074", "96385074")  # EAN-8 needs a label too
        assert not upc_appears_in("Lot 96385074", "96385074")

    def test_wider_separators(self):
        assert upc_appears_in("UPC 0 - 40264 - 10128 - 0", "040264101280")
        assert upc_appears_in("UPC 0\u201140264\u201110128\u20110", "040264101280")  # non-breaking hyphens

    def test_full_upc_followed_by_another_number(self):
        assert upc_appears_in("UPC 850581007253 25027-05", "850581007253")

    def test_not_inside_longer_numbers(self):
        assert not upc_appears_in("lot 9084135001019", "084135001019")
        assert not upc_appears_in("UPC 0 65734 00119 8", "065734001181")
        # Same item digits, different number system: another product
        assert not upc_appears_in("UPC 1 40264 10128 5", "040264101280")
        assert not upc_appears_in("UPC 1  40264 10128  5", "040264101280")
        assert not upc_appears_in("Lot codes 40264 10128 7", "040264101280")

    def test_empty(self):
        assert not upc_appears_in(None, "012345678905")
        assert not upc_appears_in("UPC 012345678905", "")

    def test_search_terms_cover_common_groupings(self):
        assert upc_search_terms("040264101280") == [
            "040264101280",
            "04026410128",
            "0040264101280",
            "0 40264 10128",
            "040264 10128",
            "40264 10128",
            "040264 101280",
            "00040264101280",
            "40264101280",
        ]
        assert upc_search_terms("042100005264")[-2:] == ["04252614", "0 425261 4"]  # UPC-E forms
        assert upc_search_terms("4006381333931") == ["4006381333931", "400638133393", "04006381333931", "4 006381 333931"]
        assert upc_search_terms("96385074") == ["96385074"]
