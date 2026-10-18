import { House, Package, Receipt, ScanBarcode, ShieldAlert, User, type LucideIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { canScan, features } from '@/lib/features'
import { cn } from '@/lib/utils'

// Sections whose feature isn't built yet stay out of the tab bar (src/lib/features.ts)
const navItems: { to: string; label: string; icon: LucideIcon; show: boolean }[] = [
  { to: '/home', label: 'Home', icon: House, show: true },
  { to: '/recalls', label: 'Recalls', icon: ShieldAlert, show: true },
  { to: '/receipts', label: 'Receipts', icon: Receipt, show: features.history && features.receiptScan },
  { to: '/products', label: 'Products', icon: Package, show: features.history },
  { to: '/profile', label: 'Profile', icon: User, show: true },
]

const shown = navItems.filter((n) => n.show)

/** The scanner sits in the middle of the tab bar as a raised green button, as in Yuka. It opens the camera. */
function ScanTab() {
  return (
    <Link to="/scan" className="flex flex-1 flex-col items-center gap-0.5 pb-2 text-[11px] font-semibold text-primary">
      <span className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-card">
        <ScanBarcode className="size-6" aria-hidden />
      </span>
      Scan
    </Link>
  )
}

export function BottomNav() {
  const half = Math.ceil(shown.length / 2)
  const tab = ({ to, label, icon: Icon }: (typeof navItems)[number]) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-muted-foreground', isActive && 'font-semibold text-primary')
      }
    >
      <Icon className="size-5" aria-hidden />
      <small className="text-[11px]">{label}</small>
    </NavLink>
  )
  return (
    <nav className="relative z-10 flex flex-none items-end border-t bg-card pb-safe-bottom desktop:hidden">
      {shown.slice(0, half).map(tab)}
      {canScan && <ScanTab />}
      {shown.slice(half).map(tab)}
    </nav>
  )
}
