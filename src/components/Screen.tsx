import type { ReactNode } from 'react'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/utils'

/**
 * Content column shared by headers and page bodies: full width on phones, a readable column on
 * tablets, wide on desktop. Keep ScreenHeader and Screen aligned by using this for both.
 */
export const pageColumn = 'mx-auto w-full max-w-3xl px-4 md:px-6 desktop:max-w-6xl desktop:px-10'

interface ScreenProps {
  children: ReactNode
  className?: string
  /** Center content (splash, walkthrough). */
  center?: boolean
  /** Pad below the status bar, for pages without a ScreenHeader. */
  insetTop?: boolean
  /** Narrow centered column on tablet/desktop (onboarding, auth forms). */
  narrow?: boolean
}

/** Scrollable page body. Pages are an optional ScreenHeader followed by a Screen. */
export function Screen({ children, className, center, insetTop, narrow }: ScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className={cn(
          pageColumn,
          'flex flex-1 flex-col pb-[calc(16px+var(--safe-bottom))] pt-4 desktop:pb-10',
          insetTop && 'pt-[calc(16px+var(--safe-top))] desktop:pt-8',
          narrow && 'md:max-w-md desktop:max-w-md',
          center && 'items-center justify-center text-center',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Section heading (sentence case, as in iOS lists). */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('mb-2.5 mt-6 text-[17px] font-bold text-foreground', className)}>
      {children}
    </h2>
  )
}

/** Large centered page title (auth, profile). Also sets the browser tab title. */
export function PageTitle({ children }: { children: string }) {
  useDocumentTitle(children)
  return <h1 className="mb-4 mt-6 text-center text-[22px] font-bold desktop:mt-0 desktop:text-left desktop:text-2xl">{children}</h1>
}
