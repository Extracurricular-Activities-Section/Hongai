import type PocketBase from 'pocketbase'

import { WorkflowError, nowIso, writeAudit } from '../lib/application-workflow'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { categoryFromSetting } from '../lib/categories'
import {
  ASSIGNMENT_KEY_PREFIX,
  DEFAULT_TASK_EXTENSIONS,
  SETTING_TYPE,
  TASK_TYPES,
  TEMPLATE_KEY_PREFIX,
  applicationIdOfTask,
  assignmentFromSetting,
  ensureFollowUpTasks,
  findTask,
  loadAssignments,
  loadTemplates,
  newTaskId,
  notifyTask,
  taskAttachments,
  taskToPlain,
  templateFromSetting,
} from '../lib/follow-up'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * Staff follow-up task review plus template / category-assignment management (writes admin-only).
 * Task layout is documented in lib/follow-up.
 */

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; staff: StaffAuthContext; body: Row; url: URL }

const str = (value: unknown): string => (value == null ? '' : String(value))
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

const TASK_OPEN_STATUSES = new Set(['approved', 'funding_decided'])
const REVIEWABLE = new Set(['submitted', 'under_review'])
const DECISIONS = new Set(['approved', 'supplement_required', 'rejected'])
const LIST_FIELDS = 'id,student,status,application_number,category_name,category_code,tasks_json,files_json,created,updated'

function requireAdmin(staff: StaffAuthContext) {
  if (!staff.is_admin) throw new WorkflowError(403, '僅管理員可管理追蹤範本')
}

async function loadApplication(pb: PocketBase, id: string): Promise<Row> {
  try {
    return (await pb.collection('hk_applications').getOne(id)) as Row
  } catch {
    throw new WorkflowError(404, '找不到案件')
  }
}

async function loadTaskContext(pb: PocketBase, taskId: string) {
  const applicationId = applicationIdOfTask(taskId)
  if (!applicationId) throw new WorkflowError(404, '找不到追蹤任務')
  const application = await loadApplication(pb, applicationId)
  const { tasks, index } = findTask(application, taskId)
  if (index < 0) throw new WorkflowError(404, '找不到追蹤任務')
  return { application, tasks, index, task: tasks[index] }
}

async function saveTask(pb: PocketBase, application: Row, tasks: Row[], index: number, next: Row) {
  const nextTasks = tasks.map((item, i) => (i === index ? next : item))
  await pb.collection('hk_applications').update(str(application.id), { tasks_json: nextTasks })
}

function optionalText(value: unknown, max = 2000): string | null {
  const text = str(value).trim()
  return text ? text.slice(0, max) : null
}

function optionalInt(value: unknown, min: number, max: number, label: string): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new WorkflowError(400, `${label}需為 ${min}–${max} 的整數`)
  return n
}

function optionalIso(value: unknown, label: string): string | null {
  if (value == null || value === '') return null
  const ms = Date.parse(str(value))
  if (Number.isNaN(ms)) throw new WorkflowError(400, `${label}格式錯誤`)
  return new Date(ms).toISOString()
}

function extensionsOf(value: unknown): string[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) throw new WorkflowError(400, '允許副檔名格式錯誤')
  const list = [...new Set(value.map((ext) => str(ext).trim().toLowerCase().replace(/^\./, '')).filter(Boolean))]
  const invalid = list.filter((ext) => !DEFAULT_TASK_EXTENSIONS.includes(ext))
  if (invalid.length) throw new WorkflowError(400, `不支援的副檔名：${invalid.join(', ')}`)
  return list.length ? list : null
}

