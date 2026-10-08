import type PocketBase from 'pocketbase'

/**
 * Application periods live in hk_settings rows with setting_type="period".
 * The settings record id is the period id; period fields live in value_json.
 */

export type PeriodStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'archived'

export type Period = {
  id: string
  name: string
  academic_year: number
  semester: '1' | '2'
  start_at: string
  end_at: string
  status: PeriodStatus
  active: boolean
  sort_order: number
  description: string | null
  min_application_count: number
  min_application_rule: 'warning_only' | 'enforced'
  created: string
  updated: string
}

const PERIOD_STATUSES = new Set<PeriodStatus>(['draft', 'scheduled', 'open', 'closed', 'archived'])

export function periodFromSetting(record: Record<string, unknown>): Period {
  const value = (record.value_json && typeof record.value_json === 'object'
    ? record.value_json
    : {}) as Record<string, unknown>
  const status = String(value.status || 'draft') as PeriodStatus
  return {
    id: String(record.id || ''),
    name: String(value.name || ''),
    academic_year: Number(value.academic_year) || 0,
    semester: String(value.semester) === '2' ? '2' : '1',
    start_at: String(value.start_at || ''),
    end_at: String(value.end_at || ''),
    status: PERIOD_STATUSES.has(status) ? status : 'draft',
    active: Boolean(record.active),
    sort_order: Number(value.sort_order) || 0,
    description: value.description ? String(value.description) : null,
    min_application_count: Number(value.min_application_count) || 2,
    min_application_rule: value.min_application_rule === 'enforced' ? 'enforced' : 'warning_only',
    created: String(record.created || ''),
    updated: String(record.updated || ''),
  }
}

function toMs(value: string): number {
  return value ? Date.parse(value) : Number.NaN
}

/** Newest first: academic year, semester, start time, then sort order. */
export function compareLatestFirst(a: Period, b: Period): number {
  if (a.academic_year !== b.academic_year) return b.academic_year - a.academic_year
  if (a.semester !== b.semester) return Number(b.semester) - Number(a.semester)
  const startDiff = (toMs(b.start_at) || 0) - (toMs(a.start_at) || 0)
  if (startDiff !== 0) return startDiff
  return b.sort_order - a.sort_order
}

/** Active, non-draft periods sorted newest first. */
export async function listVisiblePeriods(pb: PocketBase): Promise<Period[]> {
  const rows = await pb.collection('hk_settings').getFullList({
    filter: 'setting_type = "period" && active = true',
  })
  return rows
    .map((row) => periodFromSetting(row as Record<string, unknown>))
    .filter((period) => period.status !== 'draft')
    .sort(compareLatestFirst)
}

export function isPeriodEditableNow(period: Period, nowMs: number): boolean {
  if (!period.active || period.status !== 'open') return false
  const start = toMs(period.start_at)
  const end = toMs(period.end_at)
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  return nowMs >= start && nowMs <= end
}

export type PeriodUiState = 'none' | 'open' | 'scheduled' | 'closed'

export function resolvePeriodUiState(latest: Period | null, nowMs: number): PeriodUiState {
  if (!latest) return 'none'
  if (isPeriodEditableNow(latest, nowMs)) return 'open'
  if (latest.status === 'scheduled') return 'scheduled'
  if (latest.status === 'open' && nowMs < toMs(latest.start_at)) return 'scheduled'
  return 'closed'
}

/**
 * Per-period student confirmations are stored on the student record:
 * hk_students.profile_json.period_profiles[periodId].
 */
export function studentPeriodProfiles(
  student: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const profile = student.profile_json
  if (!profile || typeof profile !== 'object') return {}
  const map = (profile as { period_profiles?: unknown }).period_profiles
  if (!map || typeof map !== 'object') return {}
  return map as Record<string, Record<string, unknown>>
}
