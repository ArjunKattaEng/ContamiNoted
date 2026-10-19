import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api'

const respond = (body: string, status = 200, contentType = 'application/json') =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': contentType } })))

afterEach(() => vi.unstubAllGlobals())

describe('apiFetch', () => {
  it('returns the JSON body', async () => {
    respond('{"items":[]}')
    await expect(apiFetch('/api/x')).resolves.toEqual({ items: [] })
  })

  it('fails when something other than the API answers (an HTML page), instead of returning nothing', async () => {
    respond('<!doctype html><title>RecallGuard</title>', 200, 'text/html')
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ code: 'upstream_error' })
  })

  it('maps contract errors, and errors without a JSON body', async () => {
    respond('{"error":{"code":"not_found","message":"Recall not found"}}', 404)
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ code: 'not_found', message: 'Recall not found', status: 404 })
    respond('Bad gateway', 502, 'text/plain')
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ code: 'upstream_error', status: 502 })
  })
})
