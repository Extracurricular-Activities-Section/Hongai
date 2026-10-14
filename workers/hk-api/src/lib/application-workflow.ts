import type PocketBase from 'pocketbase'

import { flattenFields } from './forms'

/**
 * Application review state machine and per-application records.
 * Ported from legacy pb_hooks/hk_application_workflow.js + hk_applications.pb.js.
 *
 * Without dedicated collections, review records live on hk_applications.workflow_json:
 *   status_history[], reviews[], supplements[], assignments[]
 * and funding decisions on hk_applications.funding_json.decisions[].
 */

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export class WorkflowError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const ACTION_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  start_eligibility_review: { from: ['submitted'], to: 'eligibility_review' },
  qualify_eligibility: { from: ['eligibility_review'], to: 'under_review' },
  disqualify_eligibility: { from: ['eligibility_review', 'under_review'], to: 'rejected' },
  request_supplement: { from: ['eligibility_review', 'under_review'], to: 'supplement_required' },
  accept_supplement: { from: ['supplement_required'], to: 'under_review' },
  return_for_edit: { from: ['under_review', 'supplement_required'], to: 'returned_for_edit' },
  approve: { from: ['under_review'], to: 'approved' },
  reject: { from: ['eligibility_review', 'under_review', 'supplement_required'], to: 'rejected' },
  begin_funding: { from: ['approved'], to: 'funding_pending' },
  revise_funding: { from: ['funding_decided'], to: 'funding_pending' },
  close: { from: ['funding_decided'], to: 'closed' },
}

export const REASON_REQUIRED = new Set([
  'reject',
  'disqualify_eligibility',
  'return_for_edit',
  'request_supplement',
])

export function resolveAction(action: string, currentStatus: string): string {
  const def = ACTION_TRANSITIONS[action]
  if (!def) throw new WorkflowError(400, `未知操作：${action}`)
  if (!def.from.includes(currentStatus)) throw new WorkflowError(400, '目前狀態不可執行此操作')
  return def.to
}

export const nowIso = () => new Date().toISOString()

export function workflowOf(application: Row): Row {
  return obj(application.workflow_json)
}

export function historyEntry(input: {
  from_status: string | null
  to_status: string
  changed_by_type: 'student' | 'staff' | 'admin' | 'system'
  changed_by_student?: string
  changed_by_staff?: string
  reason: string
  metadata?: Row
}): Row {
  return {
    id: crypto.randomUUID(),
    changed_by_student: null,
    changed_by_staff: null,
    metadata: null,
    ...input,
    created: nowIso(),
  }
}

