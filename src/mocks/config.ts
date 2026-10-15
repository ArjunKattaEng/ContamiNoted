// Developer controls for the mock backend (edited from Profile → Developer in a later phase).
import { readJson, writeJson } from '@/lib/storage'

export type MockLatency = 'none' | 'normal' | 'slow'
export type ReceiptScenario = 'cycle' | 'A' | 'B' | 'C' | 'unreadable'

export interface MockConfig {
  latency: MockLatency
  /** Every data call fails with `upstream_error`. */
  forceError: boolean
  /** Every list call returns no rows. */
  forceEmpty: boolean
  /** Which sample receipt the next receipt scan returns. */
  receiptScenario: ReceiptScenario
}

const KEY = 'rg-mock-config-v1'
export const defaultMockConfig: MockConfig = { latency: 'normal', forceError: false, forceEmpty: false, receiptScenario: 'cycle' }

let config: MockConfig = { ...defaultMockConfig, ...readJson<Partial<MockConfig>>(KEY) }
const listeners = new Set<() => void>()

export function getMockConfig(): MockConfig {
  return config
}

export function setMockConfig(patch: Partial<MockConfig>): void {
  config = { ...config, ...patch }
  writeJson(KEY, config)
  listeners.forEach((l) => l())
}

/** For useSyncExternalStore. */
export function subscribeMockConfig(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
