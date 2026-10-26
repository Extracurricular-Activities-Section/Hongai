/**
 * Identity-reset requests + student unlock.
 *
 * Storage: hk_events with event_type="auth", event_key="identity_reset".
 * Payload holds the request fields; event.status is the workflow status.
 */

import type PocketBase from 'pocketbase'

import { nowIso } from '../lib/application-workflow'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

type Row = Record<string, unknown>

const UNIFORM = '已收到申請，如資料可核對，承辦人員將協助處理。'
const ALLOWED_STATUS = new Set(['pending', 'processing', 'approved', 'rejected', 'closed'])
const STATUS_LABEL: Record<string, string> = {
  approved: '已核准',
  rejected: '未核准',
  closed: '已結案',
}

const str = (value: unknown): string => (value == null ? '' : String(value)).trim()
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

function clientMeta(request: Request) {
  return {
    ip:
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      '',
    user_agent: request.headers.get('User-Agent') || '',
  }
}

function toPlain(record: Row): Row {
  const payload = obj(record.payload_json)
  return {
    id: str(record.id),
    created: str(record.created),
    updated: str(record.updated),
    student_no: str(payload.student_no),
    name: str(payload.name),
    email: str(payload.email),
    phone: str(payload.phone),
    reason: str(payload.reason),
    status: str(record.status) || 'pending',
    resolution_note: payload.resolution_note ? str(payload.resolution_note) : null,
    resolved_at: payload.resolved_at ? str(payload.resolved_at) : null,
    resolved_by: payload.resolved_by ? str(payload.resolved_by) : null,
    created_student: payload.created_student ? str(payload.created_student) : null,
  }
}

async function writeAudit(
  pb: PocketBase,
  input: {
    actorStaff?: string
    action: string
    targetId: string
    ip?: string
    userAgent?: string
    payload?: Row
  },
) {
  try {
    await pb.collection('hk_events').create({
      event_type: 'audit',
      event_key: input.action,
      actor_staff: input.actorStaff || null,
      target_type: 'identity_reset',
      target_id: input.targetId,
      payload_json: input.payload ?? {},
      occurred_at: nowIso(),
      ip: input.ip || '',
      user_agent: input.userAgent || '',
    })
  } catch {
    // audit is best-effort
  }
}

async function notifyProcessed(
  pb: PocketBase,
  record: Row,
  status: string,
  resolutionNote: string,
) {
  const payload = obj(record.payload_json)
  const studentId = str(payload.created_student)
  if (!studentId) return
  if (status !== 'approved' && status !== 'rejected' && status !== 'closed') return

  try {
    await pb.collection('hk_events').create({
      event_type: 'notification',
      event_key: 'identity_reset_processed',
      actor_student: studentId,
      target_type: 'identity_reset',
      target_id: str(record.id),
      recipient_json: { student: studentId },
      payload_json: {
        notification_type: 'identity_reset_processed',
        ui_category: 'system',
        title: '身分重設申請已處理',
        message: `您的身分重設申請結果：${STATUS_LABEL[status] || status}${
          resolutionNote ? `。${resolutionNote}` : ''
        }`,
        action_url: '/help',
        read_at: null,
      },
      status: 'unread',
      occurred_at: nowIso(),
    })
  } catch {
    // notification is best-effort (mail deferred)
  }
}

async function servicePb(env: WorkerEnv): Promise<PocketBase | Response> {
  try {
    return await createServicePb(env)
  } catch (err) {
    return json(
      {
        error: 'service_account_required',
        message: err instanceof Error ? err.message : 'Service account required',
      },
      { status: 503 },
    )
  }
}

async function handlePublicCreate(request: Request, env: WorkerEnv): Promise<Response> {
  let body: Row
  try {
    body = (await request.json()) as Row
  } catch {
    return json({ message: UNIFORM }, { status: 400 })
  }

  const name = str(body.name)
  const studentNo = str(body.student_no)
  const email = str(body.email)
  const phone = str(body.phone)
  const reason = str(body.reason)
  if (!name || !studentNo || !email || !phone || !reason) {
    return json({ message: UNIFORM }, { status: 400 })
  }

  const pb = await servicePb(env)
  if (pb instanceof Response) return pb

  const meta = clientMeta(request)
  let createdStudentId = ''
  try {
    const student = (await pb.collection('hk_students').getFirstListItem(
      pb.filter('student_no = {:no}', { no: studentNo }),
      { fields: 'id' },
    )) as Row
    createdStudentId = str(student.id)
  } catch {
    // do not reveal whether the student exists
  }

  try {
    const record = (await pb.collection('hk_events').create({
      event_type: 'auth',
      event_key: 'identity_reset',
      actor_student: createdStudentId || null,
      target_type: 'identity_reset',
      target_id: createdStudentId || studentNo,
      recipient_json: { email, phone },
      payload_json: {
        student_no: studentNo,
        name,
        email,
        phone,
        reason: reason.slice(0, 2000),
        created_student: createdStudentId || null,
        resolution_note: null,
        resolved_by: null,
        resolved_at: null,
      },
      status: 'pending',
      occurred_at: nowIso(),
      ip: meta.ip,
      user_agent: meta.user_agent,
    })) as Row

    await writeAudit(pb, {
      action: 'IDENTITY_RESET_REQUESTED',
      targetId: str(record.id),
      ip: meta.ip,
      userAgent: meta.user_agent,
      payload: { linked: Boolean(createdStudentId) },
    })
  } catch {
    return json({ error: 'create_failed', message: '送出失敗，請稍後再試。' }, { status: 502 })
  }

  return json({ message: UNIFORM })
}

