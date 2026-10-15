import type { MetaService } from '../types'
import { notImplemented } from './notImplemented'

export const httpMeta: MetaService = {
  /** GET /api/meta/data-source → DataSourceStatus */
  dataSourceStatus: () => notImplemented('GET /api/meta/data-source'),
}
