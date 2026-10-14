import type PocketBase from 'pocketbase'

import { notifyStudent, workflowOf } from './application-workflow'
import { attachmentsOf } from './attachments'

/**
 * Follow-up tasks on the six-collection schema.
 * Ported from legacy pb_hooks/hk_follow_up_lib.js.
 *
 * Tasks live in hk_applications.tasks_json[]; each keeps its own submissions[] and reviews[].
 * Task ids are "<application id>-<random hex>" so staff routes can load the owning record directly.
 * Templates and category assignments are hk_settings rows (setting_type SETTING_TYPE) keyed by
 * TEMPLATE_KEY_PREFIX / ASSIGNMENT_KEY_PREFIX.
 */

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

export const SETTING_TYPE = 'system'
export const TEMPLATE_KEY_PREFIX = 'follow_up_template:'
export const ASSIGNMENT_KEY_PREFIX = 'category_follow_up_template:'

export const TASK_TYPES = ['file_upload', 'text', 'file_and_text', 'event_attendance', 'confirmation', 'other']
export const DEFAULT_TASK_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx']

const STUDENT_SUBMITTABLE = new Set(['pending', 'supplement_required', 'overdue'])
const CLOSED = new Set(['approved', 'waived', 'rejected'])

export function newTaskId(applicationId: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `${applicationId}-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function applicationIdOfTask(taskId: string): string | null {
  const match = /^([a-z0-9]{15})-[a-f0-9]{16}$/.exec(taskId)
  return match ? match[1] : null
}

export function canStudentSubmit(task: Row): boolean {
  const status = str(task.status) || 'pending'
  return STUDENT_SUBMITTABLE.has(status) || (status === 'rejected' && task.allow_resubmit === true)
}

export function isOverdue(task: Row): boolean {
  const dueMs = Date.parse(str(task.due_at))
  return !Number.isNaN(dueMs) && dueMs < Date.now() && !CLOSED.has(str(task.status))
}

export function taskToPlain(task: Row, application: Row, opts: { internal?: boolean } = {}): Row {
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
    waive_reason: opts.internal ? (task.waive_reason ?? null) : undefined,
    id: str(task.id),
    application: str(application.id),
    student: str(application.student),
    application_number: str(application.application_number),
    category_name: str(application.category_name),
    name: str(task.name) || '追蹤任務',
    status: str(task.status) || 'pending',
    is_overdue: isOverdue(task),
  }
}

/** Active attachments uploaded for this task, newest last. */
export function taskAttachments(application: Row, taskId: string): Row[] {
  return attachmentsOf(application)
    .filter((entry) => entry.follow_up_task === taskId && entry.status === 'active')
    .map((entry) => ({
      id: str(entry.id),
      original_filename: str(entry.original_filename),
      mime_type: str(entry.mime_type),
      extension: str(entry.extension),
      size_bytes: Number(entry.size_bytes ?? 0),
      status: str(entry.status),
    }))
}

export function findTask(application: Row, taskId: string): { tasks: Row[]; index: number } {
  const tasks = arr(application.tasks_json)
  return { tasks, index: tasks.findIndex((task) => str(task.id) === taskId) }
}

export function templateFromSetting(record: Row): Row {
  const value = (record.value_json && typeof record.value_json === 'object' ? record.value_json : {}) as Row
  return {
    name: '',
    code: '',
    description: null,
    task_type: 'other',
    allowed_extensions: null,
    max_files: null,
    max_file_size_mb: null,
    requires_review: true,
    required: true,
    default_due_offset_days: null,
    student_instructions: null,
    review_instructions: null,
    ...value,
    id: str(record.id),
    active: record.active !== false,
    created: str(record.created),
    updated: str(record.updated),
  }
}

export function assignmentFromSetting(record: Row): Row {
  const value = (record.value_json && typeof record.value_json === 'object' ? record.value_json : {}) as Row
  return {
    category: '',
    category_code: '',
    task_template: '',
    required: true,
    requires_review_override: false,
    due_rule: null,
    sort_order: 0,
    ...value,
    id: str(record.id),
    active: record.active !== false,
    created: str(record.created),
    updated: str(record.updated),
  }
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

/** Build a task from a template, applying a category assignment's overrides. */
export function taskFromTemplate(applicationId: string, template: Row, assignment: Row | null): Row {
  const dueRule = (assignment?.due_rule && typeof assignment.due_rule === 'object' ? assignment.due_rule : {}) as Row
  const offset =
    dueRule.offset_days != null ? Number(dueRule.offset_days) : template.default_due_offset_days != null ? Number(template.default_due_offset_days) : NaN
  let requiresReview = template.requires_review !== false
  if (typeof dueRule.requires_review === 'boolean') requiresReview = dueRule.requires_review
  else if (assignment?.requires_review_override === true) requiresReview = true
  const now = new Date().toISOString()
  return {
    id: newTaskId(applicationId),
    template: str(template.id) || null,
    name: str(template.name) || '追蹤任務',
    task_type: str(template.task_type) || 'other',
    description: template.description ?? null,
    required: assignment && assignment.required != null ? assignment.required === true : template.required !== false,
    requires_review: requiresReview,
    due_at: Number.isFinite(offset) ? addDaysIso(offset) : null,
    status: 'pending',
    completed_at: null,
    created_by: null,
    student_instructions: template.student_instructions ?? null,
    allowed_extensions: template.allowed_extensions ?? null,
    max_files: template.max_files ?? null,
    max_file_size_mb: template.max_file_size_mb ?? null,
    allow_resubmit: false,
    submissions: [],
    reviews: [],
    created: now,
    updated: now,
  }
}

export async function loadTemplates(pb: PocketBase): Promise<Row[]> {
  const rows = (await pb.collection('hk_settings').getFullList({
    filter: pb.filter('setting_type = {:type} && key ~ {:prefix}', { type: SETTING_TYPE, prefix: `${TEMPLATE_KEY_PREFIX}%` }),
    sort: 'created',
  })) as Row[]
  return rows.map(templateFromSetting)
}

export async function loadAssignments(pb: PocketBase): Promise<Row[]> {
  const rows = (await pb.collection('hk_settings').getFullList({
    filter: pb.filter('setting_type = {:type} && key ~ {:prefix}', { type: SETTING_TYPE, prefix: `${ASSIGNMENT_KEY_PREFIX}%` }),
    sort: 'created',
  })) as Row[]
  return rows.map(assignmentFromSetting)
}

export async function notifyTask(
  pb: PocketBase,
  application: Row,
  task: Row,
  input: { type: string; title: string; message: string },
): Promise<void> {
  await notifyStudent(pb, {
    studentId: str(application.student),
    applicationId: str(application.id),
    notificationType: input.type,
    uiCategory: 'follow_up',
    title: input.title,
    message: `${str(task.name) || '追蹤任務'}：${input.message}`,
    actionUrl: `/student/tasks/${str(task.id)}`,
    followUpTaskId: str(task.id),
  })
}

/**
 * Create the category's default tasks once per application.
 * Idempotent through workflow_json.follow_up_tasks_seeded and one task per template.
 */
export async function ensureFollowUpTasks(
  pb: PocketBase,
  application: Row,
): Promise<{ seeded: boolean; created: number; tasks: Row[] }> {
  const workflow = workflowOf(application)
  const existing = arr(application.tasks_json)
  if (workflow.follow_up_tasks_seeded === true) return { seeded: true, created: 0, tasks: existing }

  const categoryCode = str(application.category_code)
  const [templates, assignments] = await Promise.all([loadTemplates(pb), loadAssignments(pb)])
  const byId = new Map(templates.map((template) => [str(template.id), template]))
  const usedTemplates = new Set(existing.map((task) => str(task.template)).filter(Boolean))
  const created: Row[] = []
  for (const assignment of assignments
    .filter((item) => item.active && str(item.category_code) === categoryCode)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))) {
    const template = byId.get(str(assignment.task_template))
    if (!template || !template.active || usedTemplates.has(str(template.id))) continue
    usedTemplates.add(str(template.id))
    created.push(taskFromTemplate(str(application.id), template, assignment))
  }

  const tasks = [...existing, ...created]
  await pb.collection('hk_applications').update(str(application.id), {
    tasks_json: tasks,
    workflow_json: { ...workflow, follow_up_tasks_seeded: true },
  })
  for (const task of created) {
    await notifyTask(pb, application, task, { type: 'FOLLOW_UP_CREATED', title: '新的追蹤任務', message: '請於期限內完成繳交' })
  }
  return { seeded: true, created: created.length, tasks }
}
