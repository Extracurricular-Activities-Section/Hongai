import * as React from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export type MetricTone = 'default' | 'attention' | 'critical' | 'positive'

const toneRing: Record<MetricTone, string> = {
  default: '',
  attention: 'before:bg-warning',
  critical: 'before:bg-danger',
  positive: 'before:bg-success',
}

/**
 * Large-number + label. Tone is carried by a small marker next to the label,
 * never by tinting the whole card — a grid of differently coloured cards is
 * the pattern this replaces.
 */
export function Metric({
  label,
  value,
  hint,
  to,
  tone = 'default',
  emphasis = false,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  to?: string
  tone?: MetricTone
  /** Uses the ink surface — reserve for the single most important number. */
  emphasis?: boolean
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        {tone !== 'default' ? (
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-pill',
              tone === 'attention' && 'bg-warning',
              tone === 'critical' && 'bg-danger',
              tone === 'positive' && 'bg-success',
            )}
          />
        ) : null}
        <span
          className={cn(
            'text-meta font-medium',
            emphasis ? 'text-ink-subtle' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          'mt-3 text-metric font-semibold tabular',
          emphasis ? 'text-ink-foreground' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn('mt-1.5 text-meta', emphasis ? 'text-ink-subtle' : 'text-muted-foreground')}>
          {hint}
        </p>
      ) : null}
    </>
  )

  const shell = cn(
    'block rounded-lg border p-5 text-left transition-colors',
    emphasis
      ? 'border-transparent bg-ink'
      : 'border-border bg-card hover:border-border-strong',
    toneRing[tone],
    className,
  )

  if (to) {
    return (
      <Link to={to} className={cn(shell, emphasis ? 'on-ink' : undefined)}>
        {body}
      </Link>
    )
  }

  return <div className={cn(shell, emphasis ? 'on-ink' : undefined)}>{body}</div>
}

export function MetricRow({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>
  )
}
