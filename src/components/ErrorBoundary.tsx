import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface State {
  error: Error | null
}

/**
 * Last-resort fallback for render crashes, including a lazily loaded screen that fails to download
 * (e.g. an old tab after a new deploy), so the app never shows a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ContamiNoted crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
        <CircleAlert className="size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <strong>Something went wrong</strong>
        <p className="max-w-sm text-sm text-muted-foreground">Reloading usually fixes this. Your scans and alerts are safe.</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.location.assign('/home')}>
            Go home
          </Button>
        </div>
      </div>
    )
  }
}
