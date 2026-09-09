import { ChevronLeft } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

/**
 * One page-title treatment for the whole product. `actions` sits on the right
 * on desktop and wraps underneath on small screens.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  backTo,
  backLabel = '返回',
  actions,
  meta,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  backTo?: string
  backLabel?: string
  actions?: React.ReactNode
  /** Badges or status chips rendered inline after the title. */
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 flex-1">
        {backTo ? (
          <Link
            to={backTo}
            className="mb-2 inline-flex items-center gap-1 rounded-sm text-meta font-medium text-subtle transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? <p className="mb-1 text-meta text-muted-foreground">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-page font-semibold text-foreground">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-subtle">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Section-level heading used inside a page, above a card group or table. */
export function SectionHeader({
  title,
  description,
  actions,
  count,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  count?: number | null
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-section font-semibold text-foreground">{title}</h2>
          {count != null ? (
            <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-meta text-subtle tabular">
              {count}
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-1 text-sm text-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
