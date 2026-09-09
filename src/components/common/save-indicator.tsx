import { AlertCircle, Check, Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Autosave feedback for long forms. Polite live region so a screen reader
 * hears "已儲存" without losing the caret position.
 */
export function SaveIndicator({
  state,
  savedAtLabel,
  errorMessage,
  className,
}: {
  state: SaveState
  savedAtLabel?: string | null
  errorMessage?: string | null
  className?: string
}) {
  let content: React.ReactNode = null

  if (state === 'saving') {
    content = (
      <>
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        儲存中…
      </>
    )
  } else if (state === 'saved') {
    content = (
      <>
        <Check className="size-3.5 text-success" aria-hidden />
        已儲存{savedAtLabel ? ` · ${savedAtLabel}` : ''}
      </>
    )
  } else if (state === 'error') {
    content = (
      <>
        <AlertCircle className="size-3.5" aria-hidden />
        {errorMessage || '儲存失敗，請重試'}
      </>
    )
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        'inline-flex min-h-5 items-center gap-1.5 text-meta',
        state === 'error' ? 'text-danger' : 'text-muted-foreground',
        className,
      )}
    >
      {content}
    </p>
  )
}
