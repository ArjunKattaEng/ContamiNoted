import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useRecheckOnOpen } from '@/hooks/use-recheck-on-open'
import { PageLoader } from './PageLoader'
import { Sidebar } from './Sidebar'

/** Layout for every in-app screen: desktop sidebar + the page. Also re-checks saved items on open/resume. */
export function AppShell() {
  useRecheckOnOpen()
  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
