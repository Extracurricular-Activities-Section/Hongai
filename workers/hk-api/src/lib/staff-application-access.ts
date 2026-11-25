import type PocketBase from 'pocketbase'

import { WorkflowError } from './application-workflow'
import type { StaffAuthContext } from './auth-staff'
import { authorizedCategoryCodes } from './category-funding-stats'

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

/**
 * Pure scope check used by assert + unit tests.
 * `null` allowed set = admin / unrestricted.
 */
export function staffMayAccessCategory(
  allowed: Set<string> | null,
  categoryCode: string,
): boolean {
  if (allowed === null) return true
  const code = categoryCode.trim()
  if (!code) return false
  return allowed.has(code)
}

/**
 * FIX-03／CONFIRM-01 interim:
 * - Admin always may decide funding.
 * - Explicit `can_decide_funding === false` (field or permissions_json) denies.
 * - Otherwise any staff may decide (current product behavior until school confirms
 *   a narrower rule). No schema migration required.
 */
export function staffMayDecideFunding(staff: StaffAuthContext): boolean {
  if (staff.is_admin) return true
  if (staff.can_decide_funding === false) return false
  const fromPerms = obj(staff.permissions_json).can_decide_funding
  if (fromPerms === false) return false
  return Boolean(staff.is_staff)
}

/** Statuses for「等我處理」; drops funding_pending when staff cannot decide. */
export function awaitingMeStatusesFor(staff: StaffAuthContext): readonly string[] {
  const all = [
    'submitted',
    'teacher_signed',
    'eligibility_review',
    'under_review',
    'funding_pending',
  ] as const
  if (staffMayDecideFunding(staff)) return all
  return all.filter((status) => status !== 'funding_pending')
}

/**
 * Combine a base PocketBase filter with the staff member's authorized categories.
 * Returns `null` when the staff has zero authorized categories (caller should
 * treat as empty result set — not as "no filter").
 */
export async function staffScopedApplicationFilter(
  pb: PocketBase,
  staff: StaffAuthContext,
  baseFilter: string,
): Promise<string | null> {
  const allowed = await authorizedCategoryCodes(pb, staff)
  if (allowed === null) return baseFilter
  if (allowed.size === 0) return null
  const params: Record<string, string> = {}
  const terms = [...allowed].map((code, index) => {
    params[`c${index}`] = code
    return `category_code = {:c${index}}`
  })
  return `${baseFilter} && (${pb.filter(terms.join(' || '), params)})`
}

/**
 * Server-side gate for a single application.
 * `mode` is reserved so read vs write call sites stay explicit; current rules
 * use the same authorizedCategoryCodes set for both (existing product rule).
 */
export async function assertStaffCanAccessApplication(
  pb: PocketBase,
  staff: StaffAuthContext,
  application: Row,
  mode: 'read' | 'write',
): Promise<void> {
  void mode
  const allowed = await authorizedCategoryCodes(pb, staff)
  if (staffMayAccessCategory(allowed, str(application.category_code))) return
  // 404: do not confirm the case exists outside the staff's scope.
  throw new WorkflowError(404, '找不到案件')
}
