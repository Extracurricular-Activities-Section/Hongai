import type PocketBase from 'pocketbase'

import {
  REASON_REQUIRED,
  WorkflowError,
  annualFundingSummary,
  annualHeadroom,
  extractRequestedFunding,
  fundingDecisions,
  historyEntry,
  notifyStudent,
  nowIso,
  resolveAction,
  reviewEntry,
  studentActionUrl,
  workflowOf,
  writeAudit,
} from '../lib/application-workflow'
import { applicationToPlain, maskIdentity } from '../lib/applications'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { toSchema } from '../lib/forms'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import { periodProfileToPlain, readState } from '../lib/student-state'

/**
 * Admin application detail, review actions, assignment and funding decisions.
 * Record layout is documented in lib/application-workflow.
 */

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; staff: StaffAuthContext; body: Row }

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const actorType = (staff: StaffAuthContext) => (staff.is_admin ? 'admin' : 'staff')
const money = (value: number) => value.toLocaleString('zh-TW')

async function loadApplication(pb: PocketBase, id: string): Promise<Row> {
  try {
    return (await pb.collection('hk_applications').getOne(id, { expand: 'student' })) as Row
  } catch {
    throw new WorkflowError(404, '找不到案件')
  }
}

function studentOf(application: Row): Row {
  return obj(obj(application.expand).student)
}

async function loadForm(pb: PocketBase, application: Row): Promise<Row | null> {
  try {
    return (await pb.collection('hk_forms').getOne(str(application.form))) as Row
  } catch {
    return null
  }
}

