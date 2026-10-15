import { forwardRef, useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormFieldProps extends ComponentProps<'input'> {
  label: string
  error?: string
}

/** Labeled input with an inline validation message (use with react-hook-form's register). */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({ label, error, className, ...props }, ref) => {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={cn(error && 'border-destructive', className)}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
})
FormField.displayName = 'FormField'
