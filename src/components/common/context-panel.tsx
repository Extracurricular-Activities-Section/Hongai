import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Right-hand rail of a detail workspace: progress, key figures, ownership and
 * the state-appropriate actions. Sticks alongside the main column on desktop.
 */
export function ContextPanel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <aside
      aria-label="案件摘要"
      className={cn(
        'space-y-4 lg:sticky lg:top-6 lg:self-start',
        className,
      )}
    >
      {children}
    </aside>
  )
}

export function ContextCard({
  title,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card', className)}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Label / value pair with consistent vertical lanes. */
export function ContextRow({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  emphasis?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5', className)}>
      <dt className="shrink-0 text-meta text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right',
          emphasis ? 'text-section font-semibold text-foreground tabular' : 'text-sm text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
