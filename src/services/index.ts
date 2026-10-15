// The only import point for data access.
//   VITE_DATA_SOURCE=api         → every service uses the backend (src/services/http)
//   VITE_DATA_SOURCE=mock        → synthetic data (src/services/mock), the default
//   VITE_LIVE_SERVICES=recalls,… → with mock, switch individual services to the backend as they go live
import { httpServices } from './http'
import { mockServices } from './mock'
import { isApiError } from './errors'
import { DEMO_SUMMARY_MODEL } from '@/lib/demo'
import type { Recall } from '@/types'
import type { RecallsService, Services } from './types'

export const dataSource = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'

const liveList = new Set((import.meta.env.VITE_LIVE_SERVICES ?? '').split(',').map((s) => s.trim()))

/** Whether a service talks to the real backend (vs synthetic demo data). */
export const isLive = (name: keyof Services): boolean => dataSource === 'api' || liveList.has(name)

/** True when any part of the app still runs on demo data (shows demo labels, samples and the Developer panel). */
export const usesDemoData = (Object.keys(mockServices) as (keyof Services)[]).some((name) => !isLive(name))

/**
 * Live recalls with demo scans: demo alerts and scan results point at fictional fixture recalls,
 * which openFDA doesn't know. Fall back to the fixture so those links still open (the page shows
 * a demo-data label, see isDemoRecall).
 */
function withFixtureFallback(live: RecallsService, demo: RecallsService): RecallsService {
  return {
    ...live,
    get: (recallNumber) =>
      live.get(recallNumber).catch((err: unknown) => {
        if (isApiError(err, 'not_found')) return demo.get(recallNumber)
        throw err
      }),
    summary: (recallNumber) =>
      live.summary(recallNumber).catch((err: unknown) => {
        if (isApiError(err, 'not_found')) return demo.summary(recallNumber)
        throw err
      }),
  }
}

const pick = <K extends keyof Services>(name: K): Services[K] => (isLive(name) ? httpServices[name] : mockServices[name])

export const services: Services = {
  recalls:
    isLive('recalls') && !isLive('scan') ? withFixtureFallback(httpServices.recalls, mockServices.recalls) : pick('recalls'),
  scan: pick('scan'),
  history: pick('history'),
  alerts: pick('alerts'),
  saved: pick('saved'),
  auth: pick('auth'),
  meta: pick('meta'),
}

/** A fictional fixture recall (demo data) rather than a real openFDA record. */
export const isDemoRecall = (recall: Pick<Recall, 'summary'>): boolean =>
  !isLive('recalls') || recall.summary?.model === DEMO_SUMMARY_MODEL

export * from './types'
export * from './errors'
