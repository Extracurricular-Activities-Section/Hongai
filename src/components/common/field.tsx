import * as React from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Label / control / help / error in one predictable stack, so every form in
 * the product has the same rhythm and the same error placement.
 *
 * Pass the same `id` to the control you render as a child.
 */
export function Field({
  id,
  label,
  description,
  error,
  required = false,
  hint,
  className,
  children,
}: {
  id: string
  label: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  /** Right-aligned helper such as a character count. */
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const describedBy =
    [description ? `${id}-description` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="ml-1 text-danger" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only">（必填）</span> : null}
        </Label>
        {hint ? <span className="text-meta text-muted-foreground">{hint}</span> : null}
      </div>

      {description ? (
        <p id={`${id}-description`} className="text-meta leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}

      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>

      {error ? (
        <p id={`${id}-error`} className="text-meta font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

/** Wire a control to its surrounding `Field` without repeating aria plumbing. */
export function useFieldProps() {
  const context = React.useContext(FieldContext)
  if (!context) return {}
  return {
    id: context.id,
    'aria-describedby': context.describedBy,
    'aria-invalid': context.invalid || undefined,
  }
}
