import type PocketBase from 'pocketbase'

import { requireStudent, type StudentRecord } from '../lib/auth-student'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * Student notifications and follow-up tasks on the six-collection schema.
 *
 * Notifications are hk_events (event_type="notification"); the recipient lives in
 * recipient_json.student, display fields in payload_json, read state in status ("unread" | "read").
 * Preferences are stored on hk_students.profile_json.notification_preferences.
 * Follow-up tasks live in hk_applications.tasks_json; each task keeps its own submissions/reviews.
 */

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; student: StudentRecord; body: Row; url: URL }

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const nowIso = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function isRecipient(record: Row, studentId: string): boolean {
  const recipient = obj(record.recipient_json)
  return str(recipient.student) === studentId || str(recipient.student_id) === studentId
}

function notificationToPlain(record: Row, studentId: string): Row {
  const payload = obj(record.payload_json)
  return {
    id: str(record.id),
    recipient_student: studentId,
    recipient_staff: null,
    notification_type: str(payload.notification_type) || str(record.event_key) || 'system',
    title: str(payload.title) || '系統通知',
    message: str(payload.message),
    application: str(payload.application) || str(record.target_id) || null,
    follow_up_task: str(payload.follow_up_task) || null,
    supplement_request: str(payload.supplement_request) || null,
    action_url: str(payload.action_url) || null,
    read_at: str(payload.read_at) || null,
    status: str(record.status) || 'unread',
    ui_category: str(payload.ui_category) || null,
    created: str(record.created),
    updated: str(record.updated),
  }
}

async function studentNotifications(pb: PocketBase, studentId: string, extra = ''): Promise<Row[]> {
  const filter = [
    'event_type = "notification"',
    pb.filter('recipient_json ~ {:sid}', { sid: studentId }),
    extra,
  ]
    .filter(Boolean)
    .join(' && ')
  const page = await pb.collection('hk_events').getList(1, 200, { filter, sort: '-created' })
  return (page.items as Row[]).filter((record) => isRecipient(record, studentId))
}

async function listNotifications({ pb, student, url }: Ctx) {
  const unreadOnly = url.searchParams.get('filter') === 'unread'
  const category = url.searchParams.get('category')
  const rows = await studentNotifications(pb, student.id, unreadOnly ? 'status = "unread"' : '')
  const items = rows
    .map((row) => notificationToPlain(row, student.id))
    .filter((item) => !category || category === 'all' || item.ui_category === category)
  return json({ items })
}

async function unreadCount({ pb, student }: Ctx) {
  const rows = await studentNotifications(pb, student.id, 'status = "unread"')
  return json({ count: rows.length })
}

async function markRead(pb: PocketBase, record: Row, readAt: string) {
  return (await pb.collection('hk_events').update(str(record.id), {
    status: 'read',
    payload_json: { ...obj(record.payload_json), read_at: readAt },
  })) as Row
}

async function readOne({ pb, student }: Ctx, id: string) {
  let record: Row
  try {
    record = (await pb.collection('hk_events').getOne(id)) as Row
  } catch {
    throw new HttpError(404, '找不到通知')
  }
  if (record.event_type !== 'notification' || !isRecipient(record, student.id)) {
    throw new HttpError(404, '找不到通知')
  }
  const updated = record.status === 'read' ? record : await markRead(pb, record, nowIso())
  return json({ notification: notificationToPlain(updated, student.id), message: '已標示為已讀' })
}

async function readAll({ pb, student }: Ctx) {
  const rows = await studentNotifications(pb, student.id, 'status = "unread"')
  const readAt = nowIso()
  for (const row of rows) await markRead(pb, row, readAt)
  return json({ updated: rows.length, message: rows.length ? '已全部標示為已讀' : '沒有未讀通知' })
}

const DEFAULT_PREFERENCES = {
  email_enabled: true,
  in_app_enabled: true,
  event_reminders: true,
  follow_up_reminders: true,
}
const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES) as Array<keyof typeof DEFAULT_PREFERENCES>

function preferencesToPlain(studentId: string, stored: Row): Row {
  return {
    id: `${studentId}:notification_preferences`,
    student: studentId,
    ...DEFAULT_PREFERENCES,
    ...Object.fromEntries(
      PREFERENCE_KEYS.filter((key) => typeof stored[key] === 'boolean').map((key) => [key, stored[key]]),
    ),
    system_critical_email: true,
    created: str(stored.created),
    updated: str(stored.updated),
  }
}

async function getPreferences({ student }: Ctx) {
  const stored = obj(obj(student.profile_json).notification_preferences)
  return json({ preferences: preferencesToPlain(student.id, stored) })
}

async function updatePreferences({ pb, student, body }: Ctx) {
  const fresh = (await pb.collection('hk_students').getOne(student.id)) as Row
  const profile = obj(fresh.profile_json)
  const current = obj(profile.notification_preferences)
  const now = nowIso()
  const next: Row = { ...current, created: str(current.created) || now, updated: now }
  for (const key of PREFERENCE_KEYS) {
    if (typeof body[key] === 'boolean') next[key] = body[key]
  }
  await pb.collection('hk_students').update(student.id, {
    profile_json: { ...profile, notification_preferences: next },
  })
  return json({ preferences: preferencesToPlain(student.id, next), message: '已更新通知偏好' })
}

// ---------------------------------------------------------------------------
// Follow-up tasks
// ---------------------------------------------------------------------------

const SUBMITTABLE = new Set(['pending', 'supplement_required', 'overdue'])

