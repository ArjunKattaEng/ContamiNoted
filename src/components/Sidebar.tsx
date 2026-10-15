import { Bell, House, Package, Receipt, ScanLine, ShieldAlert, User, type LucideIcon } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useActiveAlerts } from '@/hooks/use-alerts'
import { canScan, features } from '@/lib/features'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

// Sections whose feature isn't built yet stay out of the sidebar (src/lib/features.ts)
const navItems: { to: string; label: string; icon: LucideIcon; show: boolean }[] = [
  { to: '/home', label: 'Home', icon: House, show: true },
  { to: '/alerts', label: 'Alerts', icon: Bell, show: features.alerts },
  { to: '/recalls', label: 'Recalls', icon: ShieldAlert, show: true },
  { to: '/receipts', label: 'Receipts', icon: Receipt, show: features.history },
  { to: '/products', label: 'Products', icon: Package, show: features.history },
  { to: '/profile', label: 'Profile', icon: User, show: true },
]

/** Desktop navigation. Hidden on phones/tablets, which use BottomNav. */
export function Sidebar() {
  const navigate = useNavigate()
  const alertCount = useActiveAlerts().data?.length ?? 0
  return (
    <aside className="hidden w-60 flex-none flex-col border-r bg-card px-4 py-6 desktop:flex">
      <div className="px-2">
        <Logo />
      </div>
      {canScan && (
        <Button className="mt-6" onClick={() => navigate('/scan')}>
          <ScanLine /> Scan
        </Button>
      )}
      <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
        {navItems
          .filter((n) => n.show)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent font-bold text-foreground',
                )
              }
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
              {to === '/alerts' && alertCount > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                  {alertCount}
                  <span className="sr-only"> active</span>
                </span>
              )}
            </NavLink>
          ))}
      </nav>
      <p className="mt-auto px-2 text-xs text-muted-foreground">Recall data: openFDA food enforcement.</p>
    </aside>
  )
}
