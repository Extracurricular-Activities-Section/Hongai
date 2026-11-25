import type PocketBase from 'pocketbase'

import {
  WorkflowError,
  notifyStudent,
  nowIso,
  studentActionUrl,
  workflowOf,
  writeAudit,
} from '../lib/application-workflow'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { requireStudent, type StudentRecord } from '../lib/auth-student'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import { publicErrorMessage } from '../lib/public-error'
import { assertStaffCanAccessApplication } from '../lib/staff-application-access'
import {
  assertSignable,
  findTeacherEmail,
  isValidEmail,
  parseStudentSignature,
  parseTeacherSignature,
  signaturesView,
} from '../lib/signatures'

/**
 * E-signature routes (canvas PNG + attestation), stored on hk_applications.workflow_json.signatures.
 *
 *   GET  /api/hk/applications/:id/signatures         student (own) — student signature + teacher status
 *   POST /api/hk/applications/:id/signatures         body.role = "student" | "teacher" (teacher = staff)
 *   POST /api/hk/applications/:id/notify-teacher     body.actor = "student" | "staff" (default staff)
 *   GET  /api/hk/admin/applications/:id/signatures   staff — both signature images
 *
 * Mail delivery: the Worker has no mail provider wired yet, so the email leg is recorded as an
 * hk_events "email_log" row with status "skipped" (honest — never "sent") and the in-app leg is
 * delivered to the student's inbox. Wire a provider by replacing sendTeacherEmail().
 */

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

const ID = '([a-z0-9]{15})'
const NOTIFY_COOLDOWN_MS = 60_000

async function loadApplication(pb: PocketBase, id: string): Promise<Row> {
  try {
    return (await pb.collection('hk_applications').getOne(id, { expand: 'student' })) as Row
  } catch {
    throw new WorkflowError(404, '找不到申請資料')
  }
}

async function loadForm(pb: PocketBase, application: Row): Promise<Row | null> {
  try {
    return (await pb.collection('hk_forms').getOne(str(application.form))) as Row
  } catch {
    return null
  }
}

async function loadOwn(pb: PocketBase, student: StudentRecord, id: string): Promise<Row> {
  const application = await loadApplication(pb, id)
  if (application.student !== student.id) throw new WorkflowError(403, '無權限')
  return application
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

async function saveStudentSignature(
  pb: PocketBase,
  student: StudentRecord,
  id: string,
  body: Row,
  request: Request,
) {
  const application = await loadOwn(pb, student, id)
  assertSignable(application)
  const entry = parseStudentSignature(body, request)

  const workflow = { ...workflowOf(application) }
  workflow.signatures = { ...obj(workflow.signatures), student: entry }
  const saved = (await pb.collection('hk_applications').update(id, { workflow_json: workflow })) as Row
  await writeAudit(pb, {
    actorStudent: student.id,
    action: 'STUDENT_SIGNATURE_SAVED',
    targetId: id,
    payload: { signer_name: entry.signer_name, signed_at: entry.signed_at },
  })
  return json({ signatures: signaturesView(saved, true), message: '學生簽名已儲存' })
}

async function saveTeacherSignature(
  pb: PocketBase,
  staff: StaffAuthContext,
  id: string,
  body: Row,
  request: Request,
) {
  const application = await loadApplication(pb, id)
  if (str(application.status) === 'draft') throw new WorkflowError(404, '找不到案件')
  await assertStaffCanAccessApplication(pb, staff, application, 'write')
  assertSignable(application)
  const entry = parseTeacherSignature(body, request, staff.id)

  const workflow = { ...workflowOf(application) }
  const form = await loadForm(pb, application)
  const email = findTeacherEmail(application, form, str(entry.signer_email))
  entry.signer_email = email
  workflow.signatures = { ...obj(workflow.signatures), teacher: entry }
  if (email) workflow.teacher_email = email

  const saved = (await pb.collection('hk_applications').update(id, { workflow_json: workflow })) as Row
  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'TEACHER_SIGNATURE_REGISTERED',
    targetId: id,
    payload: { signer_name: entry.signer_name, method: entry.method },
  })
  return json({ signatures: signaturesView(saved, true), message: '老師簽名已登記' })
}

