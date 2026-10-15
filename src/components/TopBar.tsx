import { Bell, Search, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useActiveAlerts } from '@/hooks/use-alerts'
import { Logo } from './Logo'

export function TopBar() {
  const navigate = useNavigate()
  const alertCount = useActiveAlerts().data?.length ?? 0
  return (
    <header className="flex items-center justify-between py-2.5 desktop:hidden">
      <Logo />
      <div className="flex">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={alertCount > 0 ? `Alerts (${alertCount} active)` : 'Alerts'}
          onClick={() => navigate('/alerts')}
        >
          <Bell />
          {alertCount > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-destructive" aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Search" onClick={() => navigate('/recalls')}>
          <Search />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Profile" onClick={() => navigate('/profile')}>
          <User />
        </Button>
      </div>
    </header>
  )
}
