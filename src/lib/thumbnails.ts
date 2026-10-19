// Camera snapshot thumbnails stored on device, keyed by product UPC.
// Kept separate from the main scan store so scan objects stay lightweight.
import { readJson, writeJson } from './storage'

const KEY = 'rg-thumbnails-v1'
const MAX_EDGE = 80

type ThumbnailMap = Record<string, string>

function load(): ThumbnailMap {
  return readJson<ThumbnailMap>(KEY) ?? {}
}

/** Capture the current video frame as a small JPEG data URL (~1–3 KB). */
export function captureVideoThumbnail(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const canvas = document.createElement('canvas')
  const scale = Math.min(MAX_EDGE / video.videoWidth, MAX_EDGE / video.videoHeight)
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.4)
}

export function saveThumbnail(upc: string, dataUrl: string): void {
  const map = load()
  map[upc] = dataUrl
  writeJson(KEY, map)
}

export function getThumbnail(upc: string | undefined): string | null {
  if (!upc) return null
  return load()[upc] ?? null
}

export function clearThumbnails(): void {
  writeJson(KEY, {})
}
