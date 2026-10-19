import { describe, expect, it } from 'vitest'
import { hazardOf } from './hazard'

// Real openFDA "reason_for_recall" texts (api/tests/fixtures and live recalls, October 2026)
describe('hazardOf', () => {
  it.each([
    ['Products contain alfalfa seed recalled by the supplier and may be contaminated with E. coli and/or Salmonella', 'germs', 'Salmonella'],
    ['Potential to be contaminated with Listeria monocytogenes', 'germs', 'Listeria'],
    ['Sprouts may be contaminated with STEC E. coli.', 'germs', 'E. coli'],
    ['Eggs may be contaminated with Salmonella.', 'germs', 'Salmonella'],
    ['Product contains elevated levels of lead.', 'chemical', 'Lead'],
    ['Presence of Thiamethoxam-PESTICIDE', 'chemical', 'Pesticide'],
    ['Product contains garlic essential oil not approved for culinary use', 'chemical', 'Unsafe ingredient'],
    ['Due to the presence of Toxic yellow oleander', 'chemical', 'Unsafe ingredient'],
    ['Foreign Object (Glass)', 'object', 'Foreign object'],
    ['Product may contain foreign material: small stones and other hard objects.', 'object', 'Foreign object'],
    ['Foreign material (foil) found in cake slices', 'object', 'Foreign object'],
    ['Undeclared Milk Allergen', 'allergen', 'Undeclared milk'],
    ['Undeclared allergens (soy, milk) and Yellow #5', 'allergen', 'Undeclared milk'],
    ['Contains undeclared almonds & undeclared sesame', 'allergen', 'Undeclared tree nuts'],
    ['Undeclared shellfish (crab shell): source of ingredient Glucosamine sulfate', 'allergen', 'Undeclared shellfish'],
    ['Undeclared allergen ingredient (fish)', 'allergen', 'Undeclared fish'],
    ['Gorditas and Doraditas are missing the following allergens in product label: Wheat and Soy', 'allergen', 'Undeclared wheat'],
    ['Peanuts & Eggs. The firm list peanuts in the ingredient statement but omitted them from the contain statement.', 'allergen', 'Undeclared egg'],
    ['Undeclared sulfites', 'allergen', 'Undeclared sulfites'],
    ['Potential Wheat Kernel contamination.', 'allergen', 'May contain wheat'],
    ['Undeclared Yellow 5 & 6, Red 3, and Blue 1', 'color', 'Undeclared color'],
    ['Carrot decoration contains Yellow #5 and Yellow #6 which is not listed on finished product label.', 'color', 'Undeclared color'],
    ['Unapproved dye Ponceau 4R', 'color', 'Color additive'],
    ['Inaccurate Nutrition Facts information listed on product', 'label', 'Labeling error'],
  ])('%s', (reason, kind, label) => {
    expect(hazardOf(reason)).toEqual({ kind, label })
  })

  it('falls back to "Other problem" for unknown or missing reasons', () => {
    expect(hazardOf('Product was distributed without FDA approval of the process')).toEqual({ kind: 'other', label: 'Other problem' })
    expect(hazardOf(undefined)).toEqual({ kind: 'other', label: 'Other problem' })
  })
})
