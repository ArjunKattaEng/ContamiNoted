import { daysAgo } from '@/mocks/data/dates'
import { currentUserData } from '@/mocks/db'
import { simulate } from '@/mocks/simulate'
import type { MetaService } from '../types'

export const mockMeta: MetaService = {
  dataSourceStatus: () =>
    simulate('read', () => ({
      source: 'openFDA food enforcement' as const,
      openFdaLastUpdated: daysAgo(2),
      lastWatchCheckAt: currentUserData().lastWatchCheckAt,
    })),
}
