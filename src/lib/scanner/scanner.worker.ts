// Reads barcodes off the main thread, so decoding camera frames never makes the screen stutter.
// The WebAssembly file is bundled with the app (not fetched from a CDN), so scanning works on any network.

import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import type { WorkerRequest, WorkerResponse } from './protocol'
import { findBarcode } from './zxing'

// Start compiling now, before the first frame arrives. If loading fails, each read reports the error.
prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  fireImmediately: true,
}).catch(() => {})

// The DOM's typings describe a window; this file runs as a dedicated worker
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage(message: WorkerResponse): void
}

scope.onmessage = async ({ data: request }) => {
  if (request.type === 'warm-up') return
  const { id, width, height, buffer } = request
  try {
    const detection = await findBarcode({ data: new Uint8ClampedArray(buffer), width, height }, readBarcodes)
    scope.postMessage({ id, detection })
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
