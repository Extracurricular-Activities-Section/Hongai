import * as React from 'react'

import { cn } from '@/lib/utils'

export type TimelineTone = 'default' | 'current' | 'muted' | 'positive' | 'critical'

export interface TimelineEntry {
  id: string
  title: React.ReactNode
  meta?: React.ReactNode
  body?: React.ReactNode
  tone?: TimelineTone
}

const dotTone: Record<TimelineTone, string> = {
  default: 'bg-border-strong',
  current: 'bg-accent ring-4 ring-accent-soft',
  muted: 'bg-border',
  positive: 'bg-success',
  critical: 'bg-danger',
}

/** Vertical thread used for funding revisions and case history. */
export function Timeline({
  entries,
  className,
}: {
  entries: TimelineEntry[]
  className?: string
}) {
  return (
    <ol className={cn('relative space-y-5 pl-5', className)}>
      <span
        aria-hidden
        className="absolute left-[3px] top-1.5 bottom-1.5 w-px bg-border"
      />
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            aria-hidden
            className={cn(
              'absolute -left-5 top-1.5 size-[7px] rounded-pill',
              dotTone[entry.tone ?? 'default'],
            )}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p
              className={cn(
                'text-sm font-medium',
                entry.tone === 'muted' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {entry.title}
            </p>
            {entry.meta ? (
              <p className="text-meta text-muted-foreground">{entry.meta}</p>
            ) : null}
          </div>
          {entry.body ? (
            <div className="mt-1 text-sm text-subtle">{entry.body}</div>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
