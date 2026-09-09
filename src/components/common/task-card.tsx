import { CalendarClock, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * One card shape for every follow-up task, student side and staff side.
 * The whole card is the link so the hit target matches what people aim at.
 */
export function TaskCard({
  to,
  title,
  statusLabel,
  statusTone = 'neutral',
  typeLabel,
  dueLabel,
  overdue = false,
  required = false,
  owner,
  className,
}: {
  to: string
  title: React.ReactNode
  statusLabel: string
  statusTone?: BadgeTone
  typeLabel?: string
  dueLabel?: string | null
  overdue?: boolean
  required?: boolean
  /** Staff view: who the task belongs to. */
  owner?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-muted/60',
        overdue && 'border-l-2 border-l-danger',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          {required ? (
            <span className="text-meta text-muted-foreground">必繳</span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
          {owner ? <span className="truncate">{owner}</span> : null}
          {typeLabel ? <span>{typeLabel}</span> : null}
          {dueLabel ? (
            <span className={cn('inline-flex items-center gap-1', overdue && 'text-danger')}>
              <CalendarClock className="size-3.5" aria-hidden />
              {overdue ? '已逾期 · ' : '截止 '}
              {dueLabel}
            </span>
          ) : null}
        </div>
      </div>
      <Badge tone={statusTone} className="shrink-0">
        {statusLabel}
      </Badge>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  )
}

/**
 * Compact "needs your attention" row used on dashboards and the student home.
 */
export function AttentionRow({
  to,
  title,
  detail,
  badge,
  className,
}: {
  to: string
  title: React.ReactNode
  detail?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-muted/70',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-meta text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      {badge}
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  )
}
