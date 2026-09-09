import * as React from 'react'

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-sunken', className)}
      {...props}
    />
  )
}

/** Placeholder for a stack of cards or list rows. */
function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="載入中">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
      <span className="sr-only">載入中</span>
    </div>
  )
}

/** Placeholder matching the density of an admin data table. */
function SkeletonTable({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}
      role="status"
      aria-label="載入中"
    >
      <div className="border-b border-border bg-surface-muted px-4 py-3">
        <Skeleton className="h-3.5 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="ml-auto h-3.5 w-20" />
        </div>
      ))}
      <span className="sr-only">載入中</span>
    </div>
  )
}

/** Placeholder for the metric row on dashboards. */
function SkeletonMetrics({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}
      role="status"
      aria-label="載入中"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-16" />
        </div>
      ))}
      <span className="sr-only">載入中</span>
    </div>
  )
}

export { Skeleton, SkeletonList, SkeletonTable, SkeletonMetrics }
