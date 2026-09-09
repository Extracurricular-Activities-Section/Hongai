import { cn } from '@/lib/utils'

function format(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(Number(value))) return null
  return new Intl.NumberFormat('zh-TW').format(Number(value))
}

/**
 * Money is always rendered through this component so the currency prefix,
 * tabular figures and the em-dash fallback stay identical everywhere.
 */
export function AmountDisplay({
  value,
  size = 'default',
  muted = false,
  className,
}: {
  value: number | null | undefined
  size?: 'default' | 'lg' | 'sm'
  muted?: boolean
  className?: string
}) {
  const formatted = format(value)

  if (formatted == null) {
    return <span className={cn('text-muted-foreground', className)}>—</span>
  }

  return (
    <span
      className={cn(
        'tabular whitespace-nowrap',
        size === 'lg' && 'text-metric font-semibold',
        size === 'default' && 'text-sm font-medium',
        size === 'sm' && 'text-meta',
        muted ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
    >
      <span className={cn('font-normal', size === 'lg' ? 'mr-1.5 text-base' : 'mr-1 text-[0.85em]')}>
        NT$
      </span>
      {formatted}
    </span>
  )
}
