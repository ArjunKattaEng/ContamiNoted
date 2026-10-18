import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/** A status as a colored dot and a label (Yuka style) rather than a filled pill. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground/80 before:size-2.5 before:flex-none before:rounded-full before:content-[''] [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'before:bg-primary',
        alert: 'before:bg-destructive',
        safe: 'before:bg-success',
        warn: 'before:bg-caution',
        outline: 'text-muted-foreground before:bg-muted-foreground/40',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