function taskTypeOf(value: unknown, fallback: string): string {
  const type = str(value).trim() || fallback
  if (!TASK_TYPES.includes(type)) throw new WorkflowError(400, '任務類型無效')
  return type
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

async function listTasks({ pb, url }: Ctx) {
  const applicationId = url.searchParams.get('application_id')
  const status = url.searchParams.get('status')
  const filter = applicationId
    ? pb.filter('id = {:id}', { id: applicationId })
    : pb.filter('tasks_json ~ {:marker}', { marker: '"id"' })
  const applications = (await pb.collection('hk_applications').getFullList({ filter, fields: LIST_FIELDS })) as Row[]
  const items = applications
    .flatMap((application) => arr(application.tasks_json).map((task) => taskToPlain(task, application, { internal: true })))
    .filter((task) => !status || (status === 'overdue' ? task.is_overdue === true : task.status === status))
    .sort((a, b) => str(b.created).localeCompare(str(a.created)))
  return json({ items })
}

async function taskDetail({ pb }: Ctx, id: string) {
  const { application, task } = await loadTaskContext(pb, id)
  return json({
    task: taskToPlain(task, application, { internal: true }),
    submissions: arr(task.submissions),
    attachments: taskAttachments(application, id),
    reviews: arr(task.reviews),
  })
}

async function createTask({ pb, staff, body }: Ctx) {
  const applicationId = str(body.application_id).trim()
  const application = await loadApplication(pb, applicationId)
  if (!TASK_OPEN_STATUSES.has(str(application.status))) {
    throw new WorkflowError(400, '案件核准後才可建立追蹤任務')
  }

  let template: Row | null = null
  const templateId = str(body.template_id).trim()
  if (templateId) {
    template = (await loadTemplates(pb)).find((item) => item.id === templateId) ?? null
    if (!template) throw new WorkflowError(400, '找不到追蹤範本')
  }
  const name = str(body.name).trim() || str(template?.name)
  if (!name) throw new WorkflowError(400, '請填寫任務名稱')

  const now = nowIso()
  const task: Row = {
    id: newTaskId(applicationId),
    template: template ? str(template.id) : null,
    name: name.slice(0, 200),
    task_type: taskTypeOf(body.task_type, str(template?.task_type) || 'other'),
    description: optionalText(body.description) ?? template?.description ?? null,
    required: body.required === undefined ? template?.required !== false : body.required === true,
    requires_review: body.requires_review === undefined ? template?.requires_review !== false : body.requires_review !== false,
    due_at: optionalIso(body.due_at, '截止日期'),
    status: 'pending',
    completed_at: null,
    created_by: staff.id,
    student_instructions: optionalText(body.student_instructions) ?? template?.student_instructions ?? null,
    event_start_at: optionalIso(body.event_start_at, '活動開始時間'),
    event_end_at: optionalIso(body.event_end_at, '活動結束時間'),
    event_location: optionalText(body.event_location, 200),
    event_note: optionalText(body.event_note),
    allowed_extensions: extensionsOf(body.allowed_extensions) ?? template?.allowed_extensions ?? null,
    max_files: optionalInt(body.max_files, 1, 20, '附件數量上限') ?? template?.max_files ?? null,
    max_file_size_mb: optionalInt(body.max_file_size_mb, 1, 20, '單檔大小上限') ?? template?.max_file_size_mb ?? null,
    allow_resubmit: false,
    submissions: [],
    reviews: [],
    created: now,
    updated: now,
  }
  const fresh = await loadApplication(pb, applicationId)
  await pb.collection('hk_applications').update(applicationId, { tasks_json: [...arr(fresh.tasks_json), task] })
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.create', targetId: applicationId, payload: { task: task.id } })
  await notifyTask(pb, application, task, {
    type: 'FOLLOW_UP_CREATED',
    title: '新的追蹤任務',
    message: task.due_at ? `請於 ${str(task.due_at).slice(0, 10)} 前完成繳交` : '請儘速完成繳交',
  })
  return json({ task: taskToPlain(task, fresh, { internal: true }), message: '追蹤任務已建立' })
}

const REVIEW_NOTICE: Record<string, { type: string; title: string; message: string }> = {
  approved: { type: 'FOLLOW_UP_APPROVED', title: '追蹤任務已通過', message: '承辦已審核通過' },
  supplement_required: { type: 'FOLLOW_UP_SUPPLEMENT', title: '追蹤任務需要補件', message: '請依承辦說明補件後重新繳交' },
  rejected: { type: 'FOLLOW_UP_REJECTED', title: '追蹤任務未通過', message: '承辦審核未通過' },
}

async function reviewTask({ pb, staff, body }: Ctx, id: string) {
  const { application, tasks, index, task } = await loadTaskContext(pb, id)
  const decision = str(body.decision)
  if (!DECISIONS.has(decision)) throw new WorkflowError(400, '審核決定無效')
  if (!REVIEWABLE.has(str(task.status))) throw new WorkflowError(400, '此任務目前不在待審狀態')
  const submissions = arr(task.submissions)
  const latestIndex = submissions.map((item) => item.status).lastIndexOf('submitted')
  if (latestIndex < 0) throw new WorkflowError(400, '尚無可審核的繳交')

  const studentMessage = optionalText(body.student_message)
  if (decision !== 'approved' && !studentMessage) throw new WorkflowError(400, '補件或駁回時請填寫給學生的說明')

  const now = nowIso()
  const allowResubmit = decision === 'supplement_required' || (decision === 'rejected' && body.allow_resubmit === true)
  const review: Row = {
    id: crypto.randomUUID(),
    task: id,
    submission: str(submissions[latestIndex].id),
    reviewer: staff.id,
    decision,
    internal_note: optionalText(body.internal_note),
    student_message: studentMessage,
    allow_resubmit: allowResubmit,
    created: now,
    updated: now,
  }
  const next: Row = {
    ...task,
    status: decision,
    completed_at: decision === 'approved' ? now : null,
    allow_resubmit: allowResubmit,
    submissions: submissions.map((item, i) => (i === latestIndex ? { ...item, status: decision, updated: now } : item)),
    reviews: [...arr(task.reviews), review],
    updated: now,
  }
  await saveTask(pb, application, tasks, index, next)
  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'follow_up.review',
    targetId: str(application.id),
    payload: { task: id, decision },
  })
  const notice = REVIEW_NOTICE[decision]
  await notifyTask(pb, application, next, {
    type: notice.type,
    title: notice.title,
    message: studentMessage ? `${notice.message}。${studentMessage}` : notice.message,
  })
  return json({ task: taskToPlain(next, application, { internal: true }), message: '審核完成' })
}

