import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Shape system: pill = action, rounded-md = field, rounded-lg/xl = container.
 * `brand` is the lime hero action — at most one per view.
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium transition-[background-color,border-color,color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-ink-muted',
        brand: 'bg-accent text-accent-foreground hover:bg-accent-hover',
        secondary: 'bg-surface-muted text-foreground hover:bg-surface-sunken',
        outline:
          'border border-border-strong bg-surface text-foreground hover:border-foreground/25 hover:bg-surface-muted',
        ghost: 'text-subtle hover:bg-surface-muted hover:text-foreground',
        danger: 'bg-danger text-white hover:bg-danger/90',
        'danger-outline':
          'border border-danger-border bg-danger-soft text-danger hover:bg-danger-soft/70',
        link: 'h-auto rounded-sm px-0 text-foreground underline underline-offset-4 hover:text-accent-strong',
      },
      size: {
        sm: 'h-9 px-3.5',
        default: 'h-10 px-4',
        lg: 'h-11 px-6 text-[0.9375rem]',
        icon: 'size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ref?: React.Ref<HTMLButtonElement>
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
