// HTTP plumbing for the future backend (docs/api-contract.md). Adapted from ArchePal's src/lib/api.ts.
import { ApiError, type ApiErrorCode } from '@/services/errors'
import { isNative } from './native'

/**
 * On the web, API paths stay relative (Vite proxy in dev, Vercel rewrite in prod). Capacitor
 * serves the app from capacitor://localhost with no proxy, so native calls need an absolute URL.
 */
export function apiUrl(path: string): string {
  return (isNative ? (import.meta.env.VITE_API_BASE_URL ?? '') : '') + path
}

/**
 * Authorization header for endpoints that verify Firebase Auth.
 * TODO(backend): return `Bearer ${await auth.currentUser.getIdToken()}` once Firebase is wired.
 */
export async function authHeader(): Promise<Record<string, string>> {
  return {}
}

/** fetch + JSON + contract error mapping. Not used until the HTTP adapters are implemented. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  for (const [k, v] of Object.entries(await authHeader())) headers.set(k, v)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(apiUrl(path), { ...init, headers })
  } catch {
    throw new ApiError('upstream_error', "Couldn't reach ContamiNoted. Check your connection.", 0)
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => undefined)
  // Not JSON: something other than the API answered (e.g. the iOS app's own index.html when VITE_API_BASE_URL
  // wasn't set at build time). An error, never an empty success the screens would crash on.
  if (res.ok && body === undefined) {
    throw new ApiError('upstream_error', "Couldn't reach ContamiNoted. Check your connection.", res.status)
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: ApiErrorCode; message?: string } } | undefined)?.error
    throw new ApiError(err?.code ?? 'upstream_error', err?.message ?? `Request failed (${res.status})`, res.status, (body as { retryAfter?: number } | undefined)?.retryAfter)
  }
  return body as T
}
