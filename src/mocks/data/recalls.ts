// Synthetic FDA food recalls. All firms, brands, products and phone numbers (555-01xx) are
// fictional. Field names and text style follow openFDA food enforcement records; the summary
// sections follow the AI summary format from the old food-recall pipeline's prompt_builder.py.
import type { Classification, Recall, RecallStatus, RecallSummarySections } from '@/types'
import { DEMO_SUMMARY_MODEL } from '@/lib/demo'
import { daysAgo, timestampDaysAgo } from './dates'

type Hazard =
  | 'listeria'
  | 'salmonella'
  | 'ecoli'
  | 'allergen'
  | 'botulism'
  | 'lead'
  | 'hepatitisA'
  | 'histamine'
  | 'foreignMaterial'
  | 'patulin'
  | 'labeling'

interface RecallSeed {
  key: string
  initiatedDaysAgo: number
  /** Days between initiation and the FDA report date. */
  reportLag: number
  status: RecallStatus
  classification: Classification
  firm: string
  city: string
  state: string
  phone?: string
  product: string
  quantity: string
  codeInfo: string
  distribution: string
  reason: string
  hazard: Hazard
  allergen?: string
  extraAction?: string
  shortSummary: string
  /** Hidden until the first watchlist re-check "discovers" it (see mocks/services). */
  late?: boolean
}

/** MM/DD/YYYY for a date `n` days from now (negative = past). */
const usDate = (daysFromNow: number) => {
  const [y, m, d] = daysAgo(-daysFromNow).split('-')
  return `${m}/${d}/${y}`
}

