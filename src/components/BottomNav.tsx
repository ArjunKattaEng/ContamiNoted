import { House, Package, Receipt, ShieldAlert, User, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { features } from '@/lib/features'
import { cn } from '@/lib/utils'

// Sections whose feature isn't built yet stay out of the tab bar (src/lib/features.ts)
const navItems: { to: string; label: string; icon: LucideIcon; show: boolean }[] = [
  { to: '/home', label: 'Home', icon: House, show: true },
  { to: '/recalls', label: 'Recalls', icon: ShieldAlert, show: true },
  { to: '/receipts', label: 'Receipts', icon: Receipt, show: features.history && features.receiptScan },
  { to: '/products', label: 'Products', icon: Package, show: features.history },
  { to: '/profile', label: 'Profile', icon: User, show: true },
]

export function BottomNav() {
  return (
    <nav className="flex flex-none border-t bg-card pb-safe-bottom desktop:hidden">
      {navItems
        .filter((n) => n.show)
        .map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-muted-foreground', isActive && 'font-bold text-foreground')
            }
          >
            <Icon className="size-5" aria-hidden />
            <small className="text-[10px]">{label}</small>
          </NavLink>
        ))}
    </nav>
  )
}
