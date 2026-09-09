import { AlertCircle, Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export type StepState = 'complete' | 'current' | 'upcoming' | 'error'

export interface ProcessStep {
  id: string
  label: string
  description?: React.ReactNode
  state: StepState
}

function StepMarker({ state, index }: { state: StepState; index: number }) {
  if (state === 'complete') {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-success-soft text-success">
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-danger-soft text-danger">
        <AlertCircle className="size-3.5" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-pill text-meta font-semibold tabular',
        state === 'current'
          ? 'bg-accent text-accent-foreground'
          : 'bg-surface-muted text-muted-foreground',
      )}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
  )
}

const STATE_TEXT: Record<StepState, string> = {
  complete: '已完成',
  current: '進行中',
  upcoming: '尚未開始',
  error: '需修正',
}

/**
 * Horizontal on desktop, vertical on mobile. Communicates "where am I and what
 * happens next" for the application lifecycle and the multi-section form.
 */
export function ProcessStepper({
  steps,
  onStepSelect,
  className,
  ariaLabel = '流程進度',
}: {
  steps: ProcessStep[]
  onStepSelect?: (id: string) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0',
        className,
      )}
    >
      {steps.map((step, index) => {
        const interactive = Boolean(onStepSelect) && step.state !== 'upcoming'
        const content = (
          <>
            <StepMarker state={step.state} index={index} />
            <span className="min-w-0">
              <span
                className={cn(
                  'block truncate text-sm font-medium',
                  step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="mt-0.5 block truncate text-meta text-muted-foreground">
                  {step.description}
                </span>
              ) : null}
              <span className="sr-only">（{STATE_TEXT[step.state]}）</span>
            </span>
          </>
        )

        return (
          <li
            key={step.id}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'relative flex-1 sm:border-t-2 sm:pt-3',
              step.state === 'current'
                ? 'sm:border-accent'
                : step.state === 'complete'
                  ? 'sm:border-success/45'
                  : step.state === 'error'
                    ? 'sm:border-danger/50'
                    : 'sm:border-border',
              index > 0 && 'sm:ml-3',
            )}
          >
            {interactive ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(step.id)}
                className="flex w-full items-center gap-2.5 rounded-md py-1 text-left transition-opacity hover:opacity-80"
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2.5 py-1">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Vertical section navigation for the focused form workspace. */
export function StepRail({
  steps,
  activeId,
  onSelect,
  ariaLabel = '表單區段',
  className,
}: {
  steps: ProcessStep[]
  activeId: string
  onSelect: (id: string) => void
  ariaLabel?: string
  className?: string
}) {
  return (
    <nav aria-label={ariaLabel} className={cn('flex flex-col gap-0.5', className)}>
      {steps.map((step, index) => {
        const active = step.id === activeId
        return (
          <button
            key={step.id}
            type="button"
            aria-current={active ? 'step' : undefined}
            onClick={() => onSelect(step.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left text-sm transition-colors',
              active
                ? 'bg-surface-muted font-medium text-foreground'
                : 'text-subtle hover:bg-surface-muted hover:text-foreground',
            )}
          >
            <StepMarker state={active ? 'current' : step.state} index={index} />
            <span className="min-w-0 flex-1 truncate">{step.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