async function waiveTask({ pb, staff, body }: Ctx, id: string) {
  const { application, tasks, index, task } = await loadTaskContext(pb, id)
  const reason = optionalText(body.waive_reason, 500)
  if (!reason) throw new WorkflowError(400, '請填寫豁免原因')
  if (['approved', 'waived'].includes(str(task.status))) throw new WorkflowError(400, '此任務已完成，無需豁免')

  const now = nowIso()
  const next: Row = { ...task, status: 'waived', waive_reason: reason, completed_at: now, allow_resubmit: false, updated: now }
  await saveTask(pb, application, tasks, index, next)
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.waive', targetId: str(application.id), payload: { task: id, reason } })
  await notifyTask(pb, application, next, { type: 'FOLLOW_UP_WAIVED', title: '追蹤任務已豁免', message: '此任務無需再繳交' })
  return json({ task: taskToPlain(next, application, { internal: true }), message: '任務已豁免' })
}

async function updateDueAt({ pb, staff, body }: Ctx, id: string) {
  const { application, tasks, index, task } = await loadTaskContext(pb, id)
  if (['approved', 'waived'].includes(str(task.status))) throw new WorkflowError(400, '此任務已完成，不可調整截止日')
  const dueAt = optionalIso(body.due_at, '截止日期')
  const next: Row = { ...task, due_at: dueAt, updated: nowIso() }
  await saveTask(pb, application, tasks, index, next)
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.due_at', targetId: str(application.id), payload: { task: id, due_at: dueAt } })
  return json({ task: taskToPlain(next, application, { internal: true }), message: '截止日已更新' })
}

async function ensureTasks({ pb, staff }: Ctx, applicationId: string) {
  const application = await loadApplication(pb, applicationId)
  if (!TASK_OPEN_STATUSES.has(str(application.status))) {
    throw new WorkflowError(400, '案件核准後才可建立追蹤任務')
  }
  const result = await ensureFollowUpTasks(pb, application)
  if (result.created) {
    await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.ensure', targetId: applicationId, payload: { created: result.created } })
  }
  return json({
    seeded: result.seeded,
    created: result.created,
    items: result.tasks.map((task) => taskToPlain(task, application, { internal: true })),
  })
}

// ---------------------------------------------------------------------------
// Templates (hk_settings policy rows)
// ---------------------------------------------------------------------------

