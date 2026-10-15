// Network-like behavior for mock services: latency plus the Developer panel's forced states.
import { ApiError } from '@/services/errors'
import { getMockConfig } from './config'

type CallKind = 'read' | 'write' | 'scan' | 'auth'

const latencyMs: Record<CallKind, [number, number]> = {
  read: [300, 800],
  write: [200, 500],
  scan: [1200, 2200],
  auth: [400, 900],
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Run `fn` as if it were a backend call. Auth calls ignore `forceError` so you can't get locked out. */
export async function simulate<T>(kind: CallKind, fn: () => T | Promise<T>): Promise<T> {
  const { latency, forceError } = getMockConfig()
  if (latency !== 'none') {
    const [min, max] = latencyMs[kind]
    const factor = latency === 'slow' ? 3 : 1
    await sleep((min + Math.random() * (max - min)) * factor)
  }
  if (forceError && kind !== 'auth') {
    throw new ApiError('upstream_error', 'The recall service is not responding. Please try again.', 502)
  }
  return fn()
}

/** Empty a list when the Developer panel forces empty states. */
export function maybeEmpty<T>(rows: T[]): T[] {
  return getMockConfig().forceEmpty ? [] : rows
}
