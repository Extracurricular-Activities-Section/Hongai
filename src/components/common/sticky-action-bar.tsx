import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Bottom action bar for long forms. Stays reachable without scrolling back,
 * and keeps the "back" and "advance" actions on opposite ends.
 */
export function StickyActionBar({
  start,
  end,
  status,
  className,
}: {
  start?: React.ReactNode
  end?: React.ReactNode
  /** Autosave / validation status shown between the two action groups. */
  status?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">{start}</div>
        {status ? <div className="order-last w-full sm:order-none sm:w-auto">{status}</div> : null}
        <div className="flex items-center gap-2">{end}</div>
      </div>
    </div>
  )
}
