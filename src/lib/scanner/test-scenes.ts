// Test helpers: draw photo-like pictures with a barcode in them (a label on a busy, noisy, blurred
// background, rotated or far away), so the scanner can be tested on real decoding without photo files.
// Only the tests import this.

import { type Rgba, rgba } from './pixels'

/** A barcode as zxing-wasm's writer returns it: one pixel per module, 0 = bar, 255 = space. */
export interface BarcodeSymbol {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Deterministic random numbers (mulberry32), so every test run draws the same picture. */
export function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function setGray(image: Rgba, x: number, y: number, value: number) {
  const i = (y * image.width + x) * 4
  image.data[i] = image.data[i + 1] = image.data[i + 2] = value
  image.data[i + 3] = 255
}

function fillRect(image: Rgba, x: number, y: number, w: number, h: number, value: number) {
  for (let yy = Math.max(0, y); yy < Math.min(image.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(image.width, x + w); xx++) setGray(image, xx, yy, value)
  }
}

/** A kitchen-counter-like background: a lighting gradient, boxes of other packaging, and lines of "text". */
export function busyBackground(width: number, height: number, seed = 1): Rgba {
  const next = random(seed)
  const image = rgba(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) setGray(image, x, y, 90 + 70 * (x / width) + 40 * (y / height))
  }
  for (let i = 0; i < 25; i++) {
    const w = 40 + next() * width * 0.25
    const h = 40 + next() * height * 0.25
    fillRect(image, Math.floor(next() * width), Math.floor(next() * height), Math.floor(w), Math.floor(h), 40 + next() * 180)
  }
  // Lines of small letters: high detail in every direction, which must not look like a barcode
  for (let line = 0; line < 30; line++) {
    const y0 = Math.floor(next() * height)
    let x = Math.floor(next() * width * 0.7)
    const size = 4 + Math.floor(next() * 6)
    for (let c = 0; c < 25; c++, x += size + 2) {
      if (next() < 0.2) continue
      fillRect(image, x, y0, Math.ceil(size * (0.4 + next() * 0.6)), size, 20 + next() * 40)
    }
  }
  return image
}

export interface Placement {
  /** Center of the barcode in the picture */
  cx: number
  cy: number
  /** Width of one bar module in picture pixels (an EAN-13 is 95 modules wide) */
  module: number
  /** Bar height as a share of the barcode width (real labels: about 0.7) */
  aspect?: number
  /** Rotation in degrees, clockwise */
  angle?: number
  ink?: number
  paper?: number
}

/** Draw a white label with the barcode (and its quiet zones) onto `image`, anti-aliased. */
export function drawBarcode(image: Rgba, symbol: BarcodeSymbol, p: Placement): Rgba {
  const { cx, cy, module, aspect = 0.7, angle = 0, ink = 25, paper = 240 } = p
  const quiet = 11 // modules of blank label each side
  const barsW = symbol.width
  const labelW = barsW + quiet * 2 // in modules
  const barH = barsW * aspect
  const labelH = barH + 8
  const rad = (angle * Math.PI) / 180
  const [cos, sin] = [Math.cos(rad), Math.sin(rad)]
  const half = (Math.hypot(labelW, labelH) * module) / 2
  const sub = 3 // 3 × 3 samples per pixel
  for (let y = Math.max(0, Math.floor(cy - half)); y < Math.min(image.height, Math.ceil(cy + half)); y++) {
    for (let x = Math.max(0, Math.floor(cx - half)); x < Math.min(image.width, Math.ceil(cx + half)); x++) {
      let sum = 0
      let inside = 0
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const dx = x + (sx + 0.5) / sub - cx
          const dy = y + (sy + 0.5) / sub - cy
          // Picture → label coordinates (in modules, origin at the label's center)
          const u = (dx * cos + dy * sin) / module
          const v = (-dx * sin + dy * cos) / module
          if (Math.abs(u) > labelW / 2 || Math.abs(v) > labelH / 2) continue
          inside++
          const col = Math.floor(u + barsW / 2)
          const isBar = Math.abs(v) <= barH / 2 && col >= 0 && col < barsW && symbol.data[col] < 128
          sum += isBar ? ink : paper
        }
      }
      if (!inside) continue
      const i = (y * image.width + x) * 4
      const outside = sub * sub - inside
      image.data[i] = image.data[i + 1] = image.data[i + 2] = (sum + image.data[i] * outside) / (sub * sub)
    }
  }
  return image
}

/** Camera blur: a box blur of the given radius. */
export function blur(image: Rgba, radius: number): Rgba {
  const { width, height } = image
  const pass = (src: Uint8ClampedArray, dx: number, dy: number) => {
    const out = new Uint8ClampedArray(src.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0
          let n = 0
          for (let k = -radius; k <= radius; k++) {
            const xx = x + k * dx
            const yy = y + k * dy
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
            sum += src[(yy * width + xx) * 4 + c]
            n++
          }
          out[(y * width + x) * 4 + c] = sum / n
        }
      }
    }
    return out
  }
  return { width, height, data: pass(pass(image.data, 1, 0), 0, 1) }
}

/** Sensor noise: each pixel moved by up to ±amount. */
export function noise(image: Rgba, amount: number, seed = 2): Rgba {
  const next = random(seed)
  const data = new Uint8ClampedArray(image.data)
  for (let i = 0; i < data.length; i += 4) {
    const d = (next() * 2 - 1) * amount
    data[i] += d
    data[i + 1] += d
    data[i + 2] += d
  }
  return { ...image, data }
}
