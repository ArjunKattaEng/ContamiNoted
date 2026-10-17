import { useState, type ReactNode } from 'react'
import { Package, Receipt, ScanBarcode, ScanLine, SearchX, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RowCard, RowMeta, RowTrailing } from '@/components/RowCard'
import { IconTile, ReceiptRow } from '@/components/ScanRows'
import { MatchStatusBadge } from '@/components/ScanStatus'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SearchInput } from '@/components/SearchInput'
import { EmptyState, ErrorState } from '@/components/StateViews'
import { useDeleteProduct, useProducts } from '@/hooks/use-products'
import { useScanHistory } from '@/hooks/use-scans'
import { formatUpc } from '@/lib/barcode'
import { features } from '@/lib/features'
import { formatDate, formatTimestampDate } from '@/lib/format'
import { recallPath } from '@/lib/recall'
import { overallStatus, productTitle, scanPath } from '@/lib/scan'
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
        Scan a grocery receipt and we’ll check every item against FDA recalls, and keep checking for new ones.
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
        <div className="grid gap-3 md:grid-cols-2">
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
  return (
    <RowCard onClick={open}>
      <IconTile icon={item.source === 'barcode' ? ScanBarcode : Receipt} />
      <RowMeta title={productTitle(item)}>
        <span className="block truncate text-xs">{detail || `Added ${formatTimestampDate(item.createdAt)}`}</span>
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
                    toast(features.alerts ? 'Removed. We’ll stop checking this item for recalls.' : 'Removed from this device.'),
                  onError: () => toast('Couldn’t remove this item'),
                })
              }
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <MatchStatusBadge status={item.status} />
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

export function ScannedProducts() {
  const navigate = useNavigate()
  const query = useProducts()
  const [source, setSource] = useState<ProductSource>('barcode')
  const [q, setQ] = useState('')

  let body: ReactNode
  if (query.isPending) body = <ListSkeleton />
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else {
    const ofSource = query.data.filter((i) => i.source === source)
    const shown = ofSource.filter((i) => includesQuery(q, i.name, i.brand, i.upc))
    if (ofSource.length === 0) {
      body =
        source === 'barcode' ? (
          <EmptyState
            icon={Package}
            title="No scanned products yet"
            action={<Button size="sm" onClick={() => navigate('/scan?mode=product')}>Scan a product</Button>}
          >
            Scan a product’s barcode to check it for recalls.{features.alerts && ' We’ll keep watching it for new ones.'}
          </EmptyState>
        ) : (
          <EmptyState icon={Receipt} title="No items from receipts yet">
            Items from the receipts you scan show up here.
          </EmptyState>
        )
    } else if (shown.length === 0) {
      body = <EmptyState icon={SearchX} title="No products match" />
    } else {
      body = (
        <div className="grid gap-3 md:grid-cols-2">
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
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, brand or UPC" />
        {features.receiptScan ? (
          <FilterTabs
            value={source}
            onChange={setSource}
            options={[
              ['barcode', 'Scanned'],
              ['receipt', 'From receipts'],
            ]}
          />
        ) : (
          <div className="h-3" aria-hidden />
        )}
        {body}
      </Screen>
    </>
  )
}
