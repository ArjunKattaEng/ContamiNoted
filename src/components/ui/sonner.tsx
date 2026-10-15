import { Toaster as Sonner, toast } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/** Dark pill toasts, raised enough to clear bottom action bars and the tab bar. */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    offset="calc(88px + var(--safe-bottom))"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          'group toast group-[.toaster]:rounded-full group-[.toaster]:border-0 group-[.toaster]:bg-primary group-[.toaster]:px-4 group-[.toaster]:py-2.5 group-[.toaster]:text-[13px] group-[.toaster]:text-primary-foreground group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-primary-foreground/80',
        actionButton: 'group-[.toast]:bg-primary-foreground group-[.toast]:text-primary',
        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
      },
    }}
    {...props}
  />
)

export { Toaster, toast }
