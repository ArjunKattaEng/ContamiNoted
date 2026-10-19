import { useState, type ReactNode } from 'react'
import { Clock, Package, Receipt, ScanLine, SearchX, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RowCard, RowMeta, RowTrailing } from '@/components/RowCard'
import { ClassificationBadge, HazardTile, RecallStatusBadge } from '@/components/RecallBadges'
import { IconTile, ProductImage, ReceiptRow } from '@/components/ScanRows'
import { MatchStatusBadge } from '@/components/ScanStatus'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SearchInput } from '@/components/SearchInput'
import { EmptyState, ErrorState } from '@/components/StateViews'
import { useDeleteProduct, useProducts } from '@/hooks/use-products'
import { useScanHistory } from '@/hooks/use-scans'
import { formatUpc } from '@/lib/barcode'
import { getExpiryDate, isExpired, productSafety } from '@/lib/expiry'
import { features } from '@/lib/features'
import { formatDate, formatTimestampDate } from '@/lib/format'
import { hazardOf } from '@/lib/hazard'
import { recallPath } from '@/lib/recall'
import { clearRecallHistory, getRecallHistory, removeRecallView, type ViewedRecall } from '@/lib/recall-history'
import { getThumbnail } from '@/lib/thumbnails'
import { overallStatus, productTitle, scanPath } from '@/lib/scan'
import { cn } from '@/lib/utils'
import type { Scan, WatchItem } from '@/types'

/** Header action: icon on phones/tablets, labeled button on desktop. */
function ScanButton({ label, to }: { label: string; to: string }) {
  const navigate = useNavigate()
  return (
    <>
      <Button variant="ghost" size="icon" className="desktop:hidden" aria-label={label} onClick={() => navigate(to)}>
        <ScanLine />
      </Button>
      <Button size="sm" className="hidden desktop:inline-flex" onClick={() => navigate(to)}>
        <ScanLine /> {label}
      </Button>
    </>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-busy>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[66px] w-full rounded-lg" />
      ))}
    </div>
  )
}

function FilterTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: [T, string][]
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="mt-2">
      <TabsList className="desktop:max-w-md">
        {options.map(([v, label]) => (
          <TabsTrigger key={v} value={v}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

const includesQuery = (q: string, ...fields: (string | undefined)[]) =>
  !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()))

// ---------------------------------------------------------------------------------------------

type ReceiptFilter = 'all' | 'attention' | 'clear'

function receiptMatchesFilter(scan: Scan, filter: ReceiptFilter) {
  if (filter === 'all') return true
  const clear = overallStatus(scan) === 'clear'
  return filter === 'clear' ? clear : !clear
}

export function ReceiptHistory() {
  const navigate = useNavigate()
  const query = useScanHistory('receipt')
  const [filter, setFilter] = useState<ReceiptFilter>('all')
  const [q, setQ] = useState('')

  let body: ReactNode
  if (query.isPending) body = <ListSkeleton />
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else if (query.data.length === 0) {
    body = (
      <EmptyState
        icon={Receipt}
        title="No receipts yet"
        action={<Button size="sm" onClick={() => navigate('/scan?mode=receipt')}>Scan a receipt</Button>}
      >
        Scan a grocery receipt and we'll check every item against FDA recalls, and keep checking for new ones.
      </EmptyState>
    )
  } else {
    const shown = query.data.filter(
      (scan) => receiptMatchesFilter(scan, filter) && includesQuery(q, scan.store, ...scan.items.map((i) => i.name)),
    )
    body =
      shown.length === 0 ? (
        <EmptyState icon={SearchX} title="No receipts match">
          Try a different store or item name, or another filter.
        </EmptyState>
      ) : (
        <div className="grid md:grid-cols-2 md:gap-x-8">
          {shown.map((scan) => (
            <ReceiptRow key={scan.id} scan={scan} onOpen={() => navigate(scanPath(scan))} />
          ))}
        </div>
      )
  }

  return (
    <>
      <ScreenHeader title="Receipts" back={false} right={<ScanButton label="Scan receipt" to="/scan?mode=receipt" />} />
      <Screen>
        <SearchInput value={q} onChange={setQ} placeholder="Search by store or item" />
        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'All'],
            ['attention', 'Needs attention'],
            ['clear', 'No recalls'],
          ]}
        />
        {body}
      </Screen>
    </>
  )
}

// ---------------------------------------------------------------------------------------------

type ProductSource = 'barcode' | 'receipt'

