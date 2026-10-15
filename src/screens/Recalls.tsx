import { useEffect, useState, type ReactNode } from 'react'
import { FileQuestion, Share2, ShieldCheck, Star, SearchX } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Markdown } from '@/components/Markdown'
import { ClassificationBadge, MatchBadge, RecallStatusBadge } from '@/components/RecallBadges'
import { RecallCardSkeleton, RecallGrid } from '@/components/RecallCard'
import { RecallList } from '@/components/RecallList'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SearchInput } from '@/components/SearchInput'
import { EmptyState, ErrorState } from '@/components/StateViews'
import { useAlerts, useDismissAlert } from '@/hooks/use-alerts'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useRecallFlags } from '@/hooks/use-recall-flags'
import { useRecall, useRecallSearch, useRecallSummary, useRecentRecalls } from '@/hooks/use-recalls'
import { useSavedRecalls } from '@/hooks/use-saved'
import { formatDate } from '@/lib/format'
import { isCancel, shareRecall } from '@/lib/native'
import { DEFAULT_RECALL_WINDOW, parseRecallWindow, RECALL_WINDOWS, recallWindowLabel } from '@/lib/recall'
import { itemOrigin } from '@/lib/scan'
import { cn } from '@/lib/utils'
import { features } from '@/lib/features'
import { isApiError } from '@/services/errors'
import type { Recall, RecallSummary, RecallSummarySections, RecallTab } from '@/types'

type ListTab = RecallTab | 'saved'
const listTabs: ListTab[] = ['active', 'resolved', 'saved']

function ListSkeleton() {
  return (
    <RecallGrid>
      {Array.from({ length: 4 }, (_, i) => (
        <RecallCardSkeleton key={i} />
      ))}
    </RecallGrid>
  )
}

interface WindowProps {
  /** Time window in days; null = all time. */
  days: number | null
  onDaysChange: (days: number | null) => void
}

