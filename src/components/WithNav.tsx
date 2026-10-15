import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { PageLoader } from './PageLoader'

/** Layout for tab screens: the page plus the bottom tab bar (phones/tablets only). */
export function WithNav() {
  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </>
  )
}
