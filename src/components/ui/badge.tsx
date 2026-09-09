import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-0.5 text-meta font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-subtle',
        outline: 'border-border-strong bg-surface text-foreground',
        progress: 'border-info-border bg-info-soft text-info',
        attention: 'border-warning-border bg-warning-soft text-warning',
        positive: 'border-success-border bg-success-soft text-success',
        critical: 'border-danger-border bg-danger-soft text-danger',
        brand: 'border-transparent bg-accent text-accent-foreground',
        ink: 'border-transparent bg-ink text-ink-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/** Small colour dot used inside dense rows where a full badge would be noisy. */
function Dot({ tone = 'neutral', className }: { tone?: BadgeTone; className?: string }) {
  const toneClass: Record<BadgeTone, string> = {
    neutral: 'bg-border-strong',
    outline: 'bg-border-strong',
    progress: 'bg-info',
    attention: 'bg-warning',
    positive: 'bg-success',
    critical: 'bg-danger',
    brand: 'bg-accent-strong',
    ink: 'bg-ink',
  }
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', toneClass[tone], className)} />
}

export { Badge, Dot, badgeVariants }
