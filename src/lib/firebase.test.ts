import { describe, expect, it } from 'vitest'
import { EMULATOR_PROJECT_ID, firebaseConfig, usesEmulators } from './firebase'

describe('firebaseConfig', () => {
  it('is null until a project is configured', () => {
    expect(firebaseConfig({})).toBeNull()
    expect(firebaseConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p' })).toBeNull()
  })

  it('uses the real project when all four values are set', () => {
    const env = {
      VITE_FIREBASE_API_KEY: 'k',
      VITE_FIREBASE_AUTH_DOMAIN: 'p.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'p',
      VITE_FIREBASE_APP_ID: 'a',
    }
    expect(firebaseConfig(env)).toEqual({ apiKey: 'k', authDomain: 'p.firebaseapp.com', projectId: 'p', appId: 'a' })
  })

  it('needs no real project with the emulators', () => {
    const env = { DEV: true, VITE_USE_FIREBASE_EMULATORS: 'true' }
    expect(usesEmulators(env)).toBe(true)
    expect(firebaseConfig(env)?.projectId).toBe(EMULATOR_PROJECT_ID)
  })

  it('never uses the emulators in a production build', () => {
    const env = { DEV: false, VITE_USE_FIREBASE_EMULATORS: 'true' }
    expect(usesEmulators(env)).toBe(false)
    expect(firebaseConfig(env)).toBeNull() // so accounts stay off
  })
})
