import { Bell, House, Package, Receipt, ScanLine, ShieldAlert, User, type LucideIcon } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useActiveAlerts } from '@/hooks/use-alerts'
import { isLive } from '@/services'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/recalls', label: 'Recalls', icon: ShieldAlert },
  { to: '/receipts', label: 'Receipts', icon: Receipt },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/profile', label: 'Profile', icon: User },
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
      <Button className="mt-6" onClick={() => navigate('/scan')}>
        <ScanLine /> Scan
      </Button>
      <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
        {navItems.map(({ to, label, icon: Icon }) => (
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
      <p className="mt-auto px-2 text-xs text-muted-foreground">
        {isLive('recalls') ? 'Recall data: openFDA food enforcement.' : 'Demo data: recalls are fictional.'}
      </p>
    </aside>
  )
}