function ProductRow({ item }: { item: WatchItem }) {
  const navigate = useNavigate()
  const remove = useDeleteProduct()
  const [confirming, setConfirming] = useState(false)

  // Scanned products open their scan result (which lists the matching recalls); receipt items with a
  // match go straight to the recall
  const open = () =>
    navigate(
      item.source === 'receipt' && item.recallNumbers.length > 0
        ? recallPath(item.recallNumbers[0])
        : scanPath({ type: item.source, id: item.scanId }),
    )

  const detail =
    item.source === 'receipt'
      ? [item.store, item.purchaseDate && `Bought ${formatDate(item.purchaseDate)}`].filter(Boolean).join(' · ')
      : item.upc
        ? `UPC ${formatUpc(item.upc)}`
        : ''
  const expiryDate = getExpiryDate(item.id)
  const expired = expiryDate ? isExpired(expiryDate) : false
  const safety = productSafety(item.status, expiryDate)
  return (
    <RowCard onClick={open}>
      {item.source === 'barcode' ? (
        <ProductImage src={item.imageUrl ?? getThumbnail(item.upc) ?? undefined} className="size-12" />
      ) : (
        <IconTile icon={Receipt} />
      )}
      <RowMeta title={productTitle(item)}>
        <span className="block truncate text-xs">{detail || `Added ${formatTimestampDate(item.createdAt)}`}</span>
        {expiryDate && (
          <span className={cn('text-xs', expired ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            {expired ? 'Expired ' : 'Exp '}
            {formatDate(expiryDate)}
          </span>
        )}
      </RowMeta>
      <RowTrailing>
        {confirming ? (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(item.id, {
                  onSuccess: () =>
                    toast(features.alerts ? "Removed. We'll stop checking this item for recalls." : 'Removed from this device.'),
                  onError: () => toast("Couldn't remove this item"),
                })
              }
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {expiryDate ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  safety === 'good'
                    ? 'bg-success-soft text-success'
                    : 'bg-destructive-soft text-destructive',
                )}
              >
                {safety === 'good' ? 'Good' : 'Not good'}
              </span>
            ) : (
              <MatchStatusBadge status={item.status} />
            )}
            <button
              className="-m-1 p-2 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${item.name}`}
              onClick={(e) => {
                e.stopPropagation()
                setConfirming(true)
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </RowTrailing>
    </RowCard>
  )
}

type MainTab = 'products' | 'history'

function RecallHistoryRow({ item, onRemove }: { item: ViewedRecall; onRemove: () => void }) {
  const navigate = useNavigate()
  return (
    <RowCard onClick={() => navigate(recallPath(item.recallNumber))}>
      <HazardTile kind={hazardOf(item.productDescription).kind} className="size-12 shrink-0 rounded-xl" />
      <RowMeta title={item.productDescription}>
        <span className="block truncate text-xs text-muted-foreground">{item.recallingFirm}</span>
        <div className="mt-1 flex flex-wrap gap-1">
          <ClassificationBadge classification={item.classification} />
          <RecallStatusBadge status={item.status} />
        </div>
      </RowMeta>
      <RowTrailing>
        <div className="flex flex-col items-end gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.viewedAt)}</span>
          <button
            className="-m-1 p-2 text-muted-foreground hover:text-foreground"
            aria-label={`Remove from history`}
            onClick={(e) => { e.stopPropagation(); onRemove() }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </RowTrailing>
    </RowCard>
  )
}

function RecallHistoryTab() {
  const [history, setHistory] = useState<ViewedRecall[]>(() => getRecallHistory())

  const remove = (recallNumber: string) => {
    removeRecallView(recallNumber)
    setHistory((prev) => prev.filter((r) => r.recallNumber !== recallNumber))
  }

  const clearAll = () => {
    clearRecallHistory()
    setHistory([])
  }

  if (history.length === 0) {
    return (
      <EmptyState icon={Clock} title="No viewed recalls">
        Open a recall to see it here.
      </EmptyState>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {history.length} {history.length === 1 ? 'recall' : 'recalls'} viewed
        </span>
        <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
      </div>
      <div className="space-y-1">
        {history.map((item) => (
          <RecallHistoryRow key={item.recallNumber} item={item} onRemove={() => remove(item.recallNumber)} />
        ))}
      </div>
    </div>
  )
}

export function ScannedProducts() {
  const navigate = useNavigate()
  const query = useProducts()
  const [mainTab, setMainTab] = useState<MainTab>('products')
  const [source, setSource] = useState<ProductSource>('barcode')
  const [q, setQ] = useState('')

  let productsBody: ReactNode
  if (query.isPending) productsBody = <ListSkeleton />
  else if (query.isError) productsBody = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else {
    const ofSource = query.data.filter((i) => i.source === source)
    const shown = ofSource.filter((i) => includesQuery(q, i.name, i.brand, i.upc))
    if (ofSource.length === 0) {
      productsBody =
        source === 'barcode' ? (
          <EmptyState
            icon={Package}
            title="No scanned products yet"
            action={<Button size="sm" onClick={() => navigate('/scan?mode=product')}>Scan a product</Button>}
          >
            Scan a product's barcode to check it for recalls.{features.alerts && " We'll keep watching it for new ones."}
          </EmptyState>
        ) : (
          <EmptyState icon={Receipt} title="No items from receipts yet">
            Items from the receipts you scan show up here.
          </EmptyState>
        )
    } else if (shown.length === 0) {
      productsBody = <EmptyState icon={SearchX} title="No products match" />
    } else {
      productsBody = (
        <div className="grid md:grid-cols-2 md:gap-x-8">
          {shown.map((item) => (
            <ProductRow key={item.id} item={item} />
          ))}
        </div>
      )
    }
  }

  return (
    <>
      <ScreenHeader title="Products" back={false} right={<ScanButton label="Scan product" to="/scan?mode=product" />} />
      <Screen>
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
          <TabsList className="desktop:max-w-md">
            <TabsTrigger value="products">Scanned</TabsTrigger>
            <TabsTrigger value="history">Viewed Recalls</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            <SearchInput value={q} onChange={setQ} placeholder="Search by name, brand or UPC" />
            {features.receiptScan && (
              <FilterTabs
                value={source}
                onChange={setSource}
                options={[
                  ['barcode', 'Scanned'],
                  ['receipt', 'From receipts'],
                ]}
              />
            )}
            <div className="mt-3">{productsBody}</div>
          </TabsContent>
          <TabsContent value="history">
            <RecallHistoryTab />
          </TabsContent>
        </Tabs>
      </Screen>
    </>
  )
}
