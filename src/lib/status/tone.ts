import type { BadgeTone } from '@/components/ui/badge'

/**
 * Single source of truth for how a backend status value is *shown*.
 *
 * Status values, labels and transitions are owned by the PocketBase hooks —
 * nothing here changes them. This module only decides which visual tone a
 * value maps to, so the same status never appears in two different colours.
 *
 * Tone vocabulary:
 *   neutral   — informational, nothing expected from anyone
 *   progress  — someone is actively working on it
 *   attention — the *viewer* has to act
 *   positive  — resolved favourably
 *   critical  — resolved unfavourably, or overdue
 */

const APPLICATION_TONE: Record<string, BadgeTone> = {
  submitted: 'progress',
  eligibility_review: 'progress',
  under_review: 'progress',
  funding_pending: 'progress',
  supplement_required: 'attention',
  returned_for_edit: 'attention',
  approved: 'positive',
  funding_decided: 'positive',
  rejected: 'critical',
  closed: 'neutral',
}

const ELIGIBILITY_TONE: Record<string, BadgeTone> = {
  pending: 'neutral',
  qualified: 'positive',
  supplement_required: 'attention',
  disqualified: 'critical',
}

const FOLLOW_UP_TONE: Record<string, BadgeTone> = {
  pending: 'attention',
  submitted: 'progress',
  under_review: 'progress',
  supplement_required: 'attention',
  approved: 'positive',
  rejected: 'critical',
  waived: 'neutral',
  overdue: 'critical',
}

const PERIOD_TONE: Record<string, BadgeTone> = {
  open: 'positive',
  scheduled: 'progress',
  closed: 'neutral',
  none: 'neutral',
}

export function applicationStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral'
  return APPLICATION_TONE[status] ?? 'neutral'
}

export function eligibilityStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral'
  return ELIGIBILITY_TONE[status] ?? 'neutral'
}

export function followUpStatusTone(
  status: string | null | undefined,
  isOverdue = false,
): BadgeTone {
  if (isOverdue && status !== 'approved' && status !== 'waived') return 'critical'
  if (!status) return 'neutral'
  return FOLLOW_UP_TONE[status] ?? 'neutral'
}

export function periodStateTone(state: string | null | undefined): BadgeTone {
  if (!state) return 'neutral'
  return PERIOD_TONE[state] ?? 'neutral'
}

/** Tailwind classes for legacy call sites that render their own chip. */
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-muted text-subtle',
  outline: 'border-border-strong bg-surface text-foreground',
  progress: 'border-info-border bg-info-soft text-info',
  attention: 'border-warning-border bg-warning-soft text-warning',
  positive: 'border-success-border bg-success-soft text-success',
  critical: 'border-danger-border bg-danger-soft text-danger',
  brand: 'border-transparent bg-accent text-accent-foreground',
  ink: 'border-transparent bg-ink text-ink-foreground',
}

export function toneClass(tone: BadgeTone): string {
  return TONE_CLASS[tone]
}
