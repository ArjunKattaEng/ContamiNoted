import { describe, expect, it } from 'vitest'
import { fitWithin, videoToView, visibleVideoRect } from './geometry'

// A phone's back camera in portrait: 1080 × 1920, shown in a 400 × 300 box (wider than the video)
const video = { width: 1080, height: 1920 }
const view = { width: 400, height: 300 }

describe('camera geometry (object-fit: cover)', () => {
  it('finds the part of the frame that is on screen', () => {
    // Scaled to the box's width (×0.37), so the top and bottom of the frame are cut off
    const rect = visibleVideoRect(video, view)
    expect(rect.x).toBeCloseTo(0)
    expect(rect.width).toBeCloseTo(1080)
    expect(rect.height).toBeCloseTo(810)
    expect(rect.y).toBeCloseTo((1920 - 810) / 2)
  })

  it('maps frame points to the screen, matching the visible part', () => {
    const rect = visibleVideoRect(video, view)
    expect(videoToView(video, view, { x: rect.x, y: rect.y })).toEqual({ x: expect.closeTo(0), y: expect.closeTo(0) })
    const corner = videoToView(video, view, { x: rect.x + rect.width, y: rect.y + rect.height })
    expect(corner.x).toBeCloseTo(400)
    expect(corner.y).toBeCloseTo(300)
  })

  it('works when the view is taller than the video too', () => {
    const rect = visibleVideoRect({ width: 1920, height: 1080 }, { width: 300, height: 400 })
    expect(rect.height).toBeCloseTo(1080)
    expect(rect.width).toBeCloseTo(810)
  })

  it('scales sizes down, never up', () => {
    expect(fitWithin({ width: 1920, height: 1080 }, 1280)).toEqual({ width: 1280, height: 720 })
    expect(fitWithin({ width: 4032, height: 3024 }, 3000)).toEqual({ width: 3000, height: 2250 })
    expect(fitWithin({ width: 640, height: 480 }, 1280)).toEqual({ width: 640, height: 480 })
  })
})