async function handleAdminList(
  request: Request,
  env: WorkerEnv,
  staff: StaffAuthContext,
): Promise<Response> {
  void staff
  const pb = await servicePb(env)
  if (pb instanceof Response) return pb

  const status = new URL(request.url).searchParams.get('status')?.trim() || ''
  const parts = [
    'event_type = "auth"',
    'event_key = "identity_reset"',
    status ? pb.filter('status = {:status}', { status }) : '',
  ].filter(Boolean)
  try {
    const page = await pb.collection('hk_events').getList(1, 100, {
      filter: parts.join(' && '),
      sort: '-created',
    })
    return json({ items: (page.items as Row[]).map(toPlain) })
  } catch (err) {
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '讀取失敗' },
      { status: 502 },
    )
  }
}

async function handleAdminStatus(
  request: Request,
  env: WorkerEnv,
  staff: StaffAuthContext,
  id: string,
): Promise<Response> {
  let body: Row
  try {
    body = (await request.json()) as Row
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
  }

  const status = str(body.status)
  const resolutionNote = str(body.resolution_note).slice(0, 2000)
  if (!ALLOWED_STATUS.has(status)) {
    return json({ error: 'bad_request', message: '狀態無效' }, { status: 400 })
  }

  const pb = await servicePb(env)
  if (pb instanceof Response) return pb

  let record: Row
  try {
    record = (await pb.collection('hk_events').getOne(id)) as Row
  } catch {
    return json({ error: 'not_found', message: '找不到申請' }, { status: 404 })
  }
  if (str(record.event_type) !== 'auth' || str(record.event_key) !== 'identity_reset') {
    return json({ error: 'not_found', message: '找不到申請' }, { status: 404 })
  }

  const resolvedAt = nowIso()
  const nextPayload = {
    ...obj(record.payload_json),
    resolution_note: resolutionNote || null,
    resolved_by: staff.id,
    resolved_at: resolvedAt,
  }

  try {
    const saved = (await pb.collection('hk_events').update(id, {
      status,
      payload_json: nextPayload,
    })) as Row

    const meta = clientMeta(request)
    await writeAudit(pb, {
      actorStaff: staff.id,
      action: 'IDENTITY_RESET_STATUS_CHANGED',
      targetId: id,
      ip: meta.ip,
      userAgent: meta.user_agent,
      payload: { status },
    })
    await notifyProcessed(pb, saved, status, resolutionNote)
  } catch (err) {
    return json(
      { error: 'update_failed', message: err instanceof Error ? err.message : '更新失敗' },
      { status: 502 },
    )
  }

  return json({ success: true })
}

async function handleUnlock(
  request: Request,
  env: WorkerEnv,
  staff: StaffAuthContext,
  studentId: string,
): Promise<Response> {
  if (!staff.is_admin) {
    return json({ error: 'forbidden', message: '需要管理員權限' }, { status: 403 })
  }

  const pb = await servicePb(env)
  if (pb instanceof Response) return pb

  try {
    await pb.collection('hk_students').update(studentId, {
      failed_login_count: 0,
      locked_until: null,
    })
  } catch {
    return json({ error: 'not_found', message: '找不到學生' }, { status: 404 })
  }

  const meta = clientMeta(request)
  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'STUDENT_UNLOCKED',
    targetId: studentId,
    ip: meta.ip,
    userAgent: meta.user_agent,
  })

  return json({ success: true })
}

export async function handleIdentityReset(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path === '/api/hk/identity-reset' && request.method === 'POST') {
    return handlePublicCreate(request, env)
  }

  const listMatch = path.match(/^\/api\/hk\/admin\/identity-resets$/)
  if (listMatch && request.method === 'GET') {
    const staff = await requireStaff(request, env)
    if (staff instanceof Response) return staff
    return handleAdminList(request, env, staff)
  }

  const statusMatch = path.match(/^\/api\/hk\/admin\/identity-resets\/([^/]+)\/status$/)
  if (statusMatch && request.method === 'POST') {
    const staff = await requireStaff(request, env)
    if (staff instanceof Response) return staff
    return handleAdminStatus(request, env, staff, decodeURIComponent(statusMatch[1]))
  }

  const unlockMatch = path.match(/^\/api\/hk\/admin\/students\/([^/]+)\/unlock$/)
  if (unlockMatch && request.method === 'POST') {
    const staff = await requireStaff(request, env)
    if (staff instanceof Response) return staff
    return handleUnlock(request, env, staff, decodeURIComponent(unlockMatch[1]))
  }

  return null
}