// ---------------------------------------------------------------------------
// Notify teacher
// ---------------------------------------------------------------------------

/** Placeholder transport: no mail provider is configured, so nothing is sent. */
async function sendTeacherEmail(
  _env: WorkerEnv,
  _message: { to: string; subject: string; body: string },
): Promise<{ status: 'skipped'; error_code: string; error_message: string }> {
  return {
    status: 'skipped',
    error_code: 'mail_provider_disabled',
    error_message: '郵件寄送尚未啟用，已記錄為略過（站內通知仍已送出）',
  }
}

async function notifyTeacher(
  pb: PocketBase,
  env: WorkerEnv,
  actor: { type: 'student'; student: StudentRecord } | { type: 'staff'; staff: StaffAuthContext },
  id: string,
  body: Row,
) {
  const application =
    actor.type === 'student' ? await loadOwn(pb, actor.student, id) : await loadApplication(pb, id)
  if (actor.type === 'staff') {
    await assertStaffCanAccessApplication(pb, actor.staff, application, 'write')
  }
  if (str(application.status) === 'draft') throw new WorkflowError(400, '請先送交承辦後再通知導師')
  assertSignable(application)

  const workflow = { ...workflowOf(application) }
  const history = arr(workflow.teacher_notifications)
  const last = history[history.length - 1]
  if (last && Date.now() - Date.parse(str(last.created)) < NOTIFY_COOLDOWN_MS) {
    throw new WorkflowError(429, '剛寄出通知，請稍候一分鐘再試')
  }

  const form = await loadForm(pb, application)
  const requested = str(body.teacher_email).trim()
  if (requested && !isValidEmail(requested)) throw new WorkflowError(400, '導師 email 格式不正確')
  const email = findTeacherEmail(application, form, requested)
  if (!email) throw new WorkflowError(400, '找不到導師 email，請填寫導師 email')

  const studentRow = obj(obj(application.expand).student)
  const studentName =
    actor.type === 'student' ? str(actor.student.name) : str(studentRow.name) || '學生'
  const number = str(application.application_number)
  const category = str(application.category_name)
  const subject = `【弘愛築夢】請協助簽核學生申請：${studentName}（${number}）`
  const text = [
    `老師您好：`,
    ``,
    `學生 ${studentName} 已送出「${category}」申請（申請編號 ${number}），`,
    `請協助於系統完成簽核確認（電子簽即可；紙本僅備援）。`,
    ``,
    `如已完成簽核，請忽略此信。謝謝您的協助。`,
    `弘愛築夢申請系統`,
  ].join('\n')

  const delivery = await sendTeacherEmail(env, { to: email, subject, body: text })
  const now = nowIso()
  const actorFields =
    actor.type === 'student' ? { actor_student: actor.student.id } : { actor_staff: actor.staff.id }

  let emailEventId: string | null = null
  try {
    const event = (await pb.collection('hk_events').create({
      event_type: 'email_log',
      event_key: 'TEACHER_SIGNATURE_REQUEST',
      ...actorFields,
      target_type: 'application',
      target_id: id,
      recipient_json: { email, student: str(application.student) },
      payload_json: {
        template: 'teacher_signature_request',
        channel: 'email',
        recipient: email,
        subject,
        provider: null,
        status_detail: delivery.status,
        attempt_count: 0,
        error_code: delivery.error_code,
        error_message: delivery.error_message,
        application: id,
        rendered_body: text,
      },
      status: delivery.status,
      occurred_at: now,
    })) as Row
    emailEventId = str(event.id)
  } catch {
    // log is best-effort
  }

  workflow.teacher_email = email
  workflow.teacher_notifications = [
    ...history,
    {
      id: crypto.randomUUID(),
      email,
      channel_in_app: true,
      channel_email: delivery.status,
      email_event: emailEventId,
      requested_by_type: actor.type,
      requested_by: actor.type === 'student' ? actor.student.id : actor.staff.id,
      created: now,
    },
  ]
  await pb.collection('hk_applications').update(id, { workflow_json: workflow })

  await notifyStudent(pb, {
    studentId: str(application.student),
    applicationId: id,
    notificationType: 'TEACHER_SIGNATURE_REQUESTED',
    uiCategory: 'application',
    title: '已通知導師簽核',
    message: `${category} 申請（${number}）：已通知導師 ${email} 協助簽核`,
    actionUrl: studentActionUrl(application),
  })
  await writeAudit(pb, {
    actorStaff: actor.type === 'staff' ? actor.staff.id : undefined,
    actorStudent: actor.type === 'student' ? actor.student.id : undefined,
    action: 'TEACHER_SIGNATURE_NOTIFIED',
    targetId: id,
    payload: { email, email_status: delivery.status },
  })

  return json({
    teacher_email: email,
    in_app: { status: 'sent' },
    email: { status: delivery.status, error_code: delivery.error_code, message: delivery.error_message },
    message:
      delivery.status === 'skipped'
        ? '已記錄通知（站內已送出；郵件尚未啟用，已略過寄信）'
        : '已通知導師',
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const SIGN_PATH = new RegExp(`^/api/hk/applications/${ID}/signatures$`)
const NOTIFY_PATH = new RegExp(`^/api/hk/applications/${ID}/notify-teacher$`)
const ADMIN_SIGN_PATH = new RegExp(`^/api/hk/admin/applications/${ID}/signatures$`)

function failure(err: unknown): Response {
  if (err instanceof WorkflowError) {
    return json({ error: 'request_failed', message: err.message }, { status: err.status })
  }
  return json(
    { error: 'pb_error', message: publicErrorMessage('操作失敗，請稍後再試', err) },
    { status: 502 },
  )
}

export async function handleSignatures(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  const sign = path.match(SIGN_PATH)
  const notify = path.match(NOTIFY_PATH)
  const adminSign = path.match(ADMIN_SIGN_PATH)
  const isGet = request.method === 'GET'
  const isPost = request.method === 'POST'
  if (!((sign && (isGet || isPost)) || (notify && isPost) || (adminSign && isGet))) return null

  const body = isPost ? (((await request.json().catch(() => ({}))) as Row) ?? {}) : {}

  // Authenticate first (cheap), then open the service account.
  let student: StudentRecord | null = null
  let staff: StaffAuthContext | null = null
  const wantsStaff =
    Boolean(adminSign) ||
    (sign && isPost && str(body.role) === 'teacher') ||
    (notify && str(body.actor) !== 'student')

  if (wantsStaff) {
    const auth = await requireStaff(request, env)
    if (auth instanceof Response) return auth
    staff = auth
  } else {
    const auth = await requireStudent(request, env)
    if (auth instanceof Response) return auth
    student = auth
  }

  let pb: PocketBase
  try {
    pb = await createServicePb(env)
  } catch (err) {
    return json(
      {
        error: 'service_account_required',
        message: publicErrorMessage('系統服務未設定，請聯絡承辦。', err),
      },
      { status: 503 },
    )
  }

  try {
    if (adminSign && staff) {
      const application = await loadApplication(pb, adminSign[1])
      if (str(application.status) === 'draft') throw new WorkflowError(404, '找不到案件')
      await assertStaffCanAccessApplication(pb, staff, application, 'read')
      // FIX-07: default metadata only; ?include_image=1 for full PNG when needed.
      const includeImage = new URL(request.url).searchParams.get('include_image') === '1'
      return json({ signatures: signaturesView(application, includeImage) })
    }

    if (sign) {
      const id = sign[1]
      if (isGet && student) {
        const application = await loadOwn(pb, student, id)
        const view = signaturesView(application, true)
        return json({
          signatures: {
            ...view,
            teacher: view.teacher ? { ...view.teacher, signature_data_url: undefined } : null,
          },
          default_signer_name: str(student.name),
          teacher_email: findTeacherEmail(application, await loadForm(pb, application)),
        })
      }
      if (isPost && student) return await saveStudentSignature(pb, student, id, body, request)
      if (isPost && staff) return await saveTeacherSignature(pb, staff, id, body, request)
    }

    if (notify) {
      const id = notify[1]
      if (student) return await notifyTeacher(pb, env, { type: 'student', student }, id, body)
      if (staff) return await notifyTeacher(pb, env, { type: 'staff', staff }, id, body)
    }
  } catch (err) {
    return failure(err)
  }
  return null
}
