import { TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Classification, RecallStatus } from '@/types'

const classificationVariant = { 'Class I': 'alert', 'Class II': 'warn', 'Class III': 'outline' } as const

/** FDA risk class: I = serious, II = temporary/reversible, III = unlikely to cause harm. */
export function ClassificationBadge({ classification }: { classification: Classification }) {
  return <Badge variant={classificationVariant[classification]}>{classification}</Badge>
}

/** Shown only for closed recalls; ongoing is the default state. */
export function RecallStatusBadge({ status }: { status: RecallStatus }) {
  if (status === 'Ongoing') return null
  return <Badge variant="outline">{status}</Badge>
}

/** One of the user's scanned items matches this recall. */
export function MatchBadge() {
  return (
    <Badge variant="alert">
      <TriangleAlert /> Matches your items
    </Badge>
  )
}
