import { Loader2 } from 'lucide-react'

/** Suspense fallback while a lazily loaded screen downloads. */
export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}
