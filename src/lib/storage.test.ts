import { afterEach, describe, expect, it, vi } from 'vitest'
import { removeRetiredData } from './storage'

describe('removeRetiredData', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('deletes the old demo-mode keys and nothing else', () => {
    const store = new Map([
      ['rg-mock-db-v1', '{}'],
      ['rg-mock-config-v1', '{}'],
      ['rg-saved-recalls-v1', '[]'],
      ['rg-onboarded-v1', 'true'],
    ])
    vi.stubGlobal('localStorage', { removeItem: (k: string) => store.delete(k) })
    removeRetiredData()
    expect([...store.keys()]).toEqual(['rg-saved-recalls-v1', 'rg-onboarded-v1'])
  })

  it('ignores unavailable storage', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => removeRetiredData()).not.toThrow()
  })
})