/** "Reported: Last 30 days ▾" (or "Closed: …" for resolved recalls). A native select keeps the iOS picker. */
function WindowFilter({ days, onDaysChange, verb }: WindowProps & { verb: 'Reported' | 'Closed' }) {
  return (
    <label className="flex flex-none items-center gap-2 text-sm text-muted-foreground">
      {verb}
      <NativeSelect
        className="h-9 flex-none text-sm text-foreground"
        value={days ?? 'all'}
        onChange={(e) => onDaysChange(e.target.value === 'all' ? null : Number(e.target.value))}
      >
        {RECALL_WINDOWS.map((w) => (
          <option key={w.label} value={w.days ?? 'all'}>
            {w.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  )
}

/** Count on the left, window filter on the right. */
function ListHeader({ children, filter }: { children: ReactNode; filter: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-sm text-muted-foreground" role="status">
        {children}
      </p>
      {filter}
    </div>
  )
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`

function RecallFeed({ status, days, onDaysChange }: { status: RecallTab } & WindowProps) {
  const query = useRecentRecalls(status, days)
  const verb = status === 'active' ? 'Reported' : 'Closed'
  const filter = <WindowFilter days={days} onDaysChange={onDaysChange} verb={verb} />
  const windowLabel = recallWindowLabel(days)

  if (query.isPending) {
    return (
      <>
        <ListHeader filter={filter}>Loading…</ListHeader>
        <ListSkeleton />
      </>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  const recalls = query.data.pages.flatMap((p) => p.items)
  const total = query.data.pages[0].total
  if (recalls.length === 0) {
    return (
      <>
        <ListHeader filter={filter}>No recalls</ListHeader>
        <EmptyState
          icon={ShieldCheck}
          title={
            status === 'active'
              ? `No food recalls reported in the ${windowLabel}`
              : `No recalls closed in the ${windowLabel}`
          }
          action={
            days !== null && (
              <Button variant="secondary" size="sm" onClick={() => onDaysChange(null)}>
                Show all time
              </Button>
            )
          }
        >
          {status === 'active'
            ? 'Ongoing FDA food recalls reported in this period will show up here.'
            : 'Recalls the FDA closes in this period will show up here.'}
        </EmptyState>
      </>
    )
  }
  return (
    <>
      <ListHeader filter={filter}>
        {status === 'active'
          ? plural(total, 'active recall', 'active recalls')
          : plural(total, 'resolved recall', 'resolved recalls')}
        {days !== null && (status === 'active' ? ` reported in the ${windowLabel}` : ` closed in the ${windowLabel}`)}
      </ListHeader>
      <RecallList recalls={recalls} />
      {query.hasNextPage && (
        <Button
          variant="secondary"
          className="mt-4 desktop:mx-auto desktop:w-64"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </>
  )
}

function SavedList() {
  const query = useSavedRecalls()
  if (query.isPending) return <ListSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data.length === 0) {
    return (
      <EmptyState icon={Star} title="No saved recalls">
        Tap the star on any recall to keep it here.
      </EmptyState>
    )
  }
  return <RecallList recalls={query.data.map((s) => s.recall)} />
}

function SearchResults({ q, days, onDaysChange }: { q: string } & WindowProps) {
  const query = useRecallSearch(q, days)
  const filter = <WindowFilter days={days} onDaysChange={onDaysChange} verb="Reported" />
  const windowLabel = recallWindowLabel(days)

  if (query.isPending) {
    return (
      <>
        <ListHeader filter={filter}>Searching…</ListHeader>
        <ListSkeleton />
      </>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data.items.length === 0) {
    return (
      <>
        <ListHeader filter={filter}>No matches</ListHeader>
        <EmptyState
          icon={SearchX}
          title={days === null ? `No recalls found for “${q}”` : `No recalls for “${q}” in the ${windowLabel}`}
          action={
            days !== null && (
              <Button variant="secondary" size="sm" onClick={() => onDaysChange(null)}>
                Search all time
              </Button>
            )
          }
        >
          Try a brand, a product, or a hazard such as “Listeria” or “milk”.
        </EmptyState>
      </>
    )
  }
  return (
    <>
      <ListHeader filter={filter}>
        {plural(query.data.total, 'recall', 'recalls')} match “{q}”{days !== null && ` in the ${windowLabel}`}
      </ListHeader>
      <RecallList recalls={query.data.items} />
    </>
  )
}

/** Recall list: Active / Resolved / Saved tabs plus search, filtered to a time window (default 30 days). Tab, query and window live in the URL. */
export function Recalls() {
  const [params, setParams] = useSearchParams()
  const tab = listTabs.find((t) => t === params.get('tab')) ?? 'active'
  const [input, setInput] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(input.trim(), 300)
  const days = parseRecallWindow(params.get('days'))

  // The 30-day default keeps the URL clean; other windows are kept in ?days= (all time = "all")
  const setDays = (value: number | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === DEFAULT_RECALL_WINDOW) next.delete('days')
        else next.set('days', value === null ? 'all' : String(value))
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [q, setParams])

  const setTab = (value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', value)
        return next
      },
      { replace: true },
    )

  return (
    <>
      <ScreenHeader title="Recalls" back={false} />
      <Screen>
        <SearchInput value={input} onChange={setInput} placeholder="Search by product, brand or hazard" />
        {q.length >= 2 ? (
          <div className="mt-4">
            <SearchResults q={q} days={days} onDaysChange={setDays} />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-2">
            <TabsList className="desktop:max-w-md">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <RecallFeed status="active" days={days} onDaysChange={setDays} />
            </TabsContent>
            <TabsContent value="resolved">
              <RecallFeed status="resolved" days={days} onDaysChange={setDays} />
            </TabsContent>
            <TabsContent value="saved">
              <SavedList />
            </TabsContent>
          </Tabs>
        )}
      </Screen>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Recall detail

const ACTION_SECTION_ID = 'what-to-do'

const summaryOrder: { key: keyof RecallSummarySections; title: string; id?: string }[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'actionRequired', title: 'What to do', id: ACTION_SECTION_ID },
  { key: 'healthRisks', title: 'Health risks' },
  { key: 'reason', title: 'Why it was recalled' },
  { key: 'productDetails', title: 'What’s affected' },
  { key: 'distribution', title: 'Where it was sold' },
  { key: 'contact', title: 'Contact' },
]

function SummarySections({ recall, loading }: { recall: Recall; loading: boolean }) {
  const sections = recall.summary?.sections
  if (!sections && loading) {
    return (
      <div className="space-y-5" aria-busy aria-label="Writing summary">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Writing a plain-language summary of this recall…</p>
      </div>
    )
  }
  if (!sections) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          An AI summary isn’t available for this recall yet. Here is the FDA’s description:
        </p>
        <p>{recall.reasonForRecall}</p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      {summaryOrder.map(({ key, title, id }) => (
        <section key={key} id={id} className="scroll-mt-4">
          <h3 className="mb-1.5 font-bold">{title}</h3>
          <Markdown>{sections[key]}</Markdown>
        </section>
      ))}
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Summary written by AI from the FDA enforcement record. Always compare the codes and dates on your package with
        the official FDA notice.
      </p>
    </div>
  )
}

function FdaDetails({ recall }: { recall: Recall }) {
  const rows: [string, ReactNode][] = [
    ['Recall number', recall.recallNumber],
    ['Event ID', recall.eventId],
    ['Classification', recall.classification],
    ['Status', recall.status],
    ['Firm', [recall.recallingFirm, [recall.city, recall.state].filter(Boolean).join(', ')].filter(Boolean).join(', ')],
    ['Product', recall.productDescription],
    ['Quantity', recall.productQuantity],
    ['Codes', recall.codeInfo],
    ['Distribution', recall.distributionPattern],
    ['Reason', recall.reasonForRecall],
    ['Initiated', formatDate(recall.recallInitiationDate)],
    ['Reported', formatDate(recall.reportDate)],
    ['Closed', recall.terminationDate && formatDate(recall.terminationDate)],
    ['Type', recall.voluntaryMandated],
  ]
  return (
    <dl className="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-3 gap-y-2 text-sm">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0 break-words">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

function YourItems({ recallNumber }: { recallNumber: string }) {
  const alerts = useAlerts()
  const dismiss = useDismissAlert()
  if (alerts.isPending) return <Skeleton className="h-10 w-full" />
  const matches = (alerts.data ?? []).filter((a) => a.recallNumber === recallNumber)
  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">None of your scanned items match this recall.</p>
  }
  return (
    <ul className="space-y-2">
      {matches.map((a) => (
        <li
          key={a.id}
          className={cn('flex items-center justify-between gap-2 text-sm', a.dismissed && 'text-muted-foreground')}
        >
          <span className="min-w-0">
            {a.itemName}
            <small className="block text-xs text-muted-foreground">{itemOrigin(a)}</small>
          </span>
          {a.dismissed ? (
            <Badge variant="outline">Dismissed</Badge>
          ) : (
            <span className="flex flex-none items-center gap-1">
              <Badge variant={a.confidence === 'confirmed' ? 'alert' : 'warn'}>
                {a.confidence === 'confirmed' ? 'Confirmed match' : 'Possible match'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs underline underline-offset-2"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(a.id, { onError: () => toast('Couldn’t dismiss this alert') })}
              >
                Dismiss
              </Button>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-busy>
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-6 h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function DesktopCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[.05em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** Use the separately loaded full summary when the recall came without one. */
function withSummary(recall: Recall, summary: RecallSummary | null | undefined): Recall {
  return recall.summary?.sections || !summary ? recall : { ...recall, summary }
}

export function RecallDetail() {
  const { recallNumber } = useParams()
  const navigate = useNavigate()
  const query = useRecall(recallNumber)
  // Live recalls arrive before their AI summary; load it separately so the FDA data shows at once
  const needsSummary = !!query.data && !query.data.summary?.sections
  const summaryQuery = useRecallSummary(recallNumber, needsSummary)
  const flags = useRecallFlags()
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState('summary')
  const [scrollToAction, setScrollToAction] = useState(false)

  // "Find refund" jumps to the "What to do" section (after switching to the Summary tab on phones)
  useEffect(() => {
    if (!scrollToAction) return
    // Next frame: when the tab just switched, the Summary panel needs a layout pass first
    const frame = requestAnimationFrame(() => {
      document.getElementById(ACTION_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToAction(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [scrollToAction, tab])

  const findRefund = () => {
    setTab('summary')
    setScrollToAction(true)
  }

  const share = async (recall: Recall) => {
    try {
      const result = await shareRecall({ ...recall, shortSummary: recall.summary?.shortSummary })
      if (result === 'copied') toast('Recall copied to clipboard')
    } catch (err) {
      if (!isCancel(err)) toast('Couldn’t share this recall')
    }
  }

  const header = <ScreenHeader title="Recall details" backOnDesktop />

  if (query.isPending) {
    return (
      <>
        {header}
        <Screen>
          <DetailSkeleton />
        </Screen>
      </>
    )
  }
  if (query.isError) {
    return (
      <>
        {header}
        <Screen>
          {isApiError(query.error, 'not_found') ? (
            <EmptyState
              icon={FileQuestion}
              title="Recall not found"
              action={
                <Button variant="secondary" size="sm" onClick={() => navigate('/recalls')}>
                  Browse recalls
                </Button>
              }
            >
              It may have been removed, or the link is wrong.
            </EmptyState>
          ) : (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          )}
        </Screen>
      </>
    )
  }

  const recall = withSummary(query.data, summaryQuery.data)
  const summaryLoading = summaryQuery.isPending && needsSummary
  const saved = flags.isSaved(recall.recallNumber)
  const matched = flags.isMatched(recall.recallNumber)

  const heading = (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ClassificationBadge classification={recall.classification} />
        <RecallStatusBadge status={recall.status} />
        {matched && <MatchBadge />}
      </div>
      <h2 className="text-lg font-bold leading-snug desktop:text-xl">{recall.productDescription}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {recall.recallingFirm} · Reported {formatDate(recall.reportDate)} · {recall.recallNumber}
      </p>
      {recall.summary?.shortSummary && <p className="mt-3 font-medium leading-snug">{recall.summary.shortSummary}</p>}
    </div>
  )

  const saveButton = (
    <Button
      variant="secondary"
      size={isDesktop ? 'default' : 'icon'}
      className={cn(isDesktop ? '' : 'h-12 w-12 flex-none')}
      onClick={() => flags.toggleSaved(recall)}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save recall'}
    >
      <Star className={cn(saved && 'fill-current')} />
      {isDesktop && (saved ? 'Saved' : 'Save')}
    </Button>
  )
  const shareButton = (
    <Button
      variant="secondary"
      size={isDesktop ? 'default' : 'icon'}
      className={cn(isDesktop ? '' : 'h-12 w-12 flex-none')}
      onClick={() => share(recall)}
      aria-label="Share recall"
    >
      <Share2 />
      {isDesktop && 'Share'}
    </Button>
  )

  if (isDesktop) {
    return (
      <>
        {header}
        <Screen>
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-8">
            <div>
              {heading}
              <SummarySections recall={recall} loading={summaryLoading} />
            </div>
            <aside className="sticky top-0 space-y-4">
              <div className="space-y-2">
                <Button onClick={findRefund}>Find refund</Button>
                <div className="grid grid-cols-2 gap-2">
                  {shareButton}
                  {saveButton}
                </div>
              </div>
              {features.alerts && (
                <DesktopCard title="Your items">
                  <YourItems recallNumber={recall.recallNumber} />
                </DesktopCard>
              )}
              <DesktopCard title="FDA record">
                <FdaDetails recall={recall} />
              </DesktopCard>
            </aside>
          </div>
        </Screen>
      </>
    )
  }

  return (
    <>
      {header}
      <Screen>
        {heading}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">FDA details</TabsTrigger>
            {features.alerts && <TabsTrigger value="items">Your items</TabsTrigger>}
          </TabsList>
          <TabsContent value="summary">
            <SummarySections recall={recall} loading={summaryLoading} />
          </TabsContent>
          <TabsContent value="details">
            <FdaDetails recall={recall} />
          </TabsContent>
          {features.alerts && (
            <TabsContent value="items">
              <YourItems recallNumber={recall.recallNumber} />
            </TabsContent>
          )}
        </Tabs>
      </Screen>
      <div className="flex flex-none gap-2 border-t bg-card px-4 pb-[calc(12px+var(--safe-bottom))] pt-3 md:px-6">
        <Button onClick={findRefund}>Find refund</Button>
        {shareButton}
        {saveButton}
      </div>
    </>
  )
}
