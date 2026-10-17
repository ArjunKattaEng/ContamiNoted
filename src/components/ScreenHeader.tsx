import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useGoBack } from '@/hooks/use-go-back'
import { cn } from '@/lib/utils'
import { pageColumn } from './Screen'

interface ScreenHeaderProps {
  title: string
  right?: ReactNode
  /** Back button on phones/tablets. Off for tab screens, which are reached from the tab bar. */
  back?: boolean
  /**
   * Show the back button on desktop too. Off by default: desktop pages reached from the sidebar
   * don't need one; detail pages (recall, scan result, settings) do.
   */
  backOnDesktop?: boolean
  /** Where Back goes when there's no in-app history (the page was opened from a link). Default: browser back. */
  backTo?: string
}

/** Phone/tablet: centered title bar with a back button. Desktop: large left-aligned page title. */
export function ScreenHeader({ title, right, back = true, backOnDesktop = false, backTo }: ScreenHeaderProps) {
  const navigate = useNavigate()
  const goBack = useGoBack(backTo ?? '/home')
  useDocumentTitle(title)
  return (
    <header className="flex-none border-b bg-card pb-3 pt-[calc(12px+var(--safe-top))] desktop:border-b-0 desktop:bg-transparent desktop:pb-0 desktop:pt-8">
      <div className={cn(pageColumn, 'grid grid-cols-[44px_1fr_44px] items-center px-2 md:px-4 desktop:flex desktop:gap-2 desktop:px-10')}>
        {back ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => (backTo ? goBack() : navigate(-1))}
            className={cn(backOnDesktop ? 'desktop:-ml-3' : 'desktop:hidden')}
          >
            <ChevronLeft className="!size-7" />
          </Button>
        ) : (
          <span className="desktop:hidden" />
        )}
        <h1 className="m-0 text-center text-[17px] font-bold desktop:flex-1 desktop:text-left desktop:text-2xl">{title}</h1>
        <div className="flex justify-end">{right}</div>
      </div>
    </header>
  )
}
