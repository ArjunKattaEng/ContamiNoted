// Barcode reading with ZXing-C++ (compiled to WebAssembly by the zxing-wasm package). ZXing finds the
// barcode anywhere in the picture (tilted, sideways or upside down), reads the bars, checks the check
// digit, and reports where the barcode's corners are.
//
// The library is passed in so the worker can use the small reader-only build and the tests can use the
// full build, which can also draw barcodes.

import type { ReadResult, ReaderOptions } from 'zxing-wasm/reader'
import { type Detection, RETAIL_FORMATS, type RawRead, pickDetection, toDetection } from './detections'
import type { Rgba } from './pixels'

export type ReadBarcodes = (image: ImageData, options: ReaderOptions) => Promise<ReadResult[]>

export const READER_OPTIONS: ReaderOptions = {
  formats: [...RETAIL_FORMATS],
  tryHarder: true, // scan more lines of the picture; still ~10 ms for a 1280 px frame on a laptop
  tryRotate: true, // barcodes held sideways or upside down
  // Product barcodes are always dark bars on a light background (GS1 requires it; checkout scanners
  // can't read inverted ones either), and ZXing's inverted-image retry doesn't apply to them anyway
  tryInvert: false,
  tryDownscale: true, // big photos are also read at a smaller size
  maxNumberOfSymbols: 4,
  eanAddOnSymbol: 'Ignore', // the small 2/5-digit add-on (price, issue number) isn't part of the product code
}

export function toRawReads(results: ReadResult[]): RawRead[] {
  return results
    .filter((r) => r.isValid)
    .map((r) => {
      const { topLeft, topRight, bottomRight, bottomLeft } = r.position
      return { text: r.text, format: r.format, corners: [topLeft, topRight, bottomRight, bottomLeft] }
    })
}

/** The product barcode in `image` (the biggest if there are several), or null. */
export async function findBarcode(image: Rgba, readBarcodes: ReadBarcodes): Promise<Detection | null> {
  // zxing-wasm only uses data, width and height ("duck-typed"), so plain pixels work outside the browser too
  const reads = toRawReads(await readBarcodes(image as ImageData, READER_OPTIONS))
  return pickDetection(reads.map(toDetection).filter((d): d is Detection => d !== null))
}
