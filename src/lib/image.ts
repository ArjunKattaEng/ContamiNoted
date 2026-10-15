// Receipt photos are scaled down before upload: the API takes ≤ 4 MB, and OCR doesn't need more than ~1600 px.

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

/** Read a blob: / file: / capacitor:// URL (e.g. a Camera webPath) into a Blob. */
export async function blobFromUrl(url: string): Promise<Blob> {
  const res = await fetch(url)
  return res.blob()
}

/**
 * Downscale to ≤ 1600 px on the long edge and re-encode as JPEG, respecting EXIF orientation.
 * Falls back to the original image if the browser can't decode it.
 */
export async function prepareReceiptImage(source: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? source), 'image/jpeg', JPEG_QUALITY))
  } catch {
    return source
  }
}
