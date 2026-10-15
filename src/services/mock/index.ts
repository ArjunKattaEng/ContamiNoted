import type { Services } from '../types'
import { mockAlerts } from './alerts'
import { mockAuth } from './auth'
import { mockHistory } from './history'
import { mockMeta } from './meta'
import { mockRecalls } from './recalls'
import { mockSaved } from './saved'
import { mockScan } from './scan'

/** Mock backend over synthetic fixtures (src/mocks). */
export const mockServices: Services = {
  recalls: mockRecalls,
  scan: mockScan,
  history: mockHistory,
  alerts: mockAlerts,
  saved: mockSaved,
  auth: mockAuth,
  meta: mockMeta,
}
