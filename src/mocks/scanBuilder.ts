// Builds Scan / WatchItem / Alert objects from fixtures, the way the backend would assemble them.
import type { Alert, Product, Recall, Scan, ScanCounts, ScanItem, ScanVerdict, WatchItem } from '@/types'
import { upcAppearsIn } from '@/lib/barcode'
import { toRecallRef } from '@/lib/recall'
import type { ProductFixture } from './data/products'
import type { ReceiptFixture, ReceiptLineFixture } from './data/receipts'
import { recallByKey, toListRecall } from './data/recalls'

export interface BuildContext {
  createdAt: string
  /** Whether the late recall has been "discovered" by a re-check yet. */
  lateRevealed: boolean
}

let counter = 0
/** Short unique id; avoids crypto.randomUUID, which needs a secure context. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`
}

/** Apply a revealed late recall to a fixture line/product that was clear at first. */
function withLateRecall<T extends { status: ScanItem['status']; recallKeys?: string[]; lateRecallKey?: string; upc?: string; note?: string }>(
  fixture: T,
  lateRevealed: boolean,
): Pick<ScanItem, 'status' | 'note'> & { recallKeys: string[] } {
  const recallKeys = fixture.recallKeys ?? []
  if (!lateRevealed || !fixture.lateRecallKey) return { status: fixture.status, note: fixture.note, recallKeys }
  const late = recallByKey[fixture.lateRecallKey]
  const confirmed = !!fixture.upc && upcAppearsIn(late.codeInfo ?? '', fixture.upc)
  return {
    status: confirmed ? 'confirmed' : 'possible',
    note: confirmed ? 'This UPC is listed in a recall announced after your purchase.' : 'A recall announced after your purchase may cover this product.',
    recallKeys: [...recallKeys, fixture.lateRecallKey],
  }
}

