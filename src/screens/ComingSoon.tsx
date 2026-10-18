import type { ReactNode } from 'react'
import { Bell, Package, Receipt, ScanBarcode, ShieldAlert, UserRound, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Screen } from '@/components/Screen'
import { ScreenHeader } from '@/components/ScreenHeader'

export type UpcomingFeature = 'scan' | 'receipts' | 'products' | 'alerts' | 'accounts'

const copy: Record<UpcomingFeature, { title: string; icon: LucideIcon; text: string }> = {
  scan: {
    title: 'Scanning',
    icon: ScanBarcode,
    text: 'Soon you’ll scan a product’s barcode or a grocery receipt and we’ll check every item against FDA recalls.',
  },
  receipts: {
    title: 'Receipts',
    icon: Receipt,
    text: 'Your scanned receipts will be listed here, with any items that match a recall.',
  },
  products: {
    title: 'Products',
    icon: Package,
    text: 'Products you scan will be listed here, and we’ll keep checking them for new recalls.',
  },
  alerts: {
    title: 'Alerts',
    icon: Bell,
    text: 'You’ll be alerted here when a recall matches something you’ve scanned, including recalls announced after you bought it.',
  },
  accounts: {
    title: 'Accounts',
    icon: UserRound,
    text: 'Accounts are coming soon. For now, recalls you save are kept on this device.',
  },
}

/** Placeholder for a feature whose backend isn't built yet (src/lib/features.ts). */
export function ComingSoon({ feature }: { feature: UpcomingFeature }) {
  const navigate = useNavigate()
  const { title, icon: Icon, text } = copy[feature]
  return (
    <>
      <ScreenHeader title={title} backOnDesktop />
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <Icon className="mb-4 size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <span className="mb-2 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
            Coming soon
          </span>
          <p className="max-w-sm text-muted-foreground">{text}</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Meanwhile, you can browse and search live FDA food recalls.</p>
          <Button className="mt-6 w-auto px-6" onClick={() => navigate('/recalls')}>
            <ShieldAlert /> Browse recalls
          </Button>
        </div>
      </Screen>
    </>
  )
}

/** Render `children` when the feature is available, otherwise its "Coming soon" screen. */
export function FeatureGate({ on, feature, children }: { on: boolean; feature: UpcomingFeature; children: ReactNode }) {
  return on ? <>{children}</> : <ComingSoon feature={feature} />
}
