import { useId } from 'react'
import { Switch } from '@/components/ui/switch'
import { tap } from '@/lib/native'

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Label + optional description + switch. The description is announced as a hint, not part of the name. */
export function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  return (
    <div className="flex items-center justify-between gap-3 border-b px-1 py-3.5">
      <div className="flex-1">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {description && (
          <small id={descriptionId} className="mt-0.5 block text-muted-foreground">
            {description}
          </small>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        onCheckedChange={(v) => {
          tap()
          onChange(v)
        }}
      />
    </div>
  )
}
