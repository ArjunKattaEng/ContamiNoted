import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const bannerClass = 'mb-3 mt-1 flex items-center gap-2 rounded-lg border p-3.5 font-bold'

/** Home banner: count of the user's active recall matches, or an all-clear state. */
export function AlertBanner({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className={cn(bannerClass, 'border-success/30 bg-success-soft text-success')}>
        <ShieldCheck className="size-5" aria-hidden />
        No recalls match your items
      </div>
    )
  }
  return (
    <Link to="/alerts" className={cn(bannerClass, 'border-primary bg-primary text-primary-foreground')}>
      <TriangleAlert className="size-5" aria-hidden />
      {count === 1 ? '1 active alert' : `${count} active alerts`} for your items
    </Link>
  )
}
