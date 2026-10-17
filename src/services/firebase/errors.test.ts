import { describe, expect, it } from 'vitest'
import { ApiError } from '../errors'
import { firebaseErrorCode, toApiError, withApiErrors } from './errors'

const fbError = (code: string) => Object.assign(new Error(`Firebase: Error (${code}).`), { code })

describe('Firebase errors', () => {
  it('maps wrong credentials to one message that does not reveal which part was wrong', () => {
    const messages = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].map((c) => toApiError(fbError(c)))
    expect(new Set(messages.map((m) => m.message)).size).toBe(1)
    expect(messages[0].code).toBe('unauthenticated')
  })

  it('maps the cases the screens treat specially', () => {
    expect(toApiError(fbError('auth/popup-closed-by-user')).code).toBe('cancelled')
    expect(toApiError(fbError('auth/popup-blocked')).code).toBe('popup_blocked')
    expect(toApiError(fbError('auth/requires-recent-login')).code).toBe('requires_recent_login')
    expect(toApiError(fbError('auth/email-already-in-use')).message).toMatch(/already an account/)
  })

  it('falls back to a generic message and passes ApiErrors through', () => {
    expect(toApiError(new Error('boom'))).toMatchObject({ code: 'upstream_error' })
    const api = new ApiError('not_found', 'x', 404)
    expect(toApiError(api)).toBe(api)
    expect(firebaseErrorCode({ code: 42 })).toBeUndefined()
  })

  it('wraps a failing call', async () => {
    await expect(withApiErrors(() => Promise.reject(fbError('auth/weak-password')))).rejects.toMatchObject({
      code: 'invalid_request',
    })
    await expect(withApiErrors(async () => 1)).resolves.toBe(1)
  })
})
