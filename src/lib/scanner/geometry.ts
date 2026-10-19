// Coordinates between the camera frame and the screen. The video fills its box like CSS
// `object-fit: cover`: scaled up until it covers the box, centered, with the overflow cut off.

import type { Point, Rect, Size } from './pixels'

function cover(video: Size, view: Size) {
  const scale = Math.max(view.width / video.width, view.height / video.height)
  return {
    scale,
    offsetX: (view.width - video.width * scale) / 2,
    offsetY: (view.height - video.height * scale) / 2,
  }
}

/** The part of the video frame (in video pixels) that is visible in the view. */
export function visibleVideoRect(video: Size, view: Size): Rect {
  const { scale, offsetX, offsetY } = cover(video, view)
  return { x: -offsetX / scale, y: -offsetY / scale, width: view.width / scale, height: view.height / scale }
}

/** A point in video pixels → where it shows in the view. */
export function videoToView(video: Size, view: Size, point: Point): Point {
  const { scale, offsetX, offsetY } = cover(video, view)
  return { x: point.x * scale + offsetX, y: point.y * scale + offsetY }
}

/** `size` scaled down (never up) so its long edge is at most `maxEdge`, in whole pixels. */
export function fitWithin(size: Size, maxEdge: number): Size {
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height))
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) }
}
