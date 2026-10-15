import * as React from 'react'

import { cn } from '@/lib/utils'

/** Styled native <select>: keeps the iOS wheel picker instead of a custom popover. */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 min-w-0 flex-1 rounded-md border-[1.5px] border-input bg-card px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  ),
)
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
