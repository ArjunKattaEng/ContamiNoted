// Barcode helpers ported from food-recall-alert-ui/lib/scan.ts. Validation and normalization match the
// backend (api/services/barcode.py); finding a barcode in recall text happens only on the server.

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

/**
 * FDA recall notices usually print UPC-A (12 digits): shorten EAN-13 / GTIN-14 codes with leading zeros
 * to UPC-A (leading zeros don't change the check digit).
 */
export function toUpcA(code: string): string {
  let out = code
  while (out.length > 12 && out.startsWith('0')) out = out.slice(1)
  return out
}

/** 8-digit UPC-E (number system 0 or 1) → 12-digit UPC-A, or null if it isn't UPC-E shaped. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const [ns, d, check] = [code[0], code.slice(1, 7), code[7]]
  const last = d[5]
  let body: string
  if ('012'.includes(last)) body = d.slice(0, 2) + last + '0000' + d.slice(2, 5)
  else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5)
  else if (last === '4') body = d.slice(0, 4) + '00000' + d[4]
  else body = d.slice(0, 5) + '0000' + last
  return ns + body + check
}

/**
 * Normalize a scanned/typed code to the form recalls are matched on (same rules as the backend's
 * api/services/barcode.py): UPC-E expanded to UPC-A, leading zeros shortened to UPC-A.
 */
export function canonicalBarcode(raw: string): string {
  const code = normalizeBarcode(raw)
  if (code.length === 8) {
    // 8-digit codes starting with 0/1 in US stores are UPC-E; keep EAN-8 when that doesn't check out
    const upcA = expandUpcE(code)
    if (upcA && isValidGtin(upcA)) return upcA
  }
  return toUpcA(code)
}

/** Format a UPC-A the way it is printed under the bars: "0 12345 67890 5". */
export function formatUpc(upc: string): string {
  return upc.length === 12 ? `${upc[0]} ${upc.slice(1, 6)} ${upc.slice(6, 11)} ${upc[11]}` : upc
}
