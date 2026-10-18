import { Bolt, FlaskConical, Microscope, Palette, ShieldAlert, Tag, Wheat, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { HazardKind } from '@/lib/hazard'
import { cn } from '@/lib/utils'
import type { Classification, RecallStatus } from '@/types'

const classificationVariant = { 'Class I': 'alert', 'Class II': 'warn', 'Class III': 'outline' } as const

/** What each class means, in a word (FDA: I = serious, II = temporary or reversible, III = unlikely to harm). */
const classificationMeaning = { 'Class I': 'Serious', 'Class II': 'Moderate', 'Class III': 'Low risk' } as const

/** FDA risk class as a colored dot with its meaning, e.g. "Class I · Serious". `large`: under a recall's name. */
export function ClassificationBadge({ classification, large }: { classification: Classification; large?: boolean }) {
  return (
    <Badge
      variant={classificationVariant[classification]}
      className={cn(large && 'gap-2 text-base font-semibold text-foreground before:size-4')}
    >
      {classification} · {classificationMeaning[classification]}
    </Badge>
  )
}

/** Shown only for closed recalls; ongoing is the default state. */
export function RecallStatusBadge({ status }: { status: RecallStatus }) {
  if (status === 'Ongoing') return null
  return <Badge variant="outline">{status}</Badge>
}

const hazardStyle: Record<HazardKind, { icon: LucideIcon; tone: string }> = {
  germs: { icon: Microscope, tone: 'bg-destructive-soft text-destructive' },
  chemical: { icon: FlaskConical, tone: 'bg-destructive-soft text-destructive' },
  object: { icon: Bolt, tone: 'bg-warning-soft text-warning' },
  allergen: { icon: Wheat, tone: 'bg-warning-soft text-warning' },
  color: { icon: Palette, tone: 'bg-muted text-muted-foreground' },
  label: { icon: Tag, tone: 'bg-muted text-muted-foreground' },
  other: { icon: ShieldAlert, tone: 'bg-muted text-muted-foreground' },
}

/** The bare icon for a kind of problem (germs, allergen, …), without the tile. */
export function HazardIcon({ kind }: { kind: HazardKind }) {
  const Icon = hazardStyle[kind].icon
  return <Icon aria-hidden />
}

/**
 * The picture at the start of a recall row (recalls have no product photos, unlike Yuka's products): an
 * icon for the kind of problem, from src/lib/hazard.ts. Saved recalls don't carry the reason: a shield.
 */
export function HazardTile({ kind, className }: { kind?: HazardKind; className?: string }) {
  const { icon: Icon, tone } = hazardStyle[kind ?? 'other']
  return (
    <div className={cn('grid size-12 flex-none place-items-center rounded-xl', tone, className)} aria-hidden>
      <Icon className="size-1/2" strokeWidth={1.75} />
    </div>
  )
}

/** One of the user's scanned items matches this recall. */
export function MatchBadge() {
  return (
    <Badge variant="alert" className="font-semibold text-destructive">
      Matches your items
    </Badge>
  )
}