const seeds: RecallSeed[] = [
  {
    key: 'spinach',
    initiatedDaysAgo: 6,
    reportLag: 2,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Brightfield Farms, LLC',
    city: 'Salinas',
    state: 'CA',
    phone: '1-800-555-0142',
    product: 'Brightfield Farms Organic Baby Spinach, 5 oz (142 g) clear plastic clamshell',
    quantity: '18,240 clamshells',
    codeInfo: `UPC 0 84135 00101 9; Best By dates ${usDate(4)} through ${usDate(10)}; lot codes BF2681 through BF2687`,
    distribution: 'Retail grocery stores and online grocery orders in CA, OR, WA, NV and AZ.',
    reason: 'Potential contamination with Listeria monocytogenes, identified through routine product sampling by the firm.',
    hazard: 'listeria',
    shortSummary: 'Brightfield Farms is recalling 5 oz Organic Baby Spinach clamshells sold in five western states because they may be contaminated with Listeria.',
  },
  {
    key: 'peanutButter',
    initiatedDaysAgo: 12,
    reportLag: 3,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Golden Crest Foods, Inc.',
    city: 'Lynchburg',
    state: 'VA',
    phone: '1-800-555-0118',
    product: 'Golden Crest Creamy Peanut Butter, 16 oz (454 g) plastic jar',
    quantity: '64,500 jars',
    codeInfo: 'UPC 072943002168; lot numbers 2026-214A through 2026-219C; Best If Used By dates in 2028',
    distribution: 'Nationwide through retail stores and distributors.',
    reason: 'Products may be contaminated with Salmonella. The firm found the organism in an environmental sample from a roasting line.',
    hazard: 'salmonella',
    shortSummary: 'Golden Crest Foods is recalling 16 oz Creamy Peanut Butter jars sold nationwide because they may be contaminated with Salmonella.',
  },
  {
    key: 'proteinBar',
    initiatedDaysAgo: 20,
    reportLag: 5,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Peak Trail Nutrition Co.',
    city: 'Boulder',
    state: 'CO',
    phone: '1-888-555-0163',
    product: 'Peak Trail Chocolate Chip Protein Bars, 12 ct box (12 x 1.76 oz / 50 g bars)',
    quantity: '9,800 boxes',
    codeInfo: `UPC 0-86112-00412-9; lot 6231PT and 6232PT; Best By ${usDate(160)}`,
    distribution: 'Retail stores in CO, UT, NM, WY and online sales nationwide.',
    reason: 'Product contains undeclared milk. A supplier changed the chocolate chips used in the bars, and the new chips contain milk that is not listed on the label.',
    hazard: 'allergen',
    allergen: 'milk',
    shortSummary: 'Peak Trail Nutrition is recalling 12-count Chocolate Chip Protein Bar boxes because the bars contain milk that is not declared on the label.',
  },
  {
    key: 'smokedSalmon',
    initiatedDaysAgo: 9,
    reportLag: 4,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Harbor Bay Seafood Co.',
    city: 'Portland',
    state: 'ME',
    phone: '1-207-555-0137',
    product: 'Harbor Bay Cold-Smoked Atlantic Salmon, 8 oz (227 g) vacuum-sealed package',
    quantity: '4,120 packages',
    codeInfo: `UPC 0 65734 00119 8; lot HB-0926 and HB-0927; Use By ${usDate(12)}`,
    distribution: 'Seafood counters and grocery stores in ME, NH, MA, CT, NY and NJ.',
    reason: 'Potential contamination with Listeria monocytogenes found during FDA sampling at the processing facility.',
    hazard: 'listeria',
    shortSummary: 'Harbor Bay Seafood is recalling 8 oz Cold-Smoked Atlantic Salmon packages sold in the Northeast because of possible Listeria contamination.',
  },
  {
    key: 'granola',
    initiatedDaysAgo: 27,
    reportLag: 6,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Maple Hollow Bakery',
    city: 'Burlington',
    state: 'VT',
    phone: '1-802-555-0129',
    product: 'Maple Hollow Maple Pecan Granola, 12 oz (340 g) resealable bag',
    quantity: '2,760 bags',
    codeInfo: `UPC 089011003064; Best By ${usDate(120)} and ${usDate(127)}`,
    distribution: 'Retail stores in VT, NH, ME, MA and NY.',
    reason: 'Product contains undeclared almonds (tree nuts). Bags of Honey Almond Granola were packed in Maple Pecan Granola packaging.',
    hazard: 'allergen',
    allergen: 'almonds (tree nuts)',
    shortSummary: 'Maple Hollow Bakery is recalling 12 oz Maple Pecan Granola bags that may contain undeclared almonds after a packaging mix-up.',
  },
  {
    key: 'brie',
    initiatedDaysAgo: 15,
    reportLag: 4,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Riverbend Creamery',
    city: 'Eau Claire',
    state: 'WI',
    phone: '1-715-555-0154',
    product: 'Riverbend Creamery Double Cream Brie, 7 oz (198 g) wheel',
    quantity: '3,350 wheels',
    codeInfo: `UPC 074522001289; Sell By ${usDate(5)} through ${usDate(21)}`,
    distribution: 'Retail cheese counters and grocery stores in WI, MN, IL, IA and MI.',
    reason: 'Potential contamination with Listeria monocytogenes. The firm detected the organism in finished product testing.',
    hazard: 'listeria',
    shortSummary: 'Riverbend Creamery is recalling 7 oz Double Cream Brie wheels sold in five Midwest states because they may be contaminated with Listeria.',
  },
  {
    key: 'eggs',
    initiatedDaysAgo: 140,
    reportLag: 8,
    status: 'Completed',
    classification: 'Class I',
    firm: 'Sunny Acres Egg Farm',
    city: 'Lancaster',
    state: 'PA',
    product: 'Sunny Acres Grade A Large Brown Eggs, 12 ct carton',
    quantity: '52,000 cartons',
    codeInfo: 'Plant number P-1842; Julian dates 112 through 128 printed on the carton end',
    distribution: 'Retail stores in PA, NJ, NY, DE and MD.',
    reason: 'Eggs may be contaminated with Salmonella Enteritidis, linked to an FDA inspection of the laying facility.',
    hazard: 'salmonella',
    shortSummary: 'Sunny Acres Egg Farm recalled 12-count Grade A Large Brown Egg cartons sold in five Mid-Atlantic states because of possible Salmonella contamination.',
  },
  {
    key: 'babyFood',
    initiatedDaysAgo: 33,
    reportLag: 7,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Little Sprout Organics',
    city: 'Austin',
    state: 'TX',
    phone: '1-866-555-0171',
    product: 'Little Sprout Apple Cinnamon Fruit Puree Pouches, 4 oz (113 g), 4-pack',
    quantity: '21,600 4-packs',
    codeInfo: `UPC 0 85902 00233 7; lot LS26-301 through LS26-318; Best By ${usDate(200)}`,
    distribution: 'Nationwide through retail stores and online retailers.',
    reason: 'Elevated levels of lead were found in the cinnamon used as an ingredient.',
    hazard: 'lead',
    shortSummary: 'Little Sprout Organics is recalling Apple Cinnamon Fruit Puree pouch 4-packs sold nationwide because the cinnamon contained elevated levels of lead.',
  },
  {
    key: 'soup',
    initiatedDaysAgo: 4,
    reportLag: 1,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Northstar Kitchens, Inc.',
    city: 'Duluth',
    state: 'MN',
    phone: '1-800-555-0186',
    product: 'Northstar Hearty Chicken & Wild Rice Soup, 18.5 oz (524 g) can',
    quantity: '31,200 cans',
    codeInfo: 'UPC 0 76655 00318 2; can code NSK 2683 through NSK 2690; Best By dates in 2029',
    distribution: 'Nationwide through retail grocery stores.',
    reason: 'Commercial sterility deviation: a portion of product may have been underprocessed, which could allow Clostridium botulinum to grow.',
    hazard: 'botulism',
    shortSummary: 'Northstar Kitchens is recalling 18.5 oz cans of Hearty Chicken & Wild Rice Soup sold nationwide because underprocessing could allow botulism-causing bacteria to grow.',
  },
  {
    key: 'appleJuice',
    initiatedDaysAgo: 160,
    reportLag: 10,
    status: 'Terminated',
    classification: 'Class II',
    firm: 'Orchard Lane Cider Mill',
    city: 'Hood River',
    state: 'OR',
    product: 'Orchard Lane 100% Apple Juice, 64 fl oz (1.89 L) bottle',
    quantity: '7,400 bottles',
    codeInfo: 'UPC 0 81477 00064 1; lot OL-5521',
    distribution: 'Retail stores in OR, WA and ID.',
    reason: 'Patulin levels above the FDA action level of 50 micrograms per kilogram.',
    hazard: 'patulin',
    shortSummary: 'Orchard Lane Cider Mill recalled 64 oz bottles of 100% Apple Juice sold in the Pacific Northwest because patulin levels exceeded the FDA action level.',
  },
  {
    key: 'cookies',
    initiatedDaysAgo: 24,
    reportLag: 5,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Tasty Bites Bakery, LLC',
    city: 'Charlotte',
    state: 'NC',
    phone: '1-704-555-0122',
    product: 'Tasty Bites Oatmeal Raisin Cookies, 10 oz (283 g) package',
    quantity: '12,900 packages',
    codeInfo: `UPC 0 79345 00510 4; Best By ${usDate(45)} through ${usDate(60)}`,
    distribution: 'Retail stores in NC, SC, VA, GA and TN.',
    reason: 'Product contains undeclared egg. An egg wash was added to the recipe without updating the label.',
    hazard: 'allergen',
    allergen: 'egg',
    shortSummary: 'Tasty Bites Bakery is recalling 10 oz Oatmeal Raisin Cookie packages because they contain egg that is not declared on the label.',
  },
  {
    key: 'romaine',
    initiatedDaysAgo: 95,
    reportLag: 3,
    status: 'Completed',
    classification: 'Class I',
    firm: 'Green Valley Produce',
    city: 'Yuma',
    state: 'AZ',
    product: 'Green Valley Chopped Romaine Hearts, 10 oz (283 g) bag',
    quantity: '26,700 bags',
    codeInfo: 'UPC 0 71922 00410 6; lot GV-0612 through GV-0619',
    distribution: 'Retail stores in AZ, CA, NV, NM, TX and CO.',
    reason: 'Potential contamination with Shiga toxin-producing E. coli O157:H7.',
    hazard: 'ecoli',
    shortSummary: 'Green Valley Produce recalled 10 oz bags of Chopped Romaine Hearts sold in six southwestern states because of possible E. coli O157:H7 contamination.',
  },
  {
    key: 'flour',
    initiatedDaysAgo: 48,
    reportLag: 9,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Prairie Mill Co.',
    city: 'Kansas City',
    state: 'MO',
    phone: '1-816-555-0148',
    product: 'Prairie Mill All-Purpose Flour, 5 lb (2.27 kg) paper bag',
    quantity: '40,800 bags',
    codeInfo: `UPC 0 70412 00500 8; lot PM6-1102 and PM6-1103; Better If Used By ${usDate(300)}`,
    distribution: 'Retail stores in MO, KS, NE, IA, OK and AR.',
    reason: 'Potential contamination with E. coli O121, detected by state sampling.',
    hazard: 'ecoli',
    extraAction: 'Never eat raw dough or batter made with flour; bake or cook it thoroughly.',
    shortSummary: 'Prairie Mill is recalling 5 lb bags of All-Purpose Flour sold in six central states because of possible E. coli O121 contamination.',
  },
  {
    key: 'iceCream',
    initiatedDaysAgo: 39,
    reportLag: 6,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Glacier Point Creamery',
    city: 'Rapid City',
    state: 'SD',
    phone: '1-605-555-0110',
    product: 'Glacier Point Vanilla Bean Ice Cream, 1.5 qt (1.42 L) carton',
    quantity: '15,300 cartons',
    codeInfo: 'UPC 0 83771 00150 3; production codes GP-2618 through GP-2624',
    distribution: 'Retail stores in SD, ND, NE, MN, MT and WY.',
    reason: 'Potential contamination with Listeria monocytogenes found on equipment surfaces at the plant.',
    hazard: 'listeria',
    shortSummary: 'Glacier Point Creamery is recalling 1.5 quart Vanilla Bean Ice Cream cartons sold in six northern states because of possible Listeria contamination.',
  },
  {
    key: 'cinnamon',
    initiatedDaysAgo: 58,
    reportLag: 12,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Spice Route Trading Co.',
    city: 'Edison',
    state: 'NJ',
    phone: '1-732-555-0195',
    product: 'Spice Route Ground Cinnamon, 2.37 oz (67 g) glass jar',
    quantity: '8,450 jars',
    codeInfo: 'UPC 0 84321 00237 9; lot SR4417; Best By 2029',
    distribution: 'Retail stores and online sales nationwide.',
    reason: 'FDA testing found elevated levels of lead in the product.',
    hazard: 'lead',
    shortSummary: 'Spice Route Trading is recalling 2.37 oz jars of Ground Cinnamon sold nationwide after FDA testing found elevated lead levels.',
  },
  {
    key: 'pesto',
    initiatedDaysAgo: 120,
    reportLag: 5,
    status: 'Completed',
    classification: 'Class I',
    firm: 'Bella Cucina Fresh Foods',
    city: 'Providence',
    state: 'RI',
    product: 'Bella Cucina Basil Pesto, 6 oz (170 g) refrigerated glass jar',
    quantity: '5,900 jars',
    codeInfo: 'UPC 0 72118 00060 5; lot BC-3381',
    distribution: 'Retail stores in RI, MA, CT and NY.',
    reason: 'Product was manufactured without adequate controls for Clostridium botulinum.',
    hazard: 'botulism',
    shortSummary: 'Bella Cucina Fresh Foods recalled 6 oz jars of refrigerated Basil Pesto because it was made without adequate controls against botulism.',
  },
  {
    key: 'tortillaChips',
    initiatedDaysAgo: 18,
    reportLag: 4,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Crunchy Corner Snacks',
    city: 'San Antonio',
    state: 'TX',
    phone: '1-210-555-0133',
    product: 'Crunchy Corner Lime Tortilla Chips, 11 oz (312 g) bag',
    quantity: '17,600 bags',
    codeInfo: `UPC 0 78890 00110 2; Best By ${usDate(70)}`,
    distribution: 'Retail stores in TX, OK, LA, NM and AR.',
    reason: 'Bags of Lime Tortilla Chips may contain Nacho Cheese Tortilla Chips, which contain milk that is not declared on the label.',
    hazard: 'allergen',
    allergen: 'milk',
    shortSummary: 'Crunchy Corner Snacks is recalling 11 oz Lime Tortilla Chip bags that may contain nacho cheese chips with undeclared milk.',
  },
  {
    key: 'berries',
    initiatedDaysAgo: 29,
    reportLag: 3,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Morning Glow Farms',
    city: 'Watsonville',
    state: 'CA',
    phone: '1-831-555-0177',
    product: 'Morning Glow Frozen Mixed Berries (strawberries, blueberries, raspberries), 32 oz (907 g) bag',
    quantity: '22,100 bags',
    codeInfo: `UPC 0 86245 00320 0; Best By ${usDate(400)} through ${usDate(430)}`,
    distribution: 'Retail stores nationwide.',
    reason: 'Potential contamination with hepatitis A virus in imported raspberries used in the blend.',
    hazard: 'hepatitisA',
    shortSummary: 'Morning Glow Farms is recalling 32 oz bags of Frozen Mixed Berries sold nationwide because the raspberries may be contaminated with hepatitis A.',
  },
  {
    key: 'cantaloupe',
    initiatedDaysAgo: 175,
    reportLag: 4,
    status: 'Terminated',
    classification: 'Class I',
    firm: 'Fresh Fields Growers',
    city: 'Nogales',
    state: 'AZ',
    product: 'Fresh Fields whole cantaloupe, sold individually with PLU sticker 4050',
    quantity: '96,000 melons',
    codeInfo: 'PLU 4050 stickers reading "Fresh Fields — Product of Mexico"; harvested in a 10-day window',
    distribution: 'Nationwide through retail stores and wholesalers.',
    reason: 'Potential contamination with Salmonella linked to a multistate outbreak.',
    hazard: 'salmonella',
    shortSummary: 'Fresh Fields Growers recalled whole cantaloupes with PLU sticker 4050 sold nationwide because they were linked to a Salmonella outbreak.',
  },
  {
    key: 'tuna',
    initiatedDaysAgo: 64,
    reportLag: 11,
    status: 'Ongoing',
    classification: 'Class II',
    firm: 'Seaside Pantry Foods',
    city: 'San Diego',
    state: 'CA',
    phone: '1-619-555-0166',
    product: 'Seaside Pantry Yellowfin Tuna Steaks in Olive Oil, 5 oz (142 g) can',
    quantity: '11,040 cans',
    codeInfo: 'UPC 0 74309 00500 9; can codes SP2617A through SP2619C',
    distribution: 'Retail stores in CA, AZ, NV and online sales nationwide.',
    reason: 'Elevated histamine levels (scombrotoxin) were detected in product testing.',
    hazard: 'histamine',
    shortSummary: 'Seaside Pantry Foods is recalling 5 oz cans of Yellowfin Tuna Steaks in Olive Oil because testing found elevated histamine levels.',
  },
  {
    key: 'bread',
    initiatedDaysAgo: 82,
    reportLag: 6,
    status: 'Completed',
    classification: 'Class II',
    firm: 'Hearthstone Bakery',
    city: 'Grand Rapids',
    state: 'MI',
    product: 'Hearthstone Multigrain Sandwich Bread, 24 oz (680 g) loaf',
    quantity: '14,500 loaves',
    codeInfo: 'UPC 0 77210 00240 4; bag clip codes HB-2201 through HB-2204',
    distribution: 'Retail stores in MI, IN, OH and IL.',
    reason: 'Products may contain fragments of metal from a damaged mixer blade.',
    hazard: 'foreignMaterial',
    shortSummary: 'Hearthstone Bakery recalled 24 oz Multigrain Sandwich Bread loaves sold in four Midwest states because they may contain metal fragments.',
  },
  {
    key: 'chocolate',
    initiatedDaysAgo: 150,
    reportLag: 7,
    status: 'Terminated',
    classification: 'Class II',
    firm: 'Sweet Meadow Confections',
    city: 'Lititz',
    state: 'PA',
    product: 'Sweet Meadow Dark Chocolate Sea Salt Bar, 3.5 oz (100 g)',
    quantity: '6,300 bars',
    codeInfo: 'UPC 0 85010 00350 7; lot SM-1190',
    distribution: 'Retail stores and online sales nationwide.',
    reason: 'Product contains undeclared hazelnuts due to shared production equipment.',
    hazard: 'allergen',
    allergen: 'hazelnuts (tree nuts)',
    shortSummary: 'Sweet Meadow Confections recalled 3.5 oz Dark Chocolate Sea Salt Bars sold nationwide because they may contain undeclared hazelnuts.',
  },
  {
    key: 'kombucha',
    initiatedDaysAgo: 41,
    reportLag: 8,
    status: 'Ongoing',
    classification: 'Class III',
    firm: 'Kettle & Kin Brewing',
    city: 'Asheville',
    state: 'NC',
    phone: '1-828-555-0104',
    product: 'Kettle & Kin Ginger Kombucha, 16 fl oz (473 mL) glass bottle',
    quantity: '8,900 bottles',
    codeInfo: `UPC 0 86733 00160 1; Best By ${usDate(30)} through ${usDate(45)}`,
    distribution: 'Retail stores in NC, SC, GA and TN.',
    reason: 'Product labeled as non-alcoholic may contain more than 0.5% alcohol by volume due to continued fermentation.',
    hazard: 'labeling',
    shortSummary: 'Kettle & Kin Brewing is recalling 16 oz Ginger Kombucha bottles labeled non-alcoholic because they may contain more than 0.5% alcohol.',
  },
  {
    key: 'yogurt',
    initiatedDaysAgo: 1,
    reportLag: 0,
    status: 'Ongoing',
    classification: 'Class I',
    firm: 'Meadowlark Dairy Cooperative',
    city: 'Ithaca',
    state: 'NY',
    phone: '1-607-555-0158',
    product: 'Meadowlark Dairy Plain Greek Yogurt, 32 oz (907 g) tub',
    quantity: '13,780 tubs',
    codeInfo: `UPC 0 88902 00417 3; Use By ${usDate(9)} through ${usDate(23)}; plant code 36-1142`,
    distribution: 'Retail stores in NY, PA, NJ, CT, MA and VT.',
    reason: 'Potential contamination with Listeria monocytogenes found in finished product testing.',
    hazard: 'listeria',
    shortSummary: 'Meadowlark Dairy is recalling 32 oz tubs of Plain Greek Yogurt sold in six northeastern states because of possible Listeria contamination.',
    late: true,
  },
]