function templateValue(body: Row, base: Row): Row {
  return {
    name: body.name !== undefined ? str(body.name).trim().slice(0, 200) : base.name,
    code: base.code,
    description: body.description !== undefined ? optionalText(body.description) : base.description ?? null,
    task_type: body.task_type !== undefined ? taskTypeOf(body.task_type, 'other') : base.task_type ?? 'other',
    allowed_extensions: body.allowed_extensions !== undefined ? extensionsOf(body.allowed_extensions) : base.allowed_extensions ?? null,
    max_files: body.max_files !== undefined ? optionalInt(body.max_files, 1, 20, '附件數量上限') : base.max_files ?? null,
    max_file_size_mb:
      body.max_file_size_mb !== undefined ? optionalInt(body.max_file_size_mb, 1, 20, '單檔大小上限') : base.max_file_size_mb ?? null,
    requires_review: body.requires_review !== undefined ? body.requires_review !== false : base.requires_review !== false,
    required: body.required !== undefined ? body.required !== false : base.required !== false,
    default_due_offset_days:
      body.default_due_offset_days !== undefined
        ? optionalInt(body.default_due_offset_days, 0, 365, '預設期限天數')
        : base.default_due_offset_days ?? null,
    student_instructions: body.student_instructions !== undefined ? optionalText(body.student_instructions) : base.student_instructions ?? null,
    review_instructions: body.review_instructions !== undefined ? optionalText(body.review_instructions) : base.review_instructions ?? null,
  }
}

async function listTemplates({ pb }: Ctx) {
  return json({ items: await loadTemplates(pb) })
}

async function createTemplate({ pb, staff, body }: Ctx) {
  requireAdmin(staff)
  const code = str(body.code).trim().toLowerCase()
  if (!/^[a-z0-9_]{2,40}$/.test(code)) throw new WorkflowError(400, '代碼需為 2–40 個小寫英數或底線')
  const value = templateValue(body, { code })
  if (!value.name) throw new WorkflowError(400, '請填寫範本名稱')
  const existing = await pb.collection('hk_settings').getList(1, 1, {
    filter: pb.filter('key = {:key}', { key: `${TEMPLATE_KEY_PREFIX}${code}` }),
  })
  if (existing.items.length) throw new WorkflowError(400, '範本代碼已存在')
  const record = (await pb.collection('hk_settings').create({
    key: `${TEMPLATE_KEY_PREFIX}${code}`,
    setting_type: SETTING_TYPE,
    value_json: value,
    version: 1,
    status: 'active',
    active: body.active !== false,
  })) as Row
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.template_create', targetId: str(record.id), payload: { code } })
  return json({ template: templateFromSetting(record) })
}

async function loadSetting(pb: PocketBase, id: string, prefix: string): Promise<Row> {
  let record: Row
  try {
    record = (await pb.collection('hk_settings').getOne(id)) as Row
  } catch {
    throw new WorkflowError(404, '找不到設定')
  }
  if (!str(record.key).startsWith(prefix)) throw new WorkflowError(404, '找不到設定')
  return record
}

async function updateTemplate({ pb, staff, body }: Ctx, id: string) {
  requireAdmin(staff)
  const record = await loadSetting(pb, id, TEMPLATE_KEY_PREFIX)
  const current = templateFromSetting(record)
  const value = templateValue(body, current)
  if (!value.name) throw new WorkflowError(400, '請填寫範本名稱')
  const saved = (await pb.collection('hk_settings').update(id, {
    value_json: value,
    version: Number(record.version || 1) + 1,
    active: body.active !== undefined ? body.active !== false : record.active !== false,
  })) as Row
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.template_update', targetId: id, payload: { code: current.code } })
  return json({ template: templateFromSetting(saved) })
}

// ---------------------------------------------------------------------------
// Category assignments (hk_settings policy rows)
// ---------------------------------------------------------------------------

async function listAssignments({ pb, url }: Ctx) {
  const categoryId = url.searchParams.get('category_id')
  const items = (await loadAssignments(pb)).filter((item) => !categoryId || item.category === categoryId)
  return json({ items })
}

