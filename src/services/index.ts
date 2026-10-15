// The only import point for data access. Every service talks to the real backend (api/), except
// saved recalls, which live on this device until accounts exist. Services for features that are
// still "Coming soon" (src/lib/features.ts) are HTTP placeholders that throw NotImplementedError;
// hooks keep them disabled until the feature flag is on.
import { httpServices } from './http'
import { localSaved } from './local/saved'
import type { Services } from './types'

export const services: Services = {
  ...httpServices,
  saved: localSaved,
}

export * from './types'
export * from './errors'