function taskToPlain(task: Row, application: Row): Row {
  const dueMs = Date.parse(str(task.due_at))
  const status = str(task.status) || 'pending'
  return {
    template: null,
    task_type: 'other',
    description: null,
    required: true,
    requires_review: true,
    due_at: null,
    completed_at: null,
    created_by: null,
    student_instructions: null,
    event_start_at: null,
    event_end_at: null,
    event_location: null,
    event_note: null,
    allow_resubmit: false,
    max_files: null,
    max_file_size_mb: null,
    allowed_extensions: null,
    created: str(application.created),
    updated: str(application.updated),
    ...task,
    submissions: undefined,
    reviews: undefined,
    id: str(task.id),
    application: str(application.id),
    student: str(application.student),
    name: str(task.name) || '追蹤任務',
    status,
    is_overdue: !Number.isNaN(dueMs) && dueMs < Date.now() && SUBMITTABLE.has(status),
  }
}

async function ownApplications(pb: PocketBase, studentId: string, applicationId?: string | null) {
  const filter = [
    pb.filter('student = {:sid}', { sid: studentId }),
    applicationId ? pb.filter('id = {:id}', { id: applicationId }) : '',
  ]
    .filter(Boolean)
    .join(' && ')
  return (await pb.collection('hk_applications').getFullList({
    filter,
    fields: 'id,student,tasks_json,created,updated',
  })) as Row[]
}

async function findTask(pb: PocketBase, studentId: string, taskId: string) {
  for (const application of await ownApplications(pb, studentId)) {
    const tasks = arr(application.tasks_json)
    const index = tasks.findIndex((task) => str(task.id) === taskId)
    if (index >= 0) return { application, tasks, index }
  }
  throw new HttpError(404, '找不到追蹤任務')
}

async function listTasks({ pb, student, url }: Ctx) {
  const rows = await ownApplications(pb, student.id, url.searchParams.get('application_id'))
  const items = rows.flatMap((row) => arr(row.tasks_json).map((task) => taskToPlain(task, row)))
  return json({ items })
}

async function taskDetail({ pb, student }: Ctx, id: string) {
  const { application, tasks, index } = await findTask(pb, student.id, id)
  const task = tasks[index]
  return json({
    task: taskToPlain(task, application),
    submissions: arr(task.submissions),
    attachments: [],
    reviews: arr(task.reviews).map((review) => ({ ...review, internal_note: undefined })),
  })
}

async function submitTask({ pb, student, body }: Ctx, id: string) {
  const { application, tasks, index } = await findTask(pb, student.id, id)
  const task = tasks[index]
  const status = str(task.status) || 'pending'
  const canResubmit = status === 'rejected' && task.allow_resubmit === true
  if (!SUBMITTABLE.has(status) && !canResubmit) throw new HttpError(400, '此任務目前不可繳交')

  const text = str(body.text_content).trim()
  if (!text) throw new HttpError(400, '請填寫繳交內容（附件上傳尚未開放）')

  const now = nowIso()
  const dueMs = Date.parse(str(task.due_at))
  const submissions = arr(task.submissions)
  const submission = {
    id: crypto.randomUUID(),
    task: id,
    student: student.id,
    submission_version: submissions.length + 1,
    text_content: text,
    status: 'submitted',
    submitted_at: now,
    is_overdue_at_submit: !Number.isNaN(dueMs) && dueMs < Date.now(),
    created: now,
    updated: now,
  }
  const nextTask: Row = {
    ...task,
    status: task.requires_review === false ? 'approved' : 'submitted',
    completed_at: task.requires_review === false ? now : task.completed_at ?? null,
    submissions: [...submissions, submission],
    updated: now,
  }
  const nextTasks = tasks.map((item, i) => (i === index ? nextTask : item))
  await pb.collection('hk_applications').update(str(application.id), { tasks_json: nextTasks })
  return json({ task: taskToPlain(nextTask, application), message: '已繳交' })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type Route = {
  method: 'GET' | 'POST'
  pattern: RegExp
  handler: (ctx: Ctx, params: string[]) => Promise<Response>
}

const routes: Route[] = [
  { method: 'GET', pattern: /^\/api\/hk\/notifications$/, handler: listNotifications },
  { method: 'GET', pattern: /^\/api\/hk\/notifications\/unread-count$/, handler: unreadCount },
  { method: 'POST', pattern: /^\/api\/hk\/notifications\/read-all$/, handler: readAll },
  { method: 'GET', pattern: /^\/api\/hk\/notifications\/preferences$/, handler: getPreferences },
  { method: 'POST', pattern: /^\/api\/hk\/notifications\/preferences$/, handler: updatePreferences },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/notifications\/([^/]+)\/read$/,
    handler: (ctx, [id]) => readOne(ctx, id),
  },
  { method: 'GET', pattern: /^\/api\/hk\/follow-up\/tasks$/, handler: listTasks },
  {
    method: 'GET',
    pattern: /^\/api\/hk\/follow-up\/tasks\/([^/]+)$/,
    handler: (ctx, [id]) => taskDetail(ctx, id),
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/follow-up\/tasks\/([^/]+)\/submit$/,
    handler: (ctx, [id]) => submitTask(ctx, id),
  },
]

export async function handleStudentInbox(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  let params: string[] = []
  const route = routes.find((candidate) => {
    if (candidate.method !== request.method) return false
    const match = path.match(candidate.pattern)
    if (!match) return false
    params = match.slice(1).map(decodeURIComponent)
    return true
  })
  if (!route) return null

  const student = await requireStudent(request, env)
  if (student instanceof Response) return student

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
    return await route.handler({ pb, student, body, url: new URL(request.url) }, params)
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: 'request_failed', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '操作失敗' },
      { status: 502 },
    )
  }
}
