import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'

/**
 * Shell for the dense admin tables: one horizontal scroller, a sticky header
 * and consistent row padding. Rows navigate on click *and* keep a real link
 * inside so keyboard and middle-click still work.
 */
export function DataTable({
  caption,
  head,
  className,
  children,
  minWidth = '60rem',
}: {
  caption: string
  head: React.ReactNode
  className?: string
  children: React.ReactNode
  minWidth?: string
}) {
  return (
    <div className={cn('scrollbar-thin overflow-x-auto rounded-lg border border-border bg-card', className)}>
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Th({
  className,
  align = 'left',
  ...props
}: React.ComponentProps<'th'> & { align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-meta font-medium text-muted-foreground',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  align = 'left',
  ...props
}: React.ComponentProps<'td'> & { align?: 'left' | 'right' }) {
  return (
    <td
      className={cn('px-4 py-3 align-middle', align === 'right' && 'text-right', className)}
      {...props}
    />
  )
}

/** Row that behaves like a link without nesting interactive elements. */
export function LinkRow({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <tr
      onClick={() => navigate(to)}
      className={cn(
        'cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-muted/70 focus-within:bg-surface-muted/70',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  className?: string
}) {
  return (
    <nav
      aria-label="分頁"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <p className="text-meta text-muted-foreground">
        共 <span className="tabular text-foreground">{totalItems}</span> 筆 · 第 {page} /{' '}
        {totalPages} 頁
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-9 rounded-pill border border-border-strong bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40"
        >
          上一頁
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-9 rounded-pill border border-border-strong bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40"
        >
          下一頁
        </button>
      </div>
    </nav>
  )
}
