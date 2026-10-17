/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin used by the iOS app, e.g. https://recallguard.vercel.app */
  readonly VITE_API_BASE_URL?: string
  /** "true" turns on accounts (sign-up, log-in, data in Firestore). Off for real users until launch. */
  readonly VITE_ACCOUNTS?: string
  /** Firebase web app config (public by design: it identifies the project, it isn't a secret) */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** "true" connects to the local Auth and Firestore emulators (`npm run emulators`) */
  readonly VITE_USE_FIREBASE_EMULATORS?: string
  /** Emulator host, default 127.0.0.1 (e.g. your computer's LAN address when testing on a phone) */
  readonly VITE_FIREBASE_EMULATOR_HOST?: string
}

/** package.json version, injected by vite.config.ts */
declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
