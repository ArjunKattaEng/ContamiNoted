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

/** `large`: the big dot and bold label under a product's name, as on Yuka's product page. */
export function MatchStatusBadge({ status, large }: { status: MatchStatus; large?: boolean }) {
  const { badge, label } = statusStyle[status]
  return (
    <Badge variant={badge} className={cn(large && 'gap-2 text-base font-semibold text-foreground before:size-4')}>
      {label}
    </Badge>
  )
}

/** Badge summarizing a whole scan (receipt list rows). */
export function ScanStatusBadge({ scan }: { scan: Pick<Scan, 'counts'> }) {
  const status = overallStatus(scan)
  const label = { confirmed: 'Recall match', possible: 'Check items', error: 'Unreadable lines', clear: 'No recalls' }[
    status
  ]
  return <Badge variant={statusStyle[status].badge}>{label}</Badge>
}
