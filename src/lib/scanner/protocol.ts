// Messages between the app and the scanner worker.

import type { Detection } from './detections'

export type WorkerRequest =
  | { type: 'warm-up' }
  /** RGBA pixels; the buffer is transferred to the worker, not copied */
  | { type: 'read'; id: number; width: number; height: number; buffer: ArrayBuffer }

export type WorkerResponse = { id: number; detection: Detection | null } | { id: number; error: string }
