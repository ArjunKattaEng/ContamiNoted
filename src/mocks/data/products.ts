// Synthetic barcode catalog (fictional brands). Each product carries the scan outcome the mock
// service returns, so every result state can be demoed by entering or picking one of these UPCs.
import type { MatchStatus, Product } from '@/types'

export interface ProductFixture extends Product {
  /** Outcome at scan time. */
  status: MatchStatus
  /** Keys into recallByKey for confirmed/possible matches. */
  recallKeys: string[]
  /** Key of a recall that only appears after the first watchlist re-check. */
  lateRecallKey?: string
  /** Why it matched, shown on the result screen. */
  note?: string
}

export const productFixtures: ProductFixture[] = [
  // Confirmed: the UPC is printed in the recall's code info
  {
    upc: '084135001019',
    name: 'Organic Baby Spinach',
    brand: 'Brightfield Farms',
    size: '5 oz',
    category: 'Produce',
    status: 'confirmed',
    recallKeys: ['spinach'],
    note: 'This UPC is listed in the recall notice. Check the Best By date and lot code on the clamshell.',
  },
  {
    upc: '072943002168',
    name: 'Creamy Peanut Butter',
    brand: 'Golden Crest',
    size: '16 oz',
    category: 'Pantry',
    status: 'confirmed',
    recallKeys: ['peanutButter'],
    note: 'This UPC is listed in the recall notice. Compare the lot number on the lid with lots 2026-214A through 2026-219C.',
  },
  {
    upc: '086112004129',
    name: 'Chocolate Chip Protein Bars, 12 ct',
    brand: 'Peak Trail',
    size: '12 x 1.76 oz',
    category: 'Snacks',
    status: 'confirmed',
    recallKeys: ['proteinBar'],
    note: 'This UPC is listed in the recall notice for undeclared milk.',
  },
  // Possible: same brand and product type, but this UPC/size isn't listed
  {
    upc: '065734001181',
    name: 'Cold-Smoked Atlantic Salmon',
    brand: 'Harbor Bay',
    size: '4 oz',
    category: 'Seafood',
    status: 'possible',
    recallKeys: ['smokedSalmon'],
    note: 'The recall covers the 8 oz package of this product. Your 4 oz size isn’t listed, but check the lot code (HB-0926, HB-0927).',
  },
  {
    upc: '089011003057',
    name: 'Honey Almond Granola',
    brand: 'Maple Hollow',
    size: '12 oz',
    category: 'Breakfast',
    status: 'possible',
    recallKeys: ['granola'],
    note: 'A Maple Hollow granola from the same bakery is recalled. Your flavor isn’t listed; check that the bag matches its label.',
  },
  {
    upc: '074522001272',
    name: 'Sharp Cheddar Cheese',
    brand: 'Riverbend Creamery',
    size: '8 oz',
    category: 'Dairy',
    status: 'possible',
    recallKeys: ['brie'],
    note: 'Riverbend Creamery recalled its Double Cream Brie. Cheddar isn’t listed, but it comes from the same plant.',
  },
  // Clear
  { upc: '081773000114', name: 'Sparkling Mineral Water', brand: 'Clearwater Springs', size: '1 L', category: 'Beverages', status: 'clear', recallKeys: [] },
  { upc: '070391002044', name: 'Old-Fashioned Rolled Oats', brand: 'Oak & Grain', size: '42 oz', category: 'Breakfast', status: 'clear', recallKeys: [] },
  { upc: '077881001563', name: 'Whole Wheat Bread', brand: 'Harvest Moon', size: '20 oz', category: 'Bakery', status: 'clear', recallKeys: [] },
  { upc: '070126000321', name: '2% Reduced Fat Milk', brand: 'Valley Fresh', size: '1 gal', category: 'Dairy', status: 'clear', recallKeys: [] },
  {
    upc: '088902004173',
    name: 'Plain Greek Yogurt',
    brand: 'Meadowlark Dairy',
    size: '32 oz',
    category: 'Dairy',
    status: 'clear',
    recallKeys: [],
    lateRecallKey: 'yogurt',
  },
  { upc: '071203005086', name: 'Black Beans', brand: 'Pantry Pride', size: '15.5 oz', category: 'Pantry', status: 'clear', recallKeys: [] },
  { upc: '083456000190', name: 'Gala Apples, 3 lb bag', brand: 'Crisp Orchard', size: '3 lb', category: 'Produce', status: 'clear', recallKeys: [] },
  { upc: '085667001287', name: 'Medium Roast Ground Coffee', brand: 'Morning Ritual', size: '12 oz', category: 'Pantry', status: 'clear', recallKeys: [] },
  { upc: '076104002219', name: 'Green Tea Bags, 40 ct', brand: 'Sweet Leaf Gardens', size: '40 ct', category: 'Beverages', status: 'clear', recallKeys: [] },
]

export const productByUpc = new Map(productFixtures.map((p) => [p.upc, p]))

/** One product per outcome, for "Use sample" buttons and the Developer panel. */
export const sampleBarcodes = {
  confirmed: '084135001019',
  possible: '065734001181',
  clear: '070391002044',
  /** Valid check digit, not in the catalog. */
  unknown: '012345678905',
  /** Bad check digit. */
  invalid: '012345678900',
} as const
