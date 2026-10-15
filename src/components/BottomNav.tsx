import { House, Package, Receipt, User, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/receipts', label: 'Receipts', icon: Receipt },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  return (
    <nav className="flex flex-none border-t bg-card pb-safe-bottom desktop:hidden">
      {navItems.map(({ to, label, icon: Icon }) => (
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
