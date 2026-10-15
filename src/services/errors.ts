/** Error codes from docs/api-contract.md. */
export type ApiErrorCode =
  | 'invalid_request'
  | 'invalid_barcode'
  | 'unauthenticated'
  | 'not_found'
  | 'image_too_large'
  | 'receipt_unreadable'
  | 'quota_exceeded'
  | 'upstream_error'
  | 'not_implemented'

/** Error thrown by every service implementation. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  /** Seconds, for `quota_exceeded`. */
  readonly retryAfter?: number

  constructor(code: ApiErrorCode, message: string, status: number, retryAfter?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** Thrown by HTTP placeholder adapters until the backend endpoint exists. */
export class NotImplementedError extends ApiError {
  constructor(endpoint: string) {
    super('not_implemented', `Backend not connected yet: ${endpoint}`, 501)
    this.name = 'NotImplementedError'
  }
}

export function isApiError(err: unknown, code?: ApiErrorCode): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code)
}