function snapshotAnswers(application: Row): Row {
  const snapshot = obj(application.submission_snapshot_json)
  return obj(snapshot.answers ?? application.answers_json)
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

async function detail({ pb }: Ctx, id: string) {
  const application = await loadApplication(pb, id)
  if (application.status === 'draft') throw new WorkflowError(404, '找不到案件')
  const student = studentOf(application)
  const workflow = workflowOf(application)
  const snapshot = obj(application.submission_snapshot_json)
  const periodId = str(application.period_key)
  const storedProfile = readState(student).period_profiles[periodId]
  const academicYear = num(obj(application.period_json).academic_year)
  const [form, annualSummary] = await Promise.all([
    loadForm(pb, application),
    annualFundingSummary(pb, str(application.student), academicYear),
  ])

  return json({
    application: applicationToPlain(application),
    student: {
      id: str(application.student),
      student_no: str(student.student_no),
      profile: {
        name: str(student.name),
        department_name: str(student.department_name),
        grade: str(storedProfile?.grade) || str(student.grade),
        email: str(obj(student.profile_json).contact_email) || str(student.email),
        phone: str(student.phone),
        identity_masked: maskIdentity(student.identity_last4),
      },
    },
    period_profile: periodProfileToPlain(str(application.student), periodId, storedProfile),
    submission_snapshot: Object.keys(snapshot).length ? snapshot : null,
    form_schema: form ? toSchema(form) : null,
    answers: snapshotAnswers(application),
    pdf: null,
    reviews: arr(workflow.reviews).slice().reverse(),
    funding_history: fundingDecisions(application).slice().reverse(),
    assignments: arr(workflow.assignments).slice().reverse(),
    supplements: arr(workflow.supplements).slice().reverse(),
    status_history: arr(workflow.status_history).slice().reverse(),
    annual_funding_summary: annualSummary,
  })
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

const NOTIFY: Record<string, { type: string; ui: 'application' | 'supplement'; title: string }> = {
  request_supplement: { type: 'SUPPLEMENT_REQUESTED', ui: 'supplement', title: '申請需要補件' },
  return_for_edit: { type: 'APPLICATION_RETURNED', ui: 'application', title: '申請已退回修改' },
  reject: { type: 'APPLICATION_REJECTED', ui: 'application', title: '申請未通過' },
  disqualify_eligibility: { type: 'APPLICATION_REJECTED', ui: 'application', title: '申請資格不符' },
  approve: { type: 'APPLICATION_APPROVED', ui: 'application', title: '申請審核通過' },
}

async function action({ pb, staff, body }: Ctx, id: string) {
  const application = await loadApplication(pb, id)
  const actionName = str(body.action).trim()
  const reason = str(body.reason).trim()
  const studentMessage = str(body.student_message).trim()
  const internalNote = str(body.internal_note).trim()
  const comment = str(body.comment).trim()
  const editOverrideUntil = str(body.edit_override_until).trim()
  const dueAt = str(body.due_at).trim()

  const fromStatus = str(application.status)
  const toStatus = resolveAction(actionName, fromStatus)
  if (REASON_REQUIRED.has(actionName) && !reason) throw new WorkflowError(400, '請填寫原因')
  const studentFacing = studentMessage || reason

  const now = nowIso()
  const workflow = { ...workflowOf(application) }
  const reviews = arr(workflow.reviews)
  const supplements = arr(workflow.supplements)
  const update: Row = { status: toStatus, latest_reviewed_at: now }
  let supplementId: string | undefined

  const review = (
    reviewType: 'eligibility' | 'content' | 'final',
    decision: string,
    fallbackComment: string,
    message = studentMessage,
  ) =>
    reviews.push(
      reviewEntry({
        application: id,
        reviewer: staff.id,
        review_type: reviewType,
        decision,
        comment: comment || fallbackComment,
        internal_note: internalNote,
        student_message: message,
      }),
    )

  switch (actionName) {
    case 'start_eligibility_review':
      review('eligibility', 'note_only', '開始資格審核')
      break
    case 'qualify_eligibility':
      update.eligibility_status = 'qualified'
      review('eligibility', 'qualified', reason)
      break
    case 'disqualify_eligibility':
      update.eligibility_status = 'disqualified'
      workflow.reject_reason = studentFacing
      review('eligibility', 'disqualified', reason, studentFacing)
      break
    case 'request_supplement': {
      if (fromStatus === 'eligibility_review') update.eligibility_status = 'supplement_required'
      workflow.supplement_message = studentFacing
      workflow.supplement_due_at = dueAt || null
      supplementId = crypto.randomUUID()
      supplements.push({
        id: supplementId,
        application: id,
        requested_by: staff.id,
        message: studentFacing,
        reason,
        due_at: dueAt || null,
        status: 'pending',
        submitted_at: null,
        resolved_at: null,
        student_reply: null,
        created: now,
      })
      review(
        fromStatus === 'eligibility_review' ? 'eligibility' : 'content',
        'supplement_required',
        reason,
        studentFacing,
      )
      break
    }
    case 'accept_supplement':
      for (const item of supplements) {
        if (item.status === 'pending' || item.status === 'submitted') {
          item.status = 'accepted'
          item.resolved_at = now
        }
      }
      workflow.supplement_message = ''
      workflow.supplement_due_at = null
      if (application.eligibility_status === 'supplement_required') update.eligibility_status = 'qualified'
      review('content', 'note_only', '接受補件')
      break
    case 'return_for_edit':
      workflow.return_reason = studentFacing
      if (editOverrideUntil) update.edit_override_until = editOverrideUntil
      review('content', 'returned_for_edit', reason, studentFacing)
      break
    case 'approve':
      // A supplement reply resets eligibility to pending; approval settles it.
      if (str(application.eligibility_status || 'pending') === 'pending') {
        update.eligibility_status = 'qualified'
      }
      review('final', 'approved', reason)
      break
    case 'reject':
      workflow.reject_reason = studentFacing
      review(
        fromStatus === 'eligibility_review' ? 'eligibility' : 'content',
        'rejected',
        reason,
        studentFacing,
      )
      break
    case 'close': {
      const openTasks = arr(application.tasks_json).filter(
        (task) => task.required !== false && !['approved', 'waived'].includes(str(task.status)),
      )
      if (openTasks.length) throw new WorkflowError(400, '尚有必要追蹤任務未完成，不可結案')
      update.closed_at = now
      break
    }
    default:
      break
  }

  workflow.reviews = reviews
  workflow.supplements = supplements
  workflow.status_history = [
    ...arr(workflow.status_history),
    historyEntry({
      from_status: fromStatus,
      to_status: toStatus,
      changed_by_type: actorType(staff),
      changed_by_staff: staff.id,
      reason: reason || comment || actionName,
      metadata: { action: actionName },
    }),
  ]
  update.workflow_json = workflow

  const saved = (await pb.collection('hk_applications').update(id, update, { expand: 'student' })) as Row
  await writeAudit(pb, {
    actorStaff: staff.id,
    action: `APPLICATION_ACTION_${actionName.toUpperCase()}`,
    targetId: id,
    payload: { from_status: fromStatus, to_status: toStatus },
  })

  const notice = NOTIFY[actionName]
  if (notice) {
    const number = str(application.application_number)
    const category = str(application.category_name)
    const detailText = studentMessage || (REASON_REQUIRED.has(actionName) ? reason : '')
    await notifyStudent(pb, {
      studentId: str(application.student),
      applicationId: id,
      notificationType: notice.type,
      uiCategory: notice.ui,
      title: notice.title,
      message: `${category} 申請（${number}）：${notice.title}${detailText ? `。${detailText}` : ''}${
        dueAt ? `（截止：${dueAt.slice(0, 10)}）` : ''
      }`,
      actionUrl: studentActionUrl(application),
      supplementId,
    })
  }

  return json({ application: applicationToPlain(saved), message: '操作完成' })
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

async function assign({ pb, staff, body }: Ctx, id: string) {
  const application = await loadApplication(pb, id)
  const staffId = str(body.staff_id).trim()
  const departmentId = str(body.department_id).trim()
  const assignmentType = str(body.assignment_type).trim() || 'primary'
  if (!['primary', 'collaborator', 'viewer'].includes(assignmentType)) {
    throw new WorkflowError(400, 'assignment_type 無效')
  }
  if (!staffId && !departmentId) throw new WorkflowError(400, '請指定承辦人或單位')
  const hasCurrent = Boolean(application.current_staff) || Boolean(obj(application.current_department_json).id)
  if (!hasCurrent && !staff.is_admin) throw new WorkflowError(403, '未指派案件僅管理員可指派')

  const update: Row = {}
  if (staffId) {
    try {
      await pb.collection('hk_staff_users').getOne(staffId, { fields: 'id' })
    } catch {
      throw new WorkflowError(400, '承辦人不存在')
    }
    update.current_staff = staffId
  }
  if (departmentId) {
    let department: Row
    try {
      department = (await pb.collection('hk_settings').getOne(departmentId)) as Row
    } catch {
      throw new WorkflowError(400, '單位不存在')
    }
    if (!str(department.key).startsWith('department:')) throw new WorkflowError(400, '單位不存在')
    update.current_department_json = { ...obj(department.value_json), id: departmentId }
  }

  const workflow = { ...workflowOf(application) }
  const assignment = {
    id: crypto.randomUUID(),
    application: id,
    staff: staffId || null,
    department: departmentId || null,
    assignment_type: assignmentType,
    active: true,
    assigned_by: staff.id,
    created: nowIso(),
  }
  workflow.assignments = [...arr(workflow.assignments), assignment]
  update.workflow_json = workflow

  const saved = (await pb.collection('hk_applications').update(id, update, { expand: 'student' })) as Row
  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'APPLICATION_ASSIGNED',
    targetId: id,
    payload: { staff_id: staffId || null, department_id: departmentId || null, assignment_type: assignmentType },
  })
  return json({ application: applicationToPlain(saved), assignment })
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

async function extractedFor(pb: PocketBase, application: Row) {
  const form = await loadForm(pb, application)
  if (!form) throw new WorkflowError(400, '找不到申請表單版本')
  return extractRequestedFunding(form, snapshotAnswers(application), str(application.category_code))
}

async function fundingPreview({ pb }: Ctx, id: string) {
  const application = await loadApplication(pb, id)
  const academicYear = num(obj(application.period_json).academic_year)
  const [extracted, summary] = await Promise.all([
    extractedFor(pb, application),
    annualFundingSummary(pb, str(application.student), academicYear),
  ])
  const headroom = annualHeadroom(summary, id)
  const projected = headroom.approved_others + extracted.requested_total
  const warnings =
    projected > headroom.annual_limit
      ? [
          {
            rule_type: 'annual_total_limit',
            message: `全額核定後本學年度累計 ${money(projected)} 元，超過年度上限 ${money(headroom.annual_limit)} 元；本案最多可核定 ${money(headroom.remaining)} 元。`,
            limit_amount: headroom.annual_limit,
            projected,
          },
        ]
      : []
  return json({ extracted, annual_funding_summary: summary, annual_headroom: headroom, warnings })
}

async function createFunding({ pb, staff, body }: Ctx, id: string) {
  const application = await loadApplication(pb, id)
  const status = str(application.status)
  if (status !== 'funding_pending' && status !== 'funding_decided') {
    throw new WorkflowError(400, '目前狀態不可核定補助')
  }
  const changeReason = str(body.change_reason).trim()
  const isRevise = status === 'funding_decided'
  if (isRevise && !changeReason) throw new WorkflowError(400, '修正核定請填寫變更原因')

  const extracted = await extractedFor(pb, application)
  const requestedByCode = new Map(extracted.items.map((item) => [item.item_code, item]))
  const inputItems = arr(body.items)
  if (!inputItems.length) throw new WorkflowError(400, '請提供核定項目')

  const decisionId = crypto.randomUUID()
  let approvedTotal = 0
  const items = inputItems.map((row, index) => {
    const code = str(row.item_code).trim()
    const requested = requestedByCode.get(code)
    if (!requested) throw new WorkflowError(400, `未知補助項目：${code}`)
    const approved = Number(row.approved_amount)
    if (!Number.isFinite(approved) || approved < 0) throw new WorkflowError(400, '核定金額不可為負數')
    if (approved > requested.requested_amount) {
      throw new WorkflowError(400, `核定金額不可超過申請金額：${requested.item_label}`)
    }
    approvedTotal += approved
    return {
      id: crypto.randomUUID(),
      funding_decision: decisionId,
      item_code: code,
      item_label: requested.item_label,
      requested_amount: requested.requested_amount,
      approved_amount: approved,
      note: str(row.note).trim() || null,
      sort_order: requested.sort_order || index + 1,
    }
  })

  const academicYear = num(obj(application.period_json).academic_year)
  const headroom = annualHeadroom(
    await annualFundingSummary(pb, str(application.student), academicYear),
    id,
  )
  const overrideReason = str(body.limit_override_reason).trim()
  const exceedsLimit = headroom.approved_others + approvedTotal > headroom.annual_limit
  if (exceedsLimit && !(staff.is_admin && overrideReason)) {
    throw new WorkflowError(
      400,
      `核定後本學年度累計 ${money(headroom.approved_others + approvedTotal)} 元，超過年度上限 ${money(headroom.annual_limit)} 元（本案最多可核定 ${money(headroom.remaining)} 元）。如需超額核定，須由管理員填寫超額原因。`,
    )
  }

  const now = nowIso()
  const previous = fundingDecisions(application)
  const nextVersion = previous.reduce((max, d) => Math.max(max, num(d.decision_version)), 0) + 1
  const decision = {
    id: decisionId,
    application: id,
    decision_version: nextVersion,
    requested_total: extracted.requested_total,
    approved_total: approvedTotal,
    decision_note: str(body.decision_note).trim() || null,
    internal_note: str(body.internal_note).trim() || null,
    student_message: str(body.student_message).trim() || null,
    change_reason: changeReason || null,
    limit_override_reason: exceedsLimit ? overrideReason : null,
    decided_by: staff.id,
    decided_at: now,
    status: 'final',
    superseded_by: null,
    created: now,
    items,
  }
  const decisions = previous.map((d) =>
    d.status === 'final' ? { ...d, status: 'superseded', superseded_by: decisionId } : d,
  )

  const workflow = { ...workflowOf(application) }
  workflow.status_history = [
    ...arr(workflow.status_history),
    historyEntry({
      from_status: status,
      to_status: 'funding_decided',
      changed_by_type: actorType(staff),
      changed_by_staff: staff.id,
      reason: changeReason || decision.decision_note || '補助核定',
      metadata: { decision_version: nextVersion, revised: isRevise },
    }),
  ]

  const saved = (await pb.collection('hk_applications').update(
    id,
    {
      status: 'funding_decided',
      approved_amount: approvedTotal,
      latest_reviewed_at: now,
      funding_json: { ...obj(application.funding_json), decisions: [...decisions, decision] },
      workflow_json: workflow,
    },
    { expand: 'student' },
  )) as Row

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: isRevise ? 'FUNDING_DECISION_REVISED' : 'FUNDING_DECISION_CREATED',
    targetId: id,
    payload: {
      approved_total: approvedTotal,
      decision_version: nextVersion,
      limit_override: exceedsLimit,
    },
  })

  if (body.notify_student === true) {
    await notifyStudent(pb, {
      studentId: str(application.student),
      applicationId: id,
      notificationType: isRevise ? 'FUNDING_REVISED' : 'FUNDING_DECIDED',
      uiCategory: 'funding',
      title: isRevise ? '補助核定已修正' : '補助已核定',
      message: `${str(application.category_name)} 申請（${str(application.application_number)}）核定金額 ${approvedTotal.toLocaleString('zh-TW')} 元${
        decision.student_message ? `。${decision.student_message}` : ''
      }`,
      actionUrl: studentActionUrl(application),
    })
  }

  return json({
    application: applicationToPlain(saved),
    funding: decision,
    warnings: [],
    message: isRevise ? '核定已修正' : '核定完成',
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const ID = '([a-z0-9]{15})'

type Route = {
  method: 'GET' | 'POST'
  pattern: RegExp
  handler: (ctx: Ctx, params: string[]) => Promise<Response>
}

const routes: Route[] = [
  { method: 'GET', pattern: new RegExp(`^/api/hk/admin/applications/${ID}$`), handler: (c, [id]) => detail(c, id) },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/applications/${ID}/action$`),
    handler: (c, [id]) => action(c, id),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/applications/${ID}/assign$`),
    handler: (c, [id]) => assign(c, id),
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/api/hk/admin/applications/${ID}/funding-preview$`),
    handler: (c, [id]) => fundingPreview(c, id),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/applications/${ID}/funding$`),
    handler: (c, [id]) => createFunding(c, id),
  },
]

export async function handleAdminApplications(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  let params: string[] = []
  const route = routes.find((candidate) => {
    if (candidate.method !== request.method) return false
    const match = path.match(candidate.pattern)
    if (!match) return false
    params = match.slice(1)
    return true
  })
  if (!route) return null

  const staff = await requireStaff(request, env)
  if (staff instanceof Response) return staff

  let pb: PocketBase
  try {
    pb = await createServicePb(env)
  } catch (err) {
    return json(
      {
        error: 'service_account_required',
        message: err instanceof Error ? err.message : 'Service account required',
      },
      { status: 503 },
    )
  }

  const body =
    request.method === 'POST' ? (((await request.json().catch(() => ({}))) as Row) ?? {}) : {}

  try {
    return await route.handler({ pb, staff, body }, params)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return json({ error: 'request_failed', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '操作失敗' },
      { status: 502 },
    )
  }
}