const classificationMeaning: Record<Classification, string> = {
  'Class I': 'there is a reasonable probability that eating the product will cause serious health problems or death',
  'Class II': 'eating the product may cause temporary or medically reversible health problems, and serious problems are unlikely',
  'Class III': 'eating the product is not likely to cause health problems',
}

const genericAction = '- Stop using the product.\n- Return it to the place of purchase for a full refund, or throw it away.'

function hazardText(seed: RecallSeed): { risks: string; action: string } {
  const allergen = seed.allergen ?? 'this ingredient'
  switch (seed.hazard) {
    case 'listeria':
      return {
        risks:
          'Listeria monocytogenes can cause listeriosis, a serious and sometimes fatal infection in young children, older adults and people with weakened immune systems. Healthy people may have short-term fever, headache, stiffness, nausea, abdominal pain and diarrhea. Listeriosis can cause miscarriage and stillbirth in pregnant people. Symptoms can appear up to 70 days after eating contaminated food.',
        action:
          '- **Do not eat** the product. Throw it away or return it to the store for a refund.\n- Clean refrigerator shelves and containers that touched the product: Listeria can grow at refrigerator temperatures.\n- If you are pregnant, over 65 or immunocompromised and develop fever or muscle aches, contact your healthcare provider and mention possible Listeria exposure.',
      }
    case 'salmonella':
      return {
        risks:
          'Salmonella can cause fever, diarrhea (which may be bloody), nausea, vomiting and abdominal pain, usually 12–72 hours after eating. Most people recover in 4–7 days, but infants, older adults and people with weakened immune systems can develop severe illness.',
        action:
          '- **Do not eat** the product. Throw it away or return it for a refund.\n- Wash hands, utensils and surfaces that touched the product with hot, soapy water.\n- Contact your healthcare provider if you develop symptoms.',
      }
    case 'ecoli':
      return {
        risks:
          'Shiga toxin-producing E. coli can cause severe stomach cramps, bloody diarrhea and vomiting. Some people, especially young children and older adults, develop hemolytic uremic syndrome (HUS), a type of kidney failure.',
        action:
          '- **Do not eat** the product. Throw it away or return it for a refund.\n- Wash hands and surfaces that touched the product.\n- Seek medical care for bloody diarrhea or decreased urination.',
      }
    case 'allergen':
      return {
        risks: `People who have an allergy or severe sensitivity to ${allergen} risk a serious or life-threatening allergic reaction if they eat this product. It is safe for people without this allergy.`,
        action: `- If you or someone in your household is allergic to ${allergen}, **do not eat** the product.\n- Return it to the place of purchase for a full refund, or throw it away.\n- Seek emergency care for signs of a severe reaction (trouble breathing, swelling, hives).`,
      }
    case 'botulism':
      return {
        risks:
          'Clostridium botulinum produces a toxin that causes botulism, a rare but potentially fatal illness. Symptoms include double or blurred vision, drooping eyelids, slurred speech, difficulty swallowing and muscle weakness. Seek emergency care immediately if these occur.',
        action:
          '- **Do not open or eat** the product, even if it looks and smells normal.\n- Double-bag the container and throw it away, or return it to the store.\n- Wash hands and any surfaces the container touched.',
      }
    case 'lead':
      return {
        risks:
          'Short-term lead exposure may not cause obvious symptoms. Children are most vulnerable: lead can affect learning and development. Long-term exposure in adults can cause kidney damage and high blood pressure.',
        action:
          '- Stop using the product and throw it away or return it.\n- If you are concerned a child was exposed, ask your pediatrician about a blood lead test.',
      }
    case 'hepatitisA':
      return {
        risks:
          'Hepatitis A is a contagious liver infection. Symptoms (fatigue, nausea, abdominal pain, dark urine and yellowing of the skin or eyes) usually appear 15–50 days after exposure.',
        action:
          '- **Do not eat** the product; throw it away.\n- If you ate it in the last 14 days and are not vaccinated, ask your healthcare provider about post-exposure vaccination.',
      }
    case 'histamine':
      return {
        risks:
          'Scombrotoxin (histamine) fish poisoning can cause tingling around the mouth, flushing, headache, rash, nausea and diarrhea within minutes to hours. Symptoms are usually short-lived but can be severe for people with asthma or heart conditions.',
        action: genericAction,
      }
    case 'foreignMaterial':
      return {
        risks: 'Hard or sharp foreign objects can cause cuts or injuries to the mouth, teeth or digestive tract. No injuries have been reported.',
        action: genericAction,
      }
    case 'patulin':
      return {
        risks:
          'Patulin is a toxin produced by molds on damaged apples. Regularly consuming it above the FDA action level may cause nausea and stomach upset; a single serving is unlikely to cause harm.',
        action: genericAction,
      }
    case 'labeling':
      return {
        risks:
          'Drinking this product is not likely to cause health problems for most people, but people who avoid alcohol (including pregnant people, people in recovery and children) may consume it unknowingly.',
        action: genericAction,
      }
  }
}

