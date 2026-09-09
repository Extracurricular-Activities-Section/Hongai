import * as React from 'react'

import { cn } from '@/lib/utils'

export const fieldClassName =
  'h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40'

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<'input'> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      type={type}
      className={cn(
        fieldClassName,
        'file:mr-3 file:h-8 file:rounded-pill file:border-0 file:bg-surface-muted file:px-3 file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function Textarea({
  className,
  ...props
}: React.ComponentProps<'textarea'> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cn(fieldClassName, 'min-h-24 resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  )
}

function Select({
  className,
  ...props
}: React.ComponentProps<'select'> & { ref?: React.Ref<HTMLSelectElement> }) {
  return <select className={cn(fieldClassName, 'pr-8', className)} {...props} />
}

export { Input, Textarea, Select }
