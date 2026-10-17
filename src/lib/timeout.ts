export class TimeoutError extends Error {
  constructor(what: string) {
    super(`${what} timed out`)
    this.name = 'TimeoutError'
  }
}

/** Rejects with a TimeoutError if `promise` hasn't settled within `ms` (it keeps running in the background). */
export function withTimeout<T>(promise: Promise<T>, ms: number, what = 'The request'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(what)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