function usFromYmd(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${m}/${d}/${y}`
}

function buildSections(seed: RecallSeed, recall: Omit<Recall, 'summary'>): RecallSummarySections {
  const { risks, action } = hazardText(seed)
  const resolved = seed.status !== 'Ongoing'
  const statusPhrase = resolved
    ? `has been **${seed.status.toLowerCase()}**`
    : 'is **ongoing**'
  return {
    overview: `${seed.shortSummary} The recall is voluntary and ${statusPhrase}. FDA classified it as **${seed.classification}**, meaning ${classificationMeaning[seed.classification]}.`,
    productDetails: `- **Product:** ${seed.product}\n- **Quantity recalled:** ${seed.quantity}\n- **Codes:** ${seed.codeInfo}`,
    reason: seed.reason,
    healthRisks: risks,
    distribution: seed.distribution,
    actionRequired:
      (resolved
        ? '_This recall is closed and affected product should no longer be on store shelves, but check your pantry, fridge and freezer for any you may still have._\n\n'
        : '') +
      action +
      (seed.extraAction ? `\n- ${seed.extraAction}` : ''),
    additionalInfo: [
      `- **Recall number:** ${recall.recallNumber}`,
      `- **Event ID:** ${recall.eventId}`,
      `- **Recall initiated:** ${usFromYmd(recall.recallInitiationDate)}`,
      `- **Reported to FDA:** ${usFromYmd(recall.reportDate)}`,
      `- **Classification:** ${seed.classification}`,
      `- **Status:** ${seed.status}`,
      `- **Type:** ${recall.voluntaryMandated}`,
    ].join('\n'),
    contact:
      `**${seed.firm}**  \n${seed.city}, ${seed.state}` +
      (seed.phone ? `  \nConsumer line: ${seed.phone}` : '') +
      '\n\nReference: [FDA Recalls, Market Withdrawals & Safety Alerts](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts)',
  }
}

function buildRecall(seed: RecallSeed, index: number): Recall {
  const recallInitiationDate = daysAgo(seed.initiatedDaysAgo)
  const reportDaysAgo = seed.initiatedDaysAgo - seed.reportLag
  const base: Omit<Recall, 'summary'> = {
    recallNumber: `F-${String(1204 + index * 17).padStart(4, '0')}-${recallInitiationDate.slice(0, 4)}`,
    eventId: String(98213 + index * 13),
    status: seed.status,
    classification: seed.classification,
    productDescription: seed.product,
    reasonForRecall: seed.reason,
    recallingFirm: seed.firm,
    city: seed.city,
    state: seed.state,
    distributionPattern: seed.distribution,
    productQuantity: seed.quantity,
    codeInfo: seed.codeInfo,
    recallInitiationDate,
    reportDate: daysAgo(reportDaysAgo),
    voluntaryMandated: 'Voluntary: Firm initiated',
  }
  return {
    ...base,
    summary: {
      shortSummary: seed.shortSummary,
      sections: buildSections(seed, base),
      generatedAt: timestampDaysAgo(reportDaysAgo, 6),
      model: DEMO_SUMMARY_MODEL,
    },
  }
}

/** All fixture recalls with full summaries, newest report date first. */
export const recallFixtures: Recall[] = seeds
  .map(buildRecall)
  .sort((a, b) => b.reportDate.localeCompare(a.reportDate) || b.recallNumber.localeCompare(a.recallNumber))

/** Fixture key → recall, for wiring products and receipts to recalls. */
export const recallByKey: Record<string, Recall> = Object.fromEntries(
  seeds.map((seed, i) => [seed.key, recallFixtures.find((r) => r.eventId === String(98213 + i * 13))!]),
)

/** Recall numbers hidden until the first watchlist re-check reveals them. */
export const lateRecallNumbers = new Set(seeds.filter((s) => s.late).map((s) => recallByKey[s.key].recallNumber))

/** List-view shape: summaries carry only the short summary (as GET /api/recalls/recent does). */
export function toListRecall(recall: Recall): Recall {
  if (!recall.summary) return recall
  const summary = { ...recall.summary }
  delete summary.sections
  return { ...recall, summary }
}
