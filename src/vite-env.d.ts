/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (default) uses synthetic data; 'api' uses the HTTP adapters. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
  /** With VITE_DATA_SOURCE=mock: comma-separated services that use the backend, e.g. "recalls". */
  readonly VITE_LIVE_SERVICES?: string
  /** Absolute API origin used by the iOS app, e.g. https://recallguard.vercel.app */
  readonly VITE_API_BASE_URL?: string
}

/** package.json version, injected by vite.config.ts */
declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
