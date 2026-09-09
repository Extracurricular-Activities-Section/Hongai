import type { ApplicationPeriod } from '@/types'

/**
 * Determine whether period A is "newer" than period B.
 * Used instead of a manually maintained is_latest boolean.
 *
 * Order: academic_year DESC → semester DESC → start_at DESC → sort_order DESC
 */
export function comparePeriodsForLatest(a: ApplicationPeriod, b: ApplicationPeriod): number {
  if (a.academic_year !== b.academic_year) {
    return b.academic_year - a.academic_year
  }
  if (a.semester !== b.semester) {
    return Number(b.semester) - Number(a.semester)
  }
  const startDiff = Date.parse(b.start_at) - Date.parse(a.start_at)
  if (startDiff !== 0) {
    return startDiff
  }
  return b.sort_order - a.sort_order
}

export function pickLatestPeriod(periods: ApplicationPeriod[]): ApplicationPeriod | null {
  if (periods.length === 0) {
    return null
  }
  return [...periods].sort(comparePeriodsForLatest)[0] ?? null
}

/**
 * A student may submit only when:
 * - period is the latest among candidates
 * - status === open
 * - now is within [start_at, end_at]
 */
export function isPeriodOpenForSubmission(
  period: ApplicationPeriod,
  latest: ApplicationPeriod | null,
  now: Date = new Date(),
): boolean {
  if (!latest || latest.id !== period.id) {
    return false
  }
  if (period.status !== 'open' || !period.active) {
    return false
  }
  const start = Date.parse(period.start_at)
  const end = Date.parse(period.end_at)
  const ts = now.getTime()
  return !Number.isNaN(start) && !Number.isNaN(end) && ts >= start && ts <= end
}
