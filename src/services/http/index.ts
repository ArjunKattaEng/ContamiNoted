import type { Services } from '../types'
import { httpAlerts } from './alerts'
import { httpAuth } from './auth'
import { httpHistory } from './history'
import { httpMeta } from './meta'
import { httpRecalls } from './recalls'
import { httpSaved } from './saved'
import { httpScan } from './scan'

/** Real backend adapters. Placeholders until the backend exists; see docs/api-contract.md. */
export const httpServices: Services = {
  recalls: httpRecalls,
  scan: httpScan,
  history: httpHistory,
  alerts: httpAlerts,
  saved: httpSaved,
  auth: httpAuth,
  meta: httpMeta,
}
