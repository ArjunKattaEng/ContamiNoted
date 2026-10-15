// Result-page parts (verdict, item rows). These pull in the markdown renderer, so list screens import
// from ScanRows / ScanStatus instead to keep it out of the initial bundle.
import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/sonner'
import { useUpdateScanItem } from '@/hooks/use-scans'
import { recallPath } from '@/lib/recall'
import { formatPrice, overallStatus } from '@/lib/scan'
import { cn } from '@/lib/utils'
import { isApiError } from '@/services/errors'
import type { MatchStatus, ScanCounts, ScanItem, ScanVerdict } from '@/types'
import { Markdown } from './Markdown'
import { StatusIcon } from './ScanStatus'

const verdictTone: Record<MatchStatus, string> = {
  confirmed: 'border-destructive/40 bg-destructive-soft',
  possible: 'border-warning/30 bg-warning-soft',
  error: 'border-border bg-muted/50',
  clear: 'border-success/30 bg-success-soft',
}

/** The AI verdict for a scan, tinted by the most serious item status. */
export function VerdictCard({ verdict, counts }: { verdict: ScanVerdict | null; counts: ScanCounts }) {
  const status = overallStatus({ counts })
  return (
    <section className={cn('rounded-lg border p-4', verdictTone[status])} aria-live="polite">
      <div className="flex items-start gap-2.5">
        <StatusIcon status={status} className="mt-0.5" />
        <h2 className="text-base font-bold leading-snug">{verdict?.headline ?? 'Scan complete'}</h2>
      </div>
      {verdict?.details && <Markdown className="mt-2">{verdict.details}</Markdown>}
      {verdict && verdict.nextSteps.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {verdict.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ScanDisclaimer() {
  return (
    <p className="text-xs text-muted-foreground">
      Results are matched against FDA food recall notices and may miss recalls that don’t list a barcode or use a
      different product name. Always compare the brand, size, lot code and dates on your package with the recall notice.
    </p>
  )
}

/** Inline form to name an unreadable line and re-check it. */
function EditItemName({ scanId, item }: { scanId: string; item: ScanItem }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(item.name)
  const update = useUpdateScanItem()

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 mt-1 text-sm underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        <Pencil /> {item.status === 'error' ? 'Add item name' : 'Edit name'}
      </Button>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(
      { scanId, itemId: item.id, name },
      {
        onSuccess: (scan) => {
          const updated = scan.items.find((i) => i.id === item.id)
          setOpen(false)
          toast(
            updated?.status === 'possible'
              ? `“${name.trim()}” may be affected by a recall`
              : `No recalls found for “${name.trim()}”`,
          )
        },
        onError: (err) => toast(isApiError(err) ? err.message : 'Couldn’t check that item'),
      },
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Baby spinach"
        aria-label="Item name"
        className="h-10"
        maxLength={100}
      />
      <Button type="submit" size="sm" className="h-10" disabled={update.isPending || name.trim().length < 2}>
        {update.isPending ? 'Checking…' : 'Check'}
      </Button>
    </form>
  )
}

/** One receipt line: status, normalized name, the raw text as printed, price, note and recall links. */
export function ScanItemRow({ scanId, item }: { scanId: string; item: ScanItem }) {
  return (
    <li className="flex gap-3 border-b py-3 last:border-b-0">
      <StatusIcon status={item.status} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <strong className={cn('text-sm', item.status === 'error' && 'font-medium italic text-muted-foreground')}>
            {item.name || 'Unreadable line'}
          </strong>
          {item.price !== undefined && (
            <span className="flex-none text-sm tabular-nums">{formatPrice(item.price)}</span>
          )}
        </div>
        {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
        {item.raw && <p className="truncate font-mono text-[11px] text-muted-foreground">{item.raw}</p>}
        {item.note && <p className="mt-1 text-xs">{item.note}</p>}
        {item.recallNumbers.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-3">
            {item.recallNumbers.map((n) => (
              <Link key={n} to={recallPath(n)} className="text-xs font-bold underline underline-offset-2">
                View recall {n}
              </Link>
            ))}
          </div>
        )}
        {item.status === 'error' && <EditItemName scanId={scanId} item={item} />}
      </div>
    </li>
  )
}
