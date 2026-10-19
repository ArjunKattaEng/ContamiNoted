import { describe, expect, it } from 'vitest'
import { cameraError } from './use-camera'

describe('cameraError', () => {
  it.each([
    ['NotAllowedError', 'denied'], // the user or a browser setting blocked the camera
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'in-use'], // another app holds the camera
    ['AbortError', 'in-use'],
    ['TypeError', 'failed'],
  ])('maps %s to %s', (name, kind) => {
    expect(cameraError(new DOMException('', name))).toBe(kind)
  })

  it('treats anything else as a failure', () => {
    expect(cameraError('nope')).toBe('failed')
    expect(cameraError(new Error('boom'))).toBe('failed')
  })
})
