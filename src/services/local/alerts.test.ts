import { beforeEach, describe, expect, it } from 'vitest'
import type { Recall, Scan } from '@/types'
import {
  MAX_LOCAL_ALERTS,
  addLocalAlerts,
  alertsFromScan,
  clearLocalAlerts,
  dismissLocalAlert,
  lastWatchCheck,
  listLocalAlerts,
  makeAlert,
  pruneLocalAlerts,
  removeLocalAlertsFor,
  setLastWatchCheck,
} from './alerts'

const ref = (recallNumber: string) => ({
  recallNumber,
  productDescription: `Recalled ${recallNumber}`,
  classification: 'Class II' as const,
  status: 'Ongoing' as const,
  reportDate: '2026-10-07',
})

const alert = (recallNumber: string, itemId: string, confidence: 'confirmed' | 'possible' = 'possible') =>
  makeAlert({ recallNumber, itemId, itemName: 'Item', confidence, recall: ref(recallNumber), createdAt: '2026-10-16T00:00:00Z' })

describe('local alerts', () => {
  beforeEach(() => clearLocalAlerts())

  it('adds only new alerts, newest first', () => {
    expect(addLocalAlerts([alert('F-1-2026', 'a')])).toHaveLength(1)
    expect(addLocalAlerts([alert('F-1-2026', 'a'), alert('F-2-2026', 'a')]).map((a) => a.recallNumber)).toEqual(['F-2-2026'])
    expect(listLocalAlerts().map((a) => a.id)).toEqual(['F-2-2026_a', 'F-1-2026_a'])
  })

  it('keeps a dismissed alert dismissed when it is found again', () => {
    addLocalAlerts([alert('F-1-2026', 'a')])
    dismissLocalAlert('F-1-2026_a')
    expect(addLocalAlerts([alert('F-1-2026', 'a')])).toEqual([])
    expect(listLocalAlerts()[0].dismissed).toBe(true)
  })

  it('upgrades possible to confirmed and reports it as new', () => {
    addLocalAlerts([alert('F-1-2026', 'a', 'possible')])
    const fresh = addLocalAlerts([alert('F-1-2026', 'a', 'confirmed')])
    expect(fresh.map((a) => a.confidence)).toEqual(['confirmed'])
    expect(listLocalAlerts()).toHaveLength(1)
    expect(listLocalAlerts()[0].confidence).toBe('confirmed')
    // ...but never downgrades
    expect(addLocalAlerts([alert('F-1-2026', 'a', 'possible')])).toEqual([])
    expect(listLocalAlerts()[0].confidence).toBe('confirmed')
  })

  it('a confirmed upgrade on its own reopens a dismissed alert, and is saved', () => {
    addLocalAlerts([alert('F-1-2026', 'a', 'possible')])
    dismissLocalAlert('F-1-2026_a')
    const fresh = addLocalAlerts([alert('F-1-2026', 'a', 'confirmed')])
    expect(fresh).toHaveLength(1)
    expect(listLocalAlerts()[0]).toMatchObject({ confidence: 'confirmed', dismissed: false })
  })

  it('over the limit, drops dismissed alerts before active ones', () => {
    const many = Array.from({ length: MAX_LOCAL_ALERTS }, (_, i) => alert(`F-${i}-2026`, 'a'))
    addLocalAlerts(many)
    for (const a of many.slice(0, 10)) dismissLocalAlert(a.id)
    addLocalAlerts([alert('F-new-2026', 'b')])
    const kept = listLocalAlerts()
    expect(kept).toHaveLength(MAX_LOCAL_ALERTS)
    expect(kept.filter((a) => a.dismissed)).toHaveLength(9) // one dismissed alert made room
    expect(kept[0].id).toBe('F-new-2026_b')
  })

  it('prunes alerts of products no longer on the device', () => {
    addLocalAlerts([alert('F-1-2026', 'a'), alert('F-1-2026', 'gone')])
    pruneLocalAlerts(new Set(['a']))
    expect(listLocalAlerts().map((a) => a.itemId)).toEqual(['a'])
  })

  it('removes the alerts of one product', () => {
    addLocalAlerts([alert('F-1-2026', 'a'), alert('F-1-2026', 'b')])
    removeLocalAlertsFor('a')
    expect(listLocalAlerts().map((a) => a.itemId)).toEqual(['b'])
  })

  it('clearing also forgets the last check', () => {
    setLastWatchCheck('2026-10-16T00:00:00Z')
    clearLocalAlerts()
    expect(lastWatchCheck()).toBeNull()
  })

  it('makes alerts from a scan with matches only', () => {
    const recall = { ...ref('F-9-2026'), eventId: '1', reasonForRecall: 'r', recallingFirm: 'f', recallInitiationDate: '2026-10-01', summary: null, codeInfo: 'long text' } as Recall
    const scan: Scan = {
      id: 's1',
      type: 'barcode',
      createdAt: '2026-10-16T12:00:00Z',
      product: { upc: '012345678905', name: 'Parfait', brand: 'Bonya' },
      items: [{ id: 'i1', name: 'Parfait', brand: 'Bonya', upc: '012345678905', status: 'confirmed', recallNumbers: ['F-9-2026'] }],
      matchedRecalls: [recall],
      verdict: null,
      counts: { total: 1, confirmed: 1, possible: 0, clear: 0, error: 0 },
    }
    const [made] = alertsFromScan(scan, 'barcode-012345678905')
    expect(made).toMatchObject({ id: 'F-9-2026_barcode-012345678905', itemName: 'Bonya Parfait', confidence: 'confirmed', source: 'barcode', dismissed: false })
    expect(made.recall).not.toHaveProperty('codeInfo') // compact snapshot
    expect(alertsFromScan({ ...scan, items: [{ ...scan.items[0], status: 'clear', recallNumbers: [] }] }, 'x')).toEqual([])
  })
})
