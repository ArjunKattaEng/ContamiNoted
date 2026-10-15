import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function MenuRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex items-center justify-between border-b px-1 py-4">
      {children}
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  )
}
