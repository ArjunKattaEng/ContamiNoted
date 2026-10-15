// Name-based recall matching for receipt items without a UPC. Port of filterItemMatches from
// food-recall-alert-ui/lib/scan.ts; the real backend will do this server-side.
import type { Recall } from '@/types'

const ITEM_STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'pack', 'count', 'size', 'each', 'oz', 'lb', 'lbs', 'fl', 'ct', 'pk', 'gal', 'org', 'organic', 'fresh', 'natural',
])

/** Meaningful lowercase words of an item name (3+ letters, no stopwords). */
export function itemWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !ITEM_STOPWORDS.has(w))
}

/**
 * Recalls whose product description or firm mentions the item's meaningful words: all of them
 * for 1–2 word names, at least half for longer ones. (The original "half" rule let one generic
 * word match, e.g. "Whole milk" → "Whole cantaloupe", "Paper towels" → flour in a "paper bag".)
 */
export function matchItemName(name: string, recalls: Recall[]): Recall[] {
  const words = itemWords(name)
  if (words.length === 0) return []
  const required = words.length <= 2 ? words.length : Math.ceil(words.length / 2)
  return recalls.filter((r) => {
    const haystack = `${r.productDescription} ${r.recallingFirm}`.toLowerCase()
    return words.filter((w) => haystack.includes(w)).length >= required
  })
}
