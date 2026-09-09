import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Shared shell for every public credential screen so student login, staff
 * login, registration and recovery read as one system.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto w-full max-w-md', className)}>
      <div className="mb-7">
        <h1 className="text-page font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-subtle">{description}</p>
        ) : null}
      </div>

      {children}

      {footer ? (
        <div className="mt-7 border-t border-border pt-5 text-sm text-subtle">{footer}</div>
      ) : null}
    </div>
  )
}

export function AuthLink({
  className,
  ...props
}: React.ComponentProps<'a'> & { ref?: React.Ref<HTMLAnchorElement> }) {
  return (
    <a
      className={cn(
        'rounded-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-accent-strong',
        className,
      )}
      {...props}
    />
  )
}
