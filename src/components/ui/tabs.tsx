import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Minimal WAI-ARIA tab pattern with roving tabindex. Built in-repo rather than
 * pulling a new Radix package; keyboard behaviour matches the authoring
 * practices spec (arrows move, Home/End jump, Tab leaves the tablist).
 */

export interface TabItem {
  value: string
  label: string
  /** Optional count rendered as a trailing pill (e.g. attachment count). */
  count?: number | null
  disabled?: boolean
}

export function Tabs({
  items,
  value,
  onValueChange,
  ariaLabel,
  className,
}: {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  className?: string
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const enabled = items.filter((item) => !item.disabled)

  function move(offset: number) {
    const index = enabled.findIndex((item) => item.value === value)
    if (index < 0) return
    const next = enabled[(index + offset + enabled.length) % enabled.length]
    onValueChange(next.value)
    refs.current[next.value]?.focus()
  }

  function jump(target: 'first' | 'last') {
    const next = target === 'first' ? enabled[0] : enabled[enabled.length - 1]
    if (!next) return
    onValueChange(next.value)
    refs.current[next.value]?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        jump('first')
        break
      case 'End':
        event.preventDefault()
        jump('last')
        break
      default:
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-px',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[item.value] = node
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
              selected
                ? 'bg-ink text-ink-foreground'
                : 'text-subtle hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  'rounded-pill px-1.5 text-[0.6875rem] tabular',
                  selected ? 'bg-white/15 text-ink-foreground' : 'bg-surface-sunken text-subtle',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  value,
  activeValue,
  className,
  children,
}: {
  value: string
  activeValue: string
  className?: string
  children: React.ReactNode
}) {
  if (value !== activeValue) return null
  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  )
}