async function createAssignment({ pb, staff, body }: Ctx) {
  requireAdmin(staff)
  let categoryRecord: Row
  try {
    categoryRecord = (await pb.collection('hk_settings').getOne(str(body.category_id))) as Row
  } catch {
    throw new WorkflowError(400, '找不到申請項目')
  }
  if (categoryRecord.setting_type !== 'category') throw new WorkflowError(400, '找不到申請項目')
  const category = categoryFromSetting(categoryRecord)
  const templateId = str(body.task_template_id)
  if (!(await loadTemplates(pb)).some((item) => item.id === templateId)) throw new WorkflowError(400, '找不到追蹤範本')

  const key = `${ASSIGNMENT_KEY_PREFIX}${category.code}:${templateId}`
  const existing = await pb.collection('hk_settings').getList(1, 1, { filter: pb.filter('key = {:key}', { key }) })
  if (existing.items.length) throw new WorkflowError(400, '此申請項目已指派該範本')
  const record = (await pb.collection('hk_settings').create({
    key,
    setting_type: SETTING_TYPE,
    value_json: {
      category: category.id,
      category_code: category.code,
      task_template: templateId,
      required: body.required !== false,
      requires_review_override: body.requires_review_override === true,
      due_rule: body.due_rule && typeof body.due_rule === 'object' ? body.due_rule : null,
      sort_order: optionalInt(body.sort_order, 0, 999, '排序') ?? 0,
    },
    version: 1,
    status: 'active',
    active: body.active !== false,
  })) as Row
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.assignment_create', targetId: str(record.id), payload: { key } })
  return json({ assignment: assignmentFromSetting(record) })
}

async function updateAssignment({ pb, staff, body }: Ctx, id: string) {
  requireAdmin(staff)
  const record = await loadSetting(pb, id, ASSIGNMENT_KEY_PREFIX)
  const current = assignmentFromSetting(record)
  const value = {
    category: current.category,
    category_code: current.category_code,
    task_template: current.task_template,
    required: body.required !== undefined ? body.required !== false : current.required !== false,
    requires_review_override:
      body.requires_review_override !== undefined ? body.requires_review_override === true : current.requires_review_override === true,
    due_rule:
      body.due_rule !== undefined ? (body.due_rule && typeof body.due_rule === 'object' ? body.due_rule : null) : current.due_rule ?? null,
    sort_order: body.sort_order !== undefined ? optionalInt(body.sort_order, 0, 999, '排序') ?? 0 : current.sort_order,
  }
  const saved = (await pb.collection('hk_settings').update(id, {
    value_json: value,
    version: Number(record.version || 1) + 1,
    active: body.active !== undefined ? body.active !== false : record.active !== false,
  })) as Row
  await writeAudit(pb, { actorStaff: staff.id, action: 'follow_up.assignment_update', targetId: id, payload: {} })
  return json({ assignment: assignmentFromSetting(saved) })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const TASK_ID = '([a-z0-9]{15}-[a-f0-9]{16})'
const ID = '([a-z0-9]{15})'

type Route = {
  method: 'GET' | 'POST'
  pattern: RegExp
  handler: (ctx: Ctx, params: string[]) => Promise<Response>
}

const routes: Route[] = [
  { method: 'GET', pattern: /^\/api\/hk\/admin\/follow-up\/tasks$/, handler: (c) => listTasks(c) },
  { method: 'POST', pattern: /^\/api\/hk\/admin\/follow-up\/tasks$/, handler: (c) => createTask(c) },
  { method: 'GET', pattern: new RegExp(`^/api/hk/admin/follow-up/tasks/${TASK_ID}$`), handler: (c, [id]) => taskDetail(c, id) },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/follow-up/tasks/${TASK_ID}/review$`),
    handler: (c, [id]) => reviewTask(c, id),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/follow-up/tasks/${TASK_ID}/waive$`),
    handler: (c, [id]) => waiveTask(c, id),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/follow-up/tasks/${TASK_ID}/due-at$`),
    handler: (c, [id]) => updateDueAt(c, id),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/applications/${ID}/ensure-follow-up-tasks$`),
    handler: (c, [id]) => ensureTasks(c, id),
  },
  { method: 'GET', pattern: /^\/api\/hk\/admin\/follow-up\/templates$/, handler: (c) => listTemplates(c) },
  { method: 'POST', pattern: /^\/api\/hk\/admin\/follow-up\/templates$/, handler: (c) => createTemplate(c) },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/follow-up/templates/${ID}$`),
    handler: (c, [id]) => updateTemplate(c, id),
  },
  { method: 'GET', pattern: /^\/api\/hk\/admin\/follow-up\/category-templates$/, handler: (c) => listAssignments(c) },
  { method: 'POST', pattern: /^\/api\/hk\/admin\/follow-up\/category-templates$/, handler: (c) => createAssignment(c) },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/admin/follow-up/category-templates/${ID}$`),
    handler: (c, [id]) => updateAssignment(c, id),
  },
]

export async function handleAdminFollowUp(
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
    return await route.handler({ pb, staff, body, url: new URL(request.url) }, params)
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
