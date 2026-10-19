// What counts as a scanned product barcode, and when a live camera read is trusted.

import { canonicalBarcode, isValidGtin } from '@/lib/barcode'
import type { Point } from './pixels'

/** Product (retail) barcodes. Other symbologies (QR codes, shipping labels) never reach a recall check. */
export const RETAIL_FORMATS = ['EAN13', 'EAN8', 'UPCA', 'UPCE'] as const

/** A barcode as a decoder reported it. `corners` are in the decoded image's pixels (clockwise from top left). */
export interface RawRead {
  text: string
  format: string
  corners: Point[]
}

export interface Detection {
  /** Canonical form (UPC-E expanded, leading zeros shortened to UPC-A), the same as a typed code */
  code: string
  format: string
  corners: Point[]
}

/** A decoder result as a Detection, or null if it isn't a product barcode with a correct check digit. */
export function toDetection(read: RawRead): Detection | null {
  if (!/^\d+$/.test(read.text)) return null
  const code = canonicalBarcode(read.text)
  return isValidGtin(code) ? { code, format: read.format, corners: read.corners } : null
}

/** Area of a polygon (shoelace formula); 0 for fewer than 3 points. */
export function polygonArea(points: Point[]): number {
  let twice = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    twice += a.x * b.y - b.x * a.y
  }
  return points.length < 3 ? 0 : Math.abs(twice) / 2
}

/** The barcode to use when a picture shows several: the biggest, i.e. the product held closest. */
export function pickDetection(detections: Detection[]): Detection | null {
  return detections.reduce<Detection | null>(
    (best, d) => (!best || polygonArea(d.corners) > polygonArea(best.corners) ? d : best),
    null,
  )
}

/**
 * Confirms live camera reads: a code is accepted once it has been read `needed` times within `windowMs`.
 * A single blurry frame can decode to a wrong number that still passes the check digit (about 1 in 10
 * misreads do), but the same wrong number twice in a row is very unlikely.
 */
export function createReadConfirmer({ needed = 2, windowMs = 1500 } = {}) {
  const seen = new Map<string, number[]>()
  return {
    /** Record a read at time `now` (ms); true when `code` is confirmed. */
    add(code: string, now: number): boolean {
      for (const [key, times] of seen) {
        const recent = times.filter((t) => now - t <= windowMs)
        if (recent.length) seen.set(key, recent)
        else seen.delete(key)
      }
      const times = [...(seen.get(code) ?? []), now]
      seen.set(code, times)
      return times.length >= needed
    },
    reset() {
      seen.clear()
    },
  }
}
