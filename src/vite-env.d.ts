/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin used by the iOS app, e.g. https://recallguard.vercel.app */
  readonly VITE_API_BASE_URL?: string
}

/** package.json version, injected by vite.config.ts */
declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
