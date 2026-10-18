import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RowCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  /** `row` (default): a list row with a hairline under it, as in Yuka. `box`: a standalone bordered box. */
  variant?: 'row' | 'box'
}

/**
 * Horizontal list card: leading media, meta, trailing content.
 * Clickable cards are a div with role="button" (not <button>) so they can contain their own buttons.
 */
export function RowCard({ children, className, onClick, variant = 'row' }: RowCardProps) {
  const onKeyDown = (e: KeyboardEvent) => {
    // Only the card itself: Enter on a button inside it (star, delete) must not open the card
    if (onClick && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick()
    }
  }
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? onKeyDown : undefined}
      className={cn(
        'flex items-center gap-3 bg-card text-card-foreground',
        variant === 'row' ? 'border-b py-3.5' : 'rounded-lg border p-3.5',
        onClick && 'cursor-pointer transition-colors hover:bg-accent/60 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Rows in one column, or two from tablet width up (`grid`). */
export function RowList({ children, grid = false }: { children: ReactNode; grid?: boolean }) {
  return <div className={cn('grid', grid && 'md:grid-cols-2 md:gap-x-8')}>{children}</div>
}

export function RowMeta({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <strong className="block">{title}</strong>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export function RowTrailing({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-end gap-1 text-right text-xs">{children}</div>
}
