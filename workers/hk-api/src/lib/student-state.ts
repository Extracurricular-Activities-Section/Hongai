import type PocketBase from 'pocketbase'

/**
 * Per-period student state stored on hk_students.profile_json:
 *   period_profiles[periodId]          -> period confirmation (grade, identity types, bank…)
 *   category_entries[periodId][code]   -> category progress (not_started | draft)
 */

type Row = Record<string, unknown>

export type StudentState = {
  period_profiles: Record<string, Row>
  category_entries: Record<string, Record<string, Row>>
}

const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

export function readState(student: Row): StudentState {
  const profile = obj(student.profile_json)
  return {
    period_profiles: obj(profile.period_profiles) as Record<string, Row>,
    category_entries: obj(profile.category_entries) as Record<string, Record<string, Row>>,
  }
}

/** Re-read the student, apply a mutation to the state and persist profile_json. */
export async function mutateState(
  pb: PocketBase,
  studentId: string,
  mutate: (state: StudentState, student: Row) => void,
): Promise<{ state: StudentState; student: Row }> {
  const student = (await pb.collection('hk_students').getOne(studentId)) as Row
  const state = readState(student)
  mutate(state, student)
  await pb.collection('hk_students').update(studentId, {
    profile_json: { ...obj(student.profile_json), ...state },
  })
  return { state, student }
}

export function periodProfileToPlain(
  studentId: string,
  periodId: string,
  stored: Row | undefined,
): Row | null {
  if (!stored) return null
  return {
    id: `${studentId}:${periodId}`,
    student: studentId,
    period: periodId,
    grade: stored.grade ?? null,
    application_identity_types: Array.isArray(stored.application_identity_types)
      ? stored.application_identity_types
      : [],
    disability_level: stored.disability_level || null,
    weak_aid_level: stored.weak_aid_level || null,
    has_applied_before: Boolean(stored.has_applied_before),
    bank_account_registered: Boolean(stored.bank_account_registered),
    bank_account_note: stored.bank_account_note || null,
    qualification_note: stored.qualification_note || null,
    confirmed_at: stored.confirmed_at || null,
    source_period: stored.source_period || null,
    copied_from_previous: Boolean(stored.copied_from_previous),
    created: String(stored.created || ''),
    updated: String(stored.updated || ''),
  }
}

export function entryToPlain(
  studentId: string,
  periodId: string,
  categoryId: string,
  stored: Row | undefined,
): Row | null {
  if (!stored) return null
  return {
    id: String(stored.id || ''),
    student: studentId,
    period: periodId,
    category: categoryId,
    status: String(stored.status || 'draft'),
    last_opened_at: stored.last_opened_at || null,
    copied_from_entry: stored.copied_from_entry || null,
    created: String(stored.created || ''),
    updated: String(stored.updated || ''),
  }
}

/** True when the student has profiles or entries in any period other than excludePeriodId. */
export function hasHistory(state: StudentState, excludePeriodId?: string): boolean {
  const periods = new Set([
    ...Object.keys(state.period_profiles),
    ...Object.keys(state.category_entries).filter(
      (pid) => Object.keys(state.category_entries[pid] || {}).length > 0,
    ),
  ])
  if (excludePeriodId) periods.delete(excludePeriodId)
  return periods.size > 0
}
