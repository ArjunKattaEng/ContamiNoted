// Firebase (Auth + Firestore Lite), loaded on demand from separate chunks, so it stays out of the main bundle
// and isn't in the build at all while accounts are off. With accounts on, it downloads right after start-up
// (the app needs to know whether someone is signed in). Config comes from VITE_FIREBASE_* (public values that
// identify the project), or, in development only, from the local emulators (VITE_USE_FIREBASE_EMULATORS=true
// with `npm run emulators`), which need no real project at all.
import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore/lite'

export interface FirebaseHandles {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

/** Project ID the emulators run under. "demo-" projects work only with emulators: no real resources. */
export const EMULATOR_PROJECT_ID = 'demo-recallguard'
export const AUTH_EMULATOR_PORT = 9099
export const FIRESTORE_EMULATOR_PORT = 8080

type Env = Partial<ImportMetaEnv>

/** Emulators only in development (`vite`, tests): a production or iOS build never points at 127.0.0.1. */
export const usesEmulators = (env: Env = import.meta.env) => env.DEV === true && env.VITE_USE_FIREBASE_EMULATORS === 'true'

/** The web app config, or null when Firebase isn't set up (accounts then stay off). */
export function firebaseConfig(env: Env = import.meta.env): FirebaseWebConfig | null {
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  if (usesEmulators(env) && !projectId) {
    return {
      apiKey: 'demo-api-key',
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID,
      appId: 'demo-app',
    }
  }
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const appId = env.VITE_FIREBASE_APP_ID
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null
}

let handles: Promise<FirebaseHandles> | null = null

/** Initializes Firebase once (downloading the SDK on first use). Rejects if Firebase isn't configured. */
export function getFirebase(): Promise<FirebaseHandles> {
  handles ??= (async () => {
    const config = firebaseConfig()
    if (!config) throw new Error('Firebase is not configured (VITE_FIREBASE_* or VITE_USE_FIREBASE_EMULATORS)')
    const [appSdk, authSdk, firestoreSdk, { isNative }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore/lite'),
      import('./native'),
    ])
    // Reuse the app if an earlier attempt got this far before failing
    const app = appSdk.getApps()[0] ?? appSdk.initializeApp(config)
    // In the iOS app's web view, getAuth()'s default persistence can hang; IndexedDB works there
    const auth = isNative
      ? authSdk.initializeAuth(app, { persistence: authSdk.indexedDBLocalPersistence })
      : authSdk.getAuth(app)
    // Optional fields in our types are omitted rather than written as undefined (Firestore rejects undefined).
    // No offline disk cache: on a shared device, signing out leaves none of the account's data behind.
    const db = firestoreSdk.initializeFirestore(app, { ignoreUndefinedProperties: true })
    if (usesEmulators()) {
      const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1'
      authSdk.connectAuthEmulator(auth, `http://${host}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true })
      firestoreSdk.connectFirestoreEmulator(db, host, FIRESTORE_EMULATOR_PORT)
    }
    return { app, auth, db }
  })()
  handles.catch(() => {
    handles = null // let a later call retry (e.g. after a failed chunk download)
  })
  return handles
}
