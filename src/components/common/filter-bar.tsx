import { Search, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/** Toolbar shell: search on the left, filter pills flowing after it. */
export function FilterBar({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  )
}

export function SearchInput({
  defaultValue,
  placeholder = '搜尋',
  onSearch,
  ariaLabel,
  className,
}: {
  defaultValue?: string
  placeholder?: string
  onSearch: (value: string) => void
  ariaLabel: string
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [hasValue, setHasValue] = React.useState(Boolean(defaultValue))

  return (
    <div className={cn('relative min-w-0 flex-1 sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        aria-label={ariaLabel}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(event) => setHasValue(event.target.value.length > 0)}
        onBlur={(event) => onSearch(event.target.value.trim())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSearch((event.target as HTMLInputElement).value.trim())
          }
        }}
        className="h-10 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-9 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-accent-strong [&::-webkit-search-cancel-button]:hidden"
      />
      {hasValue ? (
        <button
          type="button"
          aria-label="清除搜尋"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = ''
            setHasValue(false)
            onSearch('')
          }}
          className="absolute right-2.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-pill text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export interface FilterOption {
  value: string
  label: string
}

/**
 * Pill-shaped native select. Native keeps the keyboard and screen-reader
 * behaviour correct on every platform, and reads as a filter chip when a
 * value is active.
 */
export function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
  className,
}: {
  label: string
  value: string
  options: FilterOption[]
  allLabel: string
  onChange: (value: string) => void
  className?: string
}) {
  const active = value !== ''
  const selected = options.find((option) => option.value === value)

  return (
    <div className={cn('relative', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-10 appearance-none rounded-pill border pl-3.5 pr-8 text-sm font-medium transition-colors',
          active
            ? 'border-transparent bg-ink text-ink-foreground'
            : 'border-border-strong bg-surface text-subtle hover:border-foreground/25 hover:text-foreground',
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.625rem]',
          active ? 'text-ink-subtle' : 'text-muted-foreground',
        )}
      >
        ▼
      </span>
      <span className="sr-only">{selected ? `${label}：${selected.label}` : ''}</span>
    </div>
  )
}

/** Segmented pill group for small, mutually exclusive option sets. */
export function FilterChips({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 rounded-pill px-3.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-ink text-ink-foreground'
                : 'bg-surface-muted text-subtle hover:bg-surface-sunken hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
