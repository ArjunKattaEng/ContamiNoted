// Synthetic receipts (fictional stores and brands). Each line pairs the abbreviated text as
// printed with the normalized name the LLM step would produce. A, B and C are the scenarios the
// mock receipt scanner cycles through; D and E only appear in the seeded "returning user" history.
import type { MatchStatus } from '@/types'

export interface ReceiptLineFixture {
  raw: string
  /** Normalized product name ('' for unreadable lines). */
  name: string
  brand?: string
  upc?: string
  price: number
  status: MatchStatus
  recallKeys?: string[]
  /** Recall that only appears after the first watchlist re-check. */
  lateRecallKey?: string
  note?: string
}

export interface ReceiptFixture {
  id: 'A' | 'B' | 'C' | 'D' | 'E'
  label: string
  store: string
  lines: ReceiptLineFixture[]
}

const unreadable = (raw: string, price: number): ReceiptLineFixture => ({
  raw,
  name: '',
  price,
  status: 'error',
  note: 'This line couldn’t be read. Add the item name to check it.',
})

export const receiptFixtures: Record<ReceiptFixture['id'], ReceiptFixture> = {
  A: {
    id: 'A',
    label: 'All clear (12 items)',
    store: 'FreshWay Market #118',
    lines: [
      { raw: 'VLY FRSH 2% MLK GAL', name: '2% Reduced Fat Milk, 1 gal', brand: 'Valley Fresh', price: 4.29, status: 'clear' },
      { raw: 'OAK&GRN ROLLD OATS 42Z', name: 'Old-Fashioned Rolled Oats, 42 oz', brand: 'Oak & Grain', price: 5.49, status: 'clear' },
      { raw: 'BANANAS 2.31LB @ .59', name: 'Bananas, 2.31 lb', price: 1.36, status: 'clear' },
      { raw: 'HRVST MN WHT BRD', name: 'Whole Wheat Bread, 20 oz', brand: 'Harvest Moon', price: 3.79, status: 'clear' },
      { raw: 'PNTRY PRD BLK BNS', name: 'Black Beans, 15.5 oz', brand: 'Pantry Pride', price: 1.19, status: 'clear' },
      { raw: 'CRSP ORCH GALA 3LB', name: 'Gala Apples, 3 lb bag', brand: 'Crisp Orchard', price: 4.99, status: 'clear' },
      { raw: 'CHKN BRST BNLS 1.8LB', name: 'Boneless Chicken Breast, 1.8 lb', price: 9.02, status: 'clear' },
      { raw: 'MRNG RTL MED RST CF', name: 'Medium Roast Ground Coffee, 12 oz', brand: 'Morning Ritual', price: 8.99, status: 'clear' },
      { raw: 'CLRWTR SPRK WTR 1L', name: 'Sparkling Mineral Water, 1 L', brand: 'Clearwater Springs', price: 1.49, status: 'clear' },
      { raw: 'ROMA TOMATOES 1.2LB', name: 'Roma Tomatoes, 1.2 lb', price: 2.15, status: 'clear' },
      { raw: 'FW SHRD MOZZ 8Z', name: 'Shredded Mozzarella Cheese, 8 oz', brand: 'FreshWay', price: 3.49, status: 'clear' },
      { raw: 'SWT LF GRN TEA 40CT', name: 'Green Tea Bags, 40 ct', brand: 'Sweet Leaf Gardens', price: 4.29, status: 'clear' },
    ],
  },
  B: {
    id: 'B',
    label: '1 confirmed + 1 possible (18 items)',
    store: 'Valley Foods #0412',
    lines: [
      {
        raw: 'BRGHTFLD BBY SPNCH 5Z 084135001019',
        name: 'Organic Baby Spinach, 5 oz',
        brand: 'Brightfield Farms',
        upc: '084135001019',
        price: 3.49,
        status: 'confirmed',
        recallKeys: ['spinach'],
        note: 'The UPC printed on your receipt is listed in this recall.',
      },
      {
        raw: 'HRBR BAY SMK SLMN 4Z 065734001181',
        name: 'Cold-Smoked Atlantic Salmon, 4 oz',
        brand: 'Harbor Bay',
        upc: '065734001181',
        price: 6.99,
        status: 'possible',
        recallKeys: ['smokedSalmon'],
        note: 'The recall covers the 8 oz package. Check the lot code on your 4 oz package.',
      },
      { raw: 'VLY FRSH 2% MLK GAL 070126000321', name: '2% Reduced Fat Milk, 1 gal', brand: 'Valley Fresh', upc: '070126000321', price: 4.29, status: 'clear' },
      { raw: '2 @ 1.19 PNTRY PRD BLK BNS 071203005086', name: 'Black Beans, 15.5 oz (2)', brand: 'Pantry Pride', upc: '071203005086', price: 2.38, status: 'clear' },
      { raw: 'BANANAS 4011', name: 'Bananas', price: 1.42, status: 'clear' },
      { raw: '3 @ .99 AVOCADO HASS 4046', name: 'Hass Avocados (3)', price: 2.97, status: 'clear' },
      { raw: 'CLRWTR SPRK WTR 081773000114', name: 'Sparkling Mineral Water, 1 L', brand: 'Clearwater Springs', upc: '081773000114', price: 1.49, status: 'clear' },
      { raw: 'GRND BEEF 85/15 1.3LB', name: 'Ground Beef 85% Lean, 1.3 lb', price: 7.79, status: 'clear' },
      { raw: 'YLW ONIONS 3LB', name: 'Yellow Onions, 3 lb bag', price: 2.99, status: 'clear' },
      {
        raw: 'MDWLRK GRK YGRT 32Z 088902004173',
        name: 'Plain Greek Yogurt, 32 oz',
        brand: 'Meadowlark Dairy',
        upc: '088902004173',
        price: 5.99,
        status: 'clear',
        lateRecallKey: 'yogurt',
      },
      { raw: 'SWT LF GRN TEA 076104002219', name: 'Green Tea Bags, 40 ct', brand: 'Sweet Leaf Gardens', upc: '076104002219', price: 4.29, status: 'clear' },
      { raw: 'VF CHDR SHRP 8Z', name: 'Sharp Cheddar Cheese, 8 oz', brand: 'Valley Foods', price: 3.29, status: 'clear' },
      { raw: 'VF JASMINE RICE 5LB', name: 'Jasmine Rice, 5 lb', brand: 'Valley Foods', price: 8.49, status: 'clear' },
      { raw: 'VF PENNE RIGATE 16Z', name: 'Penne Rigate Pasta, 16 oz', brand: 'Valley Foods', price: 1.29, status: 'clear' },
      { raw: 'NNA ROSA MARINARA 24Z', name: 'Marinara Sauce, 24 oz', brand: 'Nonna Rosa', price: 2.99, status: 'clear' },
      { raw: 'SNRS GRV OJ 52Z', name: 'Orange Juice, 52 oz', brand: 'Sunrise Grove', price: 3.99, status: 'clear' },
      { raw: 'VF LG EGGS 12CT', name: 'Large Eggs, 12 ct', brand: 'Valley Foods', price: 3.49, status: 'clear' },
      { raw: 'BLUEBERRIES 1PT', name: 'Blueberries, 1 pint', price: 3.99, status: 'clear' },
    ],
  },
  C: {
    id: 'C',
    label: 'Crumpled: 2 unreadable lines (9 items)',
    store: 'Corner Grocer #214',
    lines: [
      { raw: 'HRVST MN WHT BRD', name: 'Whole Wheat Bread, 20 oz', brand: 'Harvest Moon', price: 3.79, status: 'clear' },
      { raw: 'OAT MLK HLF GAL', name: 'Oat Milk, half gallon', price: 3.99, status: 'clear' },
      unreadable('#@~ ~R..LE', 2.59),
      { raw: 'BNNAS', name: 'Bananas', price: 0.87, status: 'clear' },
      { raw: 'STRWBRY JAM 18Z', name: 'Strawberry Jam, 18 oz', price: 3.49, status: 'clear' },
      { raw: 'DELI HAM SLCD .5LB', name: 'Sliced Deli Ham, 0.5 lb', price: 4.5, status: 'clear' },
      unreadable('~~ 7 ..3', 1.99),
      { raw: 'GRN BELL PPRS', name: 'Green Bell Peppers', price: 2.49, status: 'clear' },
      { raw: 'CHDR CRCKRS 7Z', name: 'Cheddar Crackers, 7 oz', price: 3.29, status: 'clear' },
    ],
  },
  D: {
    id: 'D',
    label: 'Small, all clear (6 items)',
    store: 'FreshWay Market #118',
    lines: [
      { raw: 'VLY FRSH 2% MLK GAL', name: '2% Reduced Fat Milk, 1 gal', brand: 'Valley Fresh', price: 4.29, status: 'clear' },
      { raw: 'HRVST MN WHT BRD', name: 'Whole Wheat Bread, 20 oz', brand: 'Harvest Moon', price: 3.79, status: 'clear' },
      { raw: 'BANANAS 1.94LB @ .59', name: 'Bananas, 1.94 lb', price: 1.14, status: 'clear' },
      { raw: 'FW LG EGGS 12CT', name: 'Large Eggs, 12 ct', brand: 'FreshWay', price: 3.29, status: 'clear' },
      { raw: 'CRSP ORCH GALA 3LB', name: 'Gala Apples, 3 lb bag', brand: 'Crisp Orchard', price: 4.99, status: 'clear' },
      { raw: 'FW BABY CARROTS 1LB', name: 'Baby Carrots, 1 lb', brand: 'FreshWay', price: 1.49, status: 'clear' },
    ],
  },
  E: {
    id: 'E',
    label: '1 possible (8 items)',
    store: 'Valley Foods #0412',
    lines: [
      {
        raw: 'MPL HLLW HNY ALMD GRNLA 089011003057',
        name: 'Honey Almond Granola, 12 oz',
        brand: 'Maple Hollow',
        upc: '089011003057',
        price: 5.79,
        status: 'possible',
        recallKeys: ['granola'],
        note: 'A Maple Hollow granola from the same bakery is recalled for a packaging mix-up. Check that your bag matches its label.',
      },
      { raw: 'OAK&GRN ROLLD OATS 070391002044', name: 'Old-Fashioned Rolled Oats, 42 oz', brand: 'Oak & Grain', upc: '070391002044', price: 5.49, status: 'clear' },
      { raw: 'VLY FRSH 2% MLK GAL 070126000321', name: '2% Reduced Fat Milk, 1 gal', brand: 'Valley Fresh', upc: '070126000321', price: 4.29, status: 'clear' },
      { raw: 'BLUEBERRIES 1PT', name: 'Blueberries, 1 pint', price: 3.99, status: 'clear' },
      { raw: 'MRNG RTL MED RST 085667001287', name: 'Medium Roast Ground Coffee, 12 oz', brand: 'Morning Ritual', upc: '085667001287', price: 8.99, status: 'clear' },
      { raw: 'VF LG EGGS 12CT', name: 'Large Eggs, 12 ct', brand: 'Valley Foods', price: 3.49, status: 'clear' },
      { raw: 'BANANAS 4011', name: 'Bananas', price: 1.38, status: 'clear' },
      { raw: 'VF HONEY 12Z', name: 'Clover Honey, 12 oz', brand: 'Valley Foods', price: 4.99, status: 'clear' },
    ],
  },
}

/** Scenarios the mock receipt scanner cycles through, in order. */
export const scannerReceiptCycle: ReceiptFixture['id'][] = ['A', 'B', 'C']