function countItems(items: ScanItem[]): ScanCounts {
  const counts: ScanCounts = { total: items.length, confirmed: 0, possible: 0, clear: 0, error: 0 }
  for (const item of items) counts[item.status] += 1
  return counts
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function buildVerdict(scan: Pick<Scan, 'type' | 'items' | 'counts' | 'matchedRecalls' | 'product'>): ScanVerdict {
  const { type, items, counts, matchedRecalls } = scan
  const recall = (n: string) => matchedRecalls.find((r) => r.recallNumber === n)
  const flagged = items.filter((i) => i.status === 'confirmed' || i.status === 'possible')

  const matchLines = flagged
    .map((item) => {
      const r = recall(item.recallNumbers[0])
      const label = item.status === 'confirmed' ? 'confirmed match' : 'possible match'
      return `- **${item.name}** (${label}): ${r?.summary?.shortSummary ?? r?.productDescription ?? ''}`
    })
    .join('\n')

  if (counts.confirmed > 0 || counts.possible > 0) {
    const headline =
      type === 'barcode'
        ? counts.confirmed > 0
          ? 'This product matches a recall'
          : 'This product may be affected by a recall'
        : counts.confirmed > 0
          ? `${plural(counts.confirmed, 'item', 'items')} on this receipt ${counts.confirmed === 1 ? 'matches' : 'match'} a recall` +
            (counts.possible > 0 ? `, and ${plural(counts.possible, 'more needs', 'more need')} checking` : '')
          : `${plural(counts.possible, 'item', 'items')} on this receipt may be affected by a recall`
    const nextSteps = [
      counts.confirmed > 0
        ? 'Stop using the matched item and compare its lot code and date with the recall notice.'
        : 'Compare the lot code, size and date on your package with the recall notice.',
      'Open the recall for return, refund and disposal instructions.',
      'We’ll keep checking your other items for new recalls.',
    ]
    return { headline, details: matchLines, nextSteps }
  }

  if (type === 'barcode' && scan.product?.name === 'Unknown product') {
    return {
      headline: 'Unknown product: no recalls found for this barcode',
      details: 'We couldn’t identify this barcode in our product database, and no FDA food recall lists it.',
      nextSteps: ['If you know the brand, search recalls by name to double-check.', 'We’ll keep checking this barcode for new recalls.'],
    }
  }

  const headline =
    type === 'barcode'
      ? 'No recalls found for this product'
      : counts.error > 0
        ? `No recalls found, but ${plural(counts.error, 'line', 'lines')} couldn’t be read`
        : `No recalls found for ${plural(counts.total, 'item', 'items')}`
  return {
    headline,
    details:
      counts.error > 0
        ? 'Add the names of the unreadable lines to check them too.'
        : 'None of these products appear in current FDA food recall notices.',
    nextSteps: ['We’ll keep checking these items for new recalls.'],
  }
}

/** Derive counts, matched recalls and the verdict from a scan's items. */
export function finalizeScan(base: Omit<Scan, 'counts' | 'matchedRecalls' | 'verdict'>): Scan {
  const numbers = [...new Set(base.items.flatMap((i) => i.recallNumbers))]
  const matchedRecalls = numbers.map((n) => Object.values(recallByKey).find((r) => r.recallNumber === n)!).map(toListRecall)
  const counts = countItems(base.items)
  const partial = { ...base, counts, matchedRecalls }
  return { ...partial, verdict: buildVerdict(partial) }
}

/** Same scan with replaced items; counts, matched recalls and verdict are recomputed. */
export function rebuildScan(scan: Scan, items: ScanItem[]): Scan {
  const { id, type, createdAt, store, purchaseDate, total, product } = scan
  return finalizeScan({ id, type, createdAt, store, purchaseDate, total, product, items })
}

function lineToItem(line: ReceiptLineFixture, ctx: BuildContext): ScanItem {
  const { status, note, recallKeys } = withLateRecall(line, ctx.lateRevealed)
  return {
    id: newId('item'),
    raw: line.raw,
    name: line.name,
    brand: line.brand,
    upc: line.upc,
    price: line.price,
    status,
    recallNumbers: recallKeys.map((k) => recallByKey[k].recallNumber),
    note,
  }
}

export function buildReceiptScan(fixture: ReceiptFixture, purchaseDate: string, ctx: BuildContext): Scan {
  const items = fixture.lines.map((line) => lineToItem(line, ctx))
  const total = Math.round(fixture.lines.reduce((sum, l) => sum + l.price, 0) * 100) / 100
  return finalizeScan({ id: newId('scan'), type: 'receipt', createdAt: ctx.createdAt, store: fixture.store, purchaseDate, total, items })
}

/** `fixture` undefined = valid barcode that isn't in the product catalog. */
export function buildBarcodeScan(upc: string, fixture: ProductFixture | undefined, ctx: BuildContext): Scan {
  const product: Product = fixture
    ? { upc, name: fixture.name, brand: fixture.brand, size: fixture.size, category: fixture.category }
    : { upc, name: 'Unknown product' }
  const { status, note, recallKeys } = fixture ? withLateRecall(fixture, ctx.lateRevealed) : { status: 'clear' as const, note: undefined, recallKeys: [] }
  const item: ScanItem = {
    id: newId('item'),
    name: fixture ? `${fixture.name}${fixture.size ? `, ${fixture.size}` : ''}` : 'Unknown product',
    brand: fixture?.brand,
    upc,
    status,
    recallNumbers: recallKeys.map((k) => recallByKey[k].recallNumber),
    note,
  }
  return finalizeScan({ id: newId('scan'), type: 'barcode', createdAt: ctx.createdAt, product, items: [item] })
}

/** Watchlist entries for a scan; unreadable lines are skipped. */
export function watchItemsFromScan(scan: Scan): WatchItem[] {
  return scan.items
    .filter((item) => item.status !== 'error')
    .map((item) => ({
      id: newId('watch'),
      scanId: scan.id,
      scanItemId: item.id,
      source: scan.type,
      store: scan.store,
      name: item.name,
      brand: item.brand,
      upc: item.upc,
      size: scan.product?.size,
      purchaseDate: scan.purchaseDate,
      createdAt: scan.createdAt,
      status: item.status,
      recallNumbers: item.recallNumbers,
    }))
}

/** Alerts for watch items that matched a recall (one per item and recall). */
export function alertsForItems(items: WatchItem[], recalls: Recall[], createdAt: string): Alert[] {
  return items.flatMap((item) => {
    const confidence = item.status
    if (confidence !== 'confirmed' && confidence !== 'possible') return []
    return item.recallNumbers.flatMap((n): Alert[] => {
      const recall = recalls.find((r) => r.recallNumber === n)
      if (!recall) return []
      return [
        {
          id: `${n}_${item.id}`,
          recallNumber: n,
          itemId: item.id,
          itemName: item.brand ? `${item.brand} ${item.name}` : item.name,
          source: item.source,
          store: item.store,
          confidence,
          recall: toRecallRef(recall),
          createdAt,
          dismissed: false,
        },
      ]
    })
  })
}
