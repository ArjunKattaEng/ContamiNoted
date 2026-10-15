// Barcode helpers ported from food-recall-alert-ui/lib/scan.ts.

/** Strip everything but digits from a scanned or typed barcode. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Validates a GTIN (UPC-A, EAN-8, EAN-13, GTIN-14) using its check digit.
 * UPC-E (8 digits starting with 0/1) also passes the EAN-8 length check.
 */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** FDA recall notices usually print UPC-A (12 digits); turn EAN-13 with a leading 0 into UPC-A. */
export function toUpcA(code: string): string {
  return code.length === 13 && code.startsWith('0') ? code.slice(1) : code
}

/** Normalize a scanned/typed code to the form recalls are matched on. */
export function canonicalBarcode(raw: string): string {
  return toUpcA(normalizeBarcode(raw))
}

/**
 * True when `upc` appears in free text as a whole number. Recall notices often format UPCs
 * with spaces or dashes ("0 12345 67890 5"), so digit groups are joined before matching.
 */
export function upcAppearsIn(text: string, upc: string): boolean {
  const haystack = text.replace(/(\d)[\s-]+(?=\d)/g, '$1')
  const variants = new Set([upc, toUpcA(upc)])
  return [...variants].some((v) => new RegExp(`(^|\\D)${v}(\\D|$)`).test(haystack))
}

/** Format a UPC-A the way it is printed under the bars: "0 12345 67890 5". */
export function formatUpc(upc: string): string {
  return upc.length === 12 ? `${upc[0]} ${upc.slice(1, 6)} ${upc.slice(6, 11)} ${upc[11]}` : upc
}
