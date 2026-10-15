import { apiFetch } from '@/lib/api'
import type { DataSourceStatus } from '@/types'
import type { MetaService } from '../types'

export const httpMeta: MetaService = {
  /** GET /api/meta/data-source: openFDA's last-updated date (lastWatchCheckAt arrives with accounts) */
  dataSourceStatus: () => apiFetch<DataSourceStatus>('/api/meta/data-source'),
}
