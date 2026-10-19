// What a recall is about, in a word, from the FDA's "reason for recall" text: shown as the picture at the
// start of a recall row (recalls have no product photos) and on the recall page. Deterministic keyword
// rules, no AI. Checked in order, most serious first: "Undeclared milk and Yellow #5" is an allergen.

import type { Classification } from '@/types'

export type HazardKind = 'germs' | 'chemical' | 'object' | 'allergen' | 'color' | 'label' | 'other'

export interface Hazard {
  kind: HazardKind
  /** Short name for the problem, e.g. "Salmonella", "Undeclared milk", "Foreign object". */
  label: string
}

const GERMS: [RegExp, string][] = [
  [/salmonella/i, 'Salmonella'],
  [/listeria/i, 'Listeria'],
  [/\b(e\.?\s?coli|stec)\b/i, 'E. coli'],
  [/botulin|clostridium/i, 'Botulism'],
  [/cronobacter/i, 'Cronobacter'],
  [/campylobacter/i, 'Campylobacter'],
  [/shigella/i, 'Shigella'],
  [/hepatitis/i, 'Hepatitis A'],
  [/norovirus/i, 'Norovirus'],
  [/cyclospora/i, 'Cyclospora'],
  [/\b(mold|mould|yeast|microbial|bacteria\w*)\b/i, 'Germs'],
]

const CHEMICALS: [RegExp, string][] = [
  [/\blead\b/i, 'Lead'],
  [/pesticide|thiamethoxam|chlorpyrifos/i, 'Pesticide'],
  [/arsenic/i, 'Arsenic'],
  [/cadmium/i, 'Cadmium'],
  [/mercury/i, 'Mercury'],
  [/histamine|scombro/i, 'Histamine'],
  [/toxic|oleander|not approved|unapproved (?!dye|colou?r)|essential oil/i, 'Unsafe ingredient'],
]

const OBJECT = /foreign|glass|metal|plastic|stones?\b|hard object|\bfoil\b|\bwood\b|\bbone\b|rubber|floating object/i

// The major allergens as they appear in recalls (FDA's nine, plus tree nuts named one by one)
const ALLERGENS: [RegExp, string][] = [
  [/\bmilk|dairy|whey|casein/i, 'milk'],
  [/\beggs?\b/i, 'egg'],
  [/peanut/i, 'peanuts'],
  [/almond|cashew|walnut|pecan|hazelnut|pistachio|macadamia|brazil nut|tree nut|coconut/i, 'tree nuts'],
  [/wheat|gluten/i, 'wheat'],
  [/\bsoy/i, 'soy'],
  [/shellfish|shrimp|crab|lobster/i, 'shellfish'],
  [/\bfish\b|anchov|tuna/i, 'fish'],
  [/sesame/i, 'sesame'],
  [/sulfite|sulphite/i, 'sulfites'],
  [/mustard/i, 'mustard'],
]

const COLOR = /colou?r|\bdye|yellow|\bred\b|\bblue\b|ponceau|tartrazine|fd&c/i
const LABEL = /label|misbrand|nutrition facts|did not align|incorrect/i

/** The kind of problem a recall is about, and a short name for it. */
export function hazardOf(reasonForRecall?: string): Hazard {
  const text = reasonForRecall ?? ''
  for (const [re, label] of GERMS) if (re.test(text)) return { kind: 'germs', label }
  for (const [re, label] of CHEMICALS) if (re.test(text)) return { kind: 'chemical', label }
  if (OBJECT.test(text)) return { kind: 'object', label: 'Foreign object' }
  const undeclared = /undeclared|allergen|not listed|omitted|missing/i.test(text)
  // An allergen that isn't on the label, or that got into the food ("Potential Wheat Kernel contamination")
  if (undeclared || /contaminat|cross[- ]contact|may contain|presence/i.test(text)) {
    const allergen = ALLERGENS.find(([re]) => re.test(text))
    if (allergen) return { kind: 'allergen', label: `${undeclared ? 'Undeclared' : 'May contain'} ${allergen[1]}` }
  }
  if (undeclared) {
    if (COLOR.test(text)) return { kind: 'color', label: 'Undeclared color' }
    if (/allergen/i.test(text)) return { kind: 'allergen', label: 'Undeclared allergen' }
  }
  if (COLOR.test(text)) return { kind: 'color', label: 'Color additive' }
  if (LABEL.test(text)) return { kind: 'label', label: 'Labeling error' }
  return { kind: 'other', label: 'Other problem' }
}

/** What an FDA class means for your health (FDA's definitions, in plain words). */
export const classificationRisk: Record<Classification, string> = {
  'Class I': 'Could cause serious health problems or death',
  'Class II': 'Could cause temporary or treatable health problems',
  'Class III': 'Unlikely to cause health problems',
}
