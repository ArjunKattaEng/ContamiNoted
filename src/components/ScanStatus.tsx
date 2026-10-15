import { CircleCheck, CircleHelp, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { overallStatus } from '@/lib/scan'
import { cn } from '@/lib/utils'
import type { MatchStatus, Scan } from '@/types'

const statusStyle: Record<
  MatchStatus,
  { icon: LucideIcon; label: string; badge: 'alert' | 'warn' | 'safe' | 'outline'; color: string }
> = {
  confirmed: { icon: TriangleAlert, label: 'Recalled', badge: 'alert', color: 'text-destructive' },
  possible: { icon: CircleHelp, label: 'Check item', badge: 'warn', color: 'text-warning' },
  clear: { icon: CircleCheck, label: 'No recall', badge: 'safe', color: 'text-success' },
  error: { icon: CircleX, label: 'Unreadable', badge: 'outline', color: 'text-muted-foreground' },
}

export function StatusIcon({ status, className }: { status: MatchStatus; className?: string }) {
  const { icon: Icon, color, label } = statusStyle[status]
  return <Icon className={cn('size-5 flex-none', color, className)} aria-label={label} />
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const { badge, label } = statusStyle[status]
  return <Badge variant={badge}>{label}</Badge>
}

/** Badge summarizing a whole scan (receipt list rows). */
export function ScanStatusBadge({ scan }: { scan: Pick<Scan, 'counts'> }) {
  const status = overallStatus(scan)
  const label = { confirmed: 'Recall match', possible: 'Check items', error: 'Unreadable lines', clear: 'No recalls' }[
    status
  ]
  return <Badge variant={statusStyle[status].badge}>{label}</Badge>
}
