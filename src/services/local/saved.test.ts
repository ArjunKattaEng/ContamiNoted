import { beforeEach, describe, expect, it } from 'vitest'
import type { RecallRef } from '@/types'
import { clearLocalSaved, localSaved } from './saved'

const recall = (n: string): RecallRef & { extra: string } => ({
  recallNumber: n,
  productDescription: `Product ${n}`,
  classification: 'Class I',
  status: 'Ongoing',
  reportDate: '2026-10-07',
  extra: 'not stored',
})

describe('localSaved', () => {
  beforeEach(() => clearLocalSaved())

  it('toggles and lists newest first', async () => {
    expect(await localSaved.toggle(recall('H-1-2026'))).toBe(true)
    expect(await localSaved.toggle(recall('H-2-2026'))).toBe(true)
    expect((await localSaved.list()).map((s) => s.recallNumber)).toEqual(['H-2-2026', 'H-1-2026'])
    expect(await localSaved.toggle(recall('H-1-2026'))).toBe(false)
    expect((await localSaved.list()).map((s) => s.recallNumber)).toEqual(['H-2-2026'])
  })

  it('stores a compact snapshot of the recall', async () => {
    await localSaved.toggle(recall('H-3-2026'))
    const [entry] = await localSaved.list()
    expect(entry.recall).toEqual({
      recallNumber: 'H-3-2026',
      productDescription: 'Product H-3-2026',
      classification: 'Class I',
      status: 'Ongoing',
      reportDate: '2026-10-07',
    })
  })
})
