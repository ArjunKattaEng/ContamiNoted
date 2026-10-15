import type { ReactNode } from 'react'
import { CircleAlert, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/services/errors'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Icon className="mb-3 size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <strong>{title}</strong>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Error with the service's message (ApiError) and an optional retry. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Something went wrong"
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {isApiError(error) ? error.message : 'Please check your connection and try again.'}
    </EmptyState>
  )
}
