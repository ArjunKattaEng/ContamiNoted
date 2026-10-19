// Real decoding: barcodes drawn by ZXing's writer into photo-like pictures, read by the same code the
// app's scanner worker runs (findBarcode + READER_OPTIONS). Offline: the WebAssembly file is read from disk.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { prepareZXingModule, readBarcodes, writeBarcode, type WriteInputBarcodeFormat } from 'zxing-wasm/full'
import { polygonArea } from './detections'
import { rgba } from './pixels'
import { type BarcodeSymbol, type Placement, blur, busyBackground, drawBarcode, noise } from './test-scenes'
import { findBarcode } from './zxing'

beforeAll(async () => {
  const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/full/zxing_full.wasm'))
  await prepareZXingModule({ overrides: { wasmBinary: new Uint8Array(wasm).buffer }, fireImmediately: true })
})

async function symbol(text: string, format: WriteInputBarcodeFormat): Promise<BarcodeSymbol> {
  const { symbol, error } = await writeBarcode(text, { format })
  if (!symbol) throw new Error(error)
  return symbol
}

const NUTELLA = '3017620422003' // EAN-13

/** A 1600 × 1200 "photo" with one barcode, lightly blurred and noisy like a phone camera frame. */
async function photo(placement: Partial<Placement> = {}, text = NUTELLA, format: WriteInputBarcodeFormat = 'EAN13') {
  const image = busyBackground(1600, 1200)
  drawBarcode(image, await symbol(text, format), { cx: 1000, cy: 650, module: 3, ...placement })
  return noise(blur(image, 1), 8)
}

describe('findBarcode', () => {
  it('reads an EAN-13 in a busy picture and reports where it is', async () => {
    const found = await findBarcode(await photo(), readBarcodes)
    expect(found?.code).toBe(NUTELLA)
    // The corners surround the drawn barcode (95 modules × 3 px wide, centered at 1000, 650)
    const xs = found!.corners.map((p) => p.x)
    expect(Math.min(...xs)).toBeGreaterThan(1000 - 160)
    expect(Math.max(...xs)).toBeLessThan(1000 + 160)
    expect(found!.corners.every((p) => Math.abs(p.y - 650) < 120)).toBe(true)
  })

  it.each([
    ['tilted', { angle: 12 }],
    ['sideways', { angle: 90 }],
    ['upside down', { angle: 180 }],
    ['far away (2 px per bar)', { module: 2 }],
    ['close up (8 px per bar)', { module: 8, cx: 800, cy: 600 }],
    ['low contrast', { ink: 110, paper: 190 }],
    ['short bars (cut-off label)', { aspect: 0.25 }],
  ])('reads a barcode that is %s', async (_, placement) => {
    expect((await findBarcode(await photo(placement), readBarcodes))?.code).toBe(NUTELLA)
  })

  it.each([
    ['UPC-A', '041570054529', 'UPCA', '041570054529'],
    ['UPC-E, expanded to UPC-A', '01234565', 'UPCE', '012345000065'],
    ['EAN-8', '96385074', 'EAN8', '96385074'],
  ] as const)('reads %s', async (_, text, format, code) => {
    expect((await findBarcode(await photo({}, text, format), readBarcodes))?.code).toBe(code)
  })

  it('picks the biggest barcode when there are several', async () => {
    const image = busyBackground(1600, 1200)
    drawBarcode(image, await symbol('041570054529', 'UPCA'), { cx: 350, cy: 300, module: 2 })
    drawBarcode(image, await symbol(NUTELLA, 'EAN13'), { cx: 1050, cy: 750, module: 4 })
    const found = await findBarcode(image, readBarcodes)
    expect(found?.code).toBe(NUTELLA)
    expect(polygonArea(found!.corners)).toBeGreaterThan(0)
  })

  it('finds nothing in a picture without a barcode', async () => {
    expect(await findBarcode(noise(busyBackground(1600, 1200, 5), 8), readBarcodes)).toBeNull()
    expect(await findBarcode(rgba(640, 480), readBarcodes)).toBeNull()
  })

  it('ignores non-product barcodes (Code 128, used on shipping labels)', async () => {
    const image = busyBackground(1600, 1200)
    drawBarcode(image, await symbol('ABC-12345', 'Code128'), { cx: 800, cy: 600, module: 3 })
    expect(await findBarcode(image, readBarcodes)).toBeNull()
  })
})