export function reviewEntry(input: {
  application: string
  reviewer: string
  review_type: 'eligibility' | 'content' | 'final'
  decision: string
  comment: string
  internal_note: string
  student_message: string
}): Row {
  return { id: crypto.randomUUID(), ...input, created: nowIso() }
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

export type ExtractedFunding = {
  category_code: string
  requested_total: number
  items: Array<{ item_code: string; item_label: string; requested_amount: number; sort_order: number }>
}

const AMOUNT_TYPES = new Set(['currency', 'number'])

/**
 * Derive requested funding items from the pinned form schema:
 * one item per row of each repeat_group with a currency column, otherwise
 * one item per top-level currency field. The total prefers a computed
 * "requested_total" field when the form provides one.
 */
export function extractRequestedFunding(
  form: Row,
  answers: Row,
  categoryCode: string,
): ExtractedFunding {
  const fields = flattenFields(form)
  const items: ExtractedFunding['items'] = []
  let sort = 1

  for (const field of fields) {
    if (field.field_type !== 'repeat_group') continue
    const columns = arr(obj(field.config).columns)
    const amountCol = columns.find((col) => str(col.field_type) === 'currency')
    if (!amountCol) continue
    const labelCols = columns.filter((col) => !AMOUNT_TYPES.has(str(col.field_type)))
    arr(answers[field.code]).forEach((row, index) => {
      const label = labelCols.map((col) => str(row[str(col.code)]).trim()).filter(Boolean).join('／')
      items.push({
        item_code: `${field.code}_${index + 1}`,
        item_label: label || `${field.label} #${index + 1}`,
        requested_amount: num(row[str(amountCol.code)]),
        sort_order: sort++,
      })
    })
  }

  if (items.length === 0) {
    for (const field of fields) {
      if (field.field_type !== 'currency') continue
      const amount = num(answers[field.code])
      if (amount <= 0) continue
      items.push({
        item_code: field.code,
        item_label: field.label,
        requested_amount: amount,
        sort_order: sort++,
      })
    }
  }

  const computedTotal = num(answers.requested_total)
  if (items.length === 0) {
    items.push({
      item_code: 'base_grant',
      item_label: '補助金額',
      requested_amount: computedTotal,
      sort_order: 1,
    })
  }

  const itemTotal = items.reduce((sum, item) => sum + item.requested_amount, 0)
  return {
    category_code: categoryCode,
    requested_total: computedTotal > 0 ? computedTotal : itemTotal,
    items,
  }
}

export function fundingDecisions(application: Row): Row[] {
  return arr(obj(application.funding_json).decisions)
}

export function latestFinalDecision(application: Row): Row | null {
  return (
    fundingDecisions(application)
      .filter((decision) => decision.status === 'final')
      .sort((a, b) => num(b.decision_version) - num(a.decision_version))[0] ?? null
  )
}

export async function annualFundingSummary(pb: PocketBase, studentId: string, academicYear: number) {
  const rows = (await pb.collection('hk_applications').getFullList({
    filter: pb.filter('student = {:sid} && status != "draft"', { sid: studentId }),
    fields: 'id,application_number,category_code,status,requested_amount,approved_amount,period_json,funding_json',
  })) as Row[]
  let totalRequested = 0
  let totalApproved = 0
  const applications: Row[] = []
  for (const row of rows) {
    if (num(obj(row.period_json).academic_year) !== academicYear) continue
    const final = latestFinalDecision(row)
    const approved = final ? num(final.approved_total) : num(row.approved_amount)
    totalRequested += num(row.requested_amount)
    totalApproved += approved
    applications.push({
      application_id: str(row.id),
      application_number: str(row.application_number),
      category: str(row.category_code),
      status: str(row.status),
      requested_amount: num(row.requested_amount),
      approved_amount: approved,
    })
  }
  return {
    academic_year: academicYear,
    total_requested: totalRequested,
    total_approved: totalApproved,
    applications,
  }
}

// ---------------------------------------------------------------------------
// Notifications + audit
// ---------------------------------------------------------------------------

export async function notifyStudent(
  pb: PocketBase,
  input: {
    studentId: string
    applicationId: string
    notificationType: string
    uiCategory: 'application' | 'supplement' | 'funding' | 'follow_up' | 'system'
    title: string
    message: string
    actionUrl: string
    supplementId?: string
  },
): Promise<void> {
  try {
    await pb.collection('hk_events').create({
      event_type: 'notification',
      event_key: input.notificationType,
      target_type: 'application',
      target_id: input.applicationId,
      recipient_json: { student: input.studentId },
      payload_json: {
        notification_type: input.notificationType,
        ui_category: input.uiCategory,
        title: input.title,
        message: input.message,
        application: input.applicationId,
        supplement_request: input.supplementId ?? null,
        action_url: input.actionUrl,
        read_at: null,
      },
      status: 'unread',
      occurred_at: nowIso(),
    })
  } catch {
    // notifications are best-effort; the workflow change already succeeded
  }
}

export async function writeAudit(
  pb: PocketBase,
  input: { actorStaff?: string; actorStudent?: string; action: string; targetId: string; payload?: Row },
): Promise<void> {
  try {
    await pb.collection('hk_events').create({
      event_type: 'audit',
      event_key: input.action,
      actor_staff: input.actorStaff || null,
      actor_student: input.actorStudent || null,
      target_type: 'application',
      target_id: input.targetId,
      payload_json: input.payload ?? {},
      occurred_at: nowIso(),
    })
  } catch {
    // audit is best-effort
  }
}

export function studentActionUrl(application: Row): string {
  const code = str(application.category_code)
  return code ? `/student/current/category/${code}` : '/student/current'
}
