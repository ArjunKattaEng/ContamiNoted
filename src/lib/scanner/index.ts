// Barcode reading for the app: camera frames and photos in, a checked product code out.
//
// Two engines, both checked the same way (product formats only, correct check digit):
//   - The browser's built-in BarcodeDetector where it exists (Chrome on Android and macOS): it uses the
//     phone's own barcode model, and it's fast.
//   - ZXing-C++ in a worker everywhere else (Safari, iOS, Firefox, Windows), and whenever the built-in
//     detector finds nothing.

import { type Detection, RETAIL_FORMATS, type RawRead, pickDetection, toDetection } from './detections'
import { fitWithin } from './geometry'
import type { Rect } from './pixels'
import type { WorkerRequest, WorkerResponse } from './protocol'

export type { Detection } from './detections'
export { createReadConfirmer } from './detections'

/** Photos are read at up to this size: enough for a barcode across a room, without huge memory use */
const PHOTO_MAX_EDGE = 3000
const READ_TIMEOUT_MS = 15_000

// --- ZXing worker ---

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (d: Detection | null) => void; reject: (e: Error) => void }>()

function failAll(error: Error) {
  for (const { reject } of pending.values()) reject(error)
  pending.clear()
  worker?.terminate()
  worker = null // the next read starts a fresh worker
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./scanner.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const request = pending.get(data.id)
    if (!request) return
    pending.delete(data.id)
    if ('error' in data) request.reject(new Error(data.error))
    else request.resolve(data.detection)
  }
  worker.onerror = (event) => failAll(new Error(event.message || 'The barcode reader stopped'))
  return worker
}

function post(message: WorkerRequest, transfer: Transferable[] = []) {
  getWorker().postMessage(message, transfer)
}

/** Load the reader ahead of time (it's ~1 MB of WebAssembly), so the first frame is read straight away. */
export function warmUpReader() {
  post({ type: 'warm-up' })
}

function readWithZxing(image: ImageData): Promise<Detection | null> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('The barcode reader took too long'))
    }, READ_TIMEOUT_MS)
    pending.set(id, {
      resolve: (d) => (clearTimeout(timer), resolve(d)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    })
    const { width, height, data } = image
    post({ type: 'read', id, width, height, buffer: data.buffer }, [data.buffer])
  })
}

// --- Built-in BarcodeDetector (not in TypeScript's DOM types yet) ---

interface NativeBarcode {
  rawValue: string
  format: string
  cornerPoints: { x: number; y: number }[]
}
interface NativeDetector {
  detect(source: CanvasImageSource): Promise<NativeBarcode[]>
}
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats(): Promise<string[]>
}

const NATIVE_FORMATS: Record<string, (typeof RETAIL_FORMATS)[number]> = {
  ean_13: 'EAN13',
  ean_8: 'EAN8',
  upc_a: 'UPCA',
  upc_e: 'UPCE',
}

let native: Promise<NativeDetector | null> | null = null

function nativeDetector(): Promise<NativeDetector | null> {
  native ??= (async () => {
    const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
    if (!Detector) return null
    try {
      const supported = await Detector.getSupportedFormats()
      const formats = Object.keys(NATIVE_FORMATS).filter((f) => supported.includes(f))
      // Only worth it if it reads the codes US groceries carry
      return formats.includes('upc_a') && formats.includes('ean_13') ? new Detector({ formats }) : null
    } catch {
      return null
    }
  })()
  return native
}

async function readWithNative(canvas: HTMLCanvasElement): Promise<Detection | null> {
  const detector = await nativeDetector()
  if (!detector) return null
  try {
    const reads: RawRead[] = (await detector.detect(canvas)).map((b) => ({
      text: b.rawValue,
      format: NATIVE_FORMATS[b.format] ?? b.format,
      corners: b.cornerPoints,
    }))
    return pickDetection(reads.map(toDetection).filter((d): d is Detection => d !== null))
  } catch {
    return null // fall back to ZXing
  }
}

// --- Reading pictures ---

/** A canvas holding `source` (or the `crop` of it), scaled down to `maxEdge`. */
export function drawToCanvas(
  source: CanvasImageSource,
  size: { width: number; height: number },
  maxEdge: number,
  crop: Rect = { x: 0, y: 0, ...size },
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): HTMLCanvasElement {
  const target = fitWithin(crop, maxEdge)
  canvas.width = target.width
  canvas.height = target.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available')
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, target.width, target.height)
  return canvas
}

/**
 * The product barcode in a canvas, or null. Corners are in the canvas's pixels.
 * The canvas is only read, so it can be reused for the next frame once this resolves.
 */
export async function readCanvas(canvas: HTMLCanvasElement): Promise<Detection | null> {
  const found = await readWithNative(canvas)
  if (found) return found
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  return readWithZxing(context.getImageData(0, 0, canvas.width, canvas.height))
}

async function decodeImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  try {
    // Respects the photo's EXIF orientation (the default in current browsers, explicit for older ones)
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  } catch {
    // Older Safari can't make bitmaps from some files; an <img> can
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** The product barcode in a photo the user took or picked, or null. Throws if the file isn't an image. */
export async function readPhoto(file: Blob): Promise<Detection | null> {
  const image = await decodeImage(file)
  try {
    return await readCanvas(drawToCanvas(image.source, image, PHOTO_MAX_EDGE))
  } finally {
    image.close()
  }
}
