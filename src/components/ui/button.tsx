import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-[1.5px] border-primary bg-primary text-[13px] uppercase tracking-[.04em] text-primary-foreground hover:bg-primary/90',
        secondary: 'border-[1.5px] border-primary bg-card text-[13px] uppercase tracking-[.04em] text-primary hover:bg-accent',
        destructive: 'border-[1.5px] border-destructive bg-destructive text-[13px] uppercase tracking-[.04em] text-destructive-foreground hover:bg-destructive/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        /** Third-party sign-in (Google): a plain light button, as the provider's branding guidelines ask */
        social: 'border border-[#747775] bg-white text-[14px] font-medium text-[#1f1f1f] hover:bg-[#f2f2f2]',
      },
      size: {
        default: 'h-12 w-full px-4',
        sm: 'h-9 px-3.5',
        icon: 'h-11 w-11 text-lg [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
