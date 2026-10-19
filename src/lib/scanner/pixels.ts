// Image shapes for barcode reading. They match the DOM's ImageData without needing the DOM, so the same
// code runs in the main thread, in the scanner worker and in Node tests.

/** RGBA pixels, shaped like the DOM's ImageData. */
export interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export function rgba(width: number, height: number, fill = 255): Rgba {
  return { data: new Uint8ClampedArray(width * height * 4).fill(fill), width, height }
}
