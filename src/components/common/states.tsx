import { AlertTriangle, RotateCcw, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonList } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Empty state: what this area is for, and the one action that fills it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-card text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 inline-flex size-11 items-center justify-center rounded-pill bg-surface-muted text-subtle">
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="text-card font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-subtle">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/** Error state with a retry affordance. Announced to assistive tech. */
export function ErrorState({
  title = '載入失敗',
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: React.ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-danger-border bg-danger-soft px-5 py-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-danger">{title}</p>
        {message ? <p className="mt-0.5 text-sm text-danger/90">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw />
          重試
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Default in-page loading placeholder: a title bar plus a few content rows.
 * Keeps the layout from collapsing while a route's first request resolves.
 */
export function PageSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="載入中" className={cn('space-y-6', className)}>
      <Skeleton className="h-9 w-56" />
      <SkeletonList rows={rows} />
      <span className="sr-only">載入中</span>
    </div>
  )
}

/** Full-viewport wait state used while an auth session is being restored. */
export function PageLoader({ label = '載入中' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background"
    >
      <span
        aria-hidden
        className="size-6 animate-spin rounded-pill border-2 border-border-strong border-t-foreground"
      />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

/** Inline notice for non-blocking information inside a page. */
export function InlineNotice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'attention' | 'positive'
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const toneClass = {
    info: 'border-info-border bg-info-soft text-info',
    attention: 'border-warning-border bg-warning-soft text-warning',
    positive: 'border-success-border bg-success-soft text-success',
  }[tone]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
        toneClass,
        className,
      )}
    >
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div> : null}
      </div>
      {action}
    </div>
  )
}
