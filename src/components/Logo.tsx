import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 font-bold', large && 'flex-col gap-3 text-[26px]')}>
      <span
        className={cn(
          'inline-grid place-items-center rounded-md bg-primary text-primary-foreground',
          large ? 'size-[72px] rounded-[18px]' : 'size-[26px]',
        )}
      >
        <ShieldCheck className={large ? 'size-10' : 'size-4'} aria-hidden />
      </span>
      <span>ContamiNoted</span>
    </div>
  )
}
