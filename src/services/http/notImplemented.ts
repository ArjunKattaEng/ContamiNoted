import { NotImplementedError } from '../errors'

/** Placeholder body for an adapter method whose backend endpoint doesn't exist yet. */
export function notImplemented(endpoint: string): Promise<never> {
  return Promise.reject(new NotImplementedError(endpoint))
}
