import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeoutError, withTimeout } from './timeout'

describe('withTimeout', () => {
  afterEach(() => vi.useRealTimers())

  it('passes a result through', async () => {
    expect(await withTimeout(Promise.resolve(3), 100)).toBe(3)
  })

  it('rejects when the promise takes too long', async () => {
    vi.useFakeTimers()
    const slow = withTimeout(new Promise(() => {}), 100, 'Loading')
    vi.advanceTimersByTime(101)
    await expect(slow).rejects.toBeInstanceOf(TimeoutError)
  })
})
