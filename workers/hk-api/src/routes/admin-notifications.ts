/**
 * Admin notification template write + delivery detail/resend stubs.
 * In-app notifications are already listed via admin-read; student read/preferences in student-inbox.
 * Email send is NOT configured — resend returns an honest error.
 */

import type PocketBase from 'pocketbase'

import { writeAudit } from '../lib/application-workflow'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { json, type WorkerEnv } from '../lib/http'
import {
  TEMPLATE_SEED,
  renderTemplate,
  templateFromSetting,
  templateSettingKey,
} from '../lib/notification-templates'
import { createServicePb } from '../lib/pb'

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; staff: StaffAuthContext; body: Row; url: URL }

const str = (value: unknown): string => (value == null ? '' : String(value)).trim()
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function requireAdmin(staff: StaffAuthContext) {
  if (!staff.is_admin) throw new HttpError(403, '需要管理員權限')
}

const CHANNELS = new Set(['both', 'in_app', 'email'])

function deliveryToPlain(record: Row): Row {
  const payload = obj(record.payload_json)
  return {
    id: str(record.id),
    notification: str(payload.notification) || null,
    template: str(payload.template) || null,
    channel: str(payload.channel) || 'email',
    recipient: str(payload.recipient) || str(obj(record.recipient_json).email) || '',
    subject: str(payload.subject),
    provider: str(payload.provider) || null,
    provider_message_id: str(payload.provider_message_id) || null,
    status: str(record.status) || 'queued',
    attempt_count: Number(payload.attempt_count) || 0,
    last_attempt_at: payload.last_attempt_at ? str(payload.last_attempt_at) : null,
    sent_at: payload.sent_at ? str(payload.sent_at) : null,
    next_retry_at: payload.next_retry_at ? str(payload.next_retry_at) : null,
    error_code: str(payload.error_code) || null,
    error_message: str(payload.error_message) || null,
    application: str(payload.application) || str(record.target_id) || null,
    recipient_student: str(obj(record.recipient_json).student) || null,
    rendered_body: payload.rendered_body != null ? str(payload.rendered_body) : null,
    created: str(record.created),
    updated: str(record.updated),
  }
}

async function upsertTemplate({ pb, staff, body }: Ctx): Promise<Response> {
  requireAdmin(staff)
  const code = str(body.code)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
  if (!code) throw new HttpError(400, '請填寫範本代碼')
  const name = str(body.name)
  if (!name) throw new HttpError(400, '請填寫範本名稱')
  const channel = str(body.channel) || 'both'
  if (!CHANNELS.has(channel)) throw new HttpError(400, 'channel 無效')
  const bodyTemplate = str(body.body_template)
  if (!bodyTemplate) throw new HttpError(400, '請填寫內文範本')

  const key = templateSettingKey(code)
  const value = {
    code,
    name,
    channel,
    category: str(body.category) || 'system',
    subject_template: str(body.subject_template),
    body_template: bodyTemplate,
    is_critical: Boolean(body.is_critical),
    version: 1,
  }

  let saved: Row
  try {
    const existing = (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "notification_template" && key = {:key}', { key }),
    )) as Row
    const prev = obj(existing.value_json)
    value.version = (Number(prev.version) || 1) + 1
    saved = (await pb.collection('hk_settings').update(str(existing.id), {
      value_json: value,
      label: name,
      active: body.active === false ? false : true,
      version: value.version,
    })) as Row
  } catch {
    saved = (await pb.collection('hk_settings').create({
      setting_type: 'notification_template',
      key,
      label: name,
      value_json: value,
      active: body.active === false ? false : true,
      status: 'active',
      version: 1,
    })) as Row
  }

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'NOTIFICATION_TEMPLATE_UPSERTED',
    targetId: str(saved.id),
    payload: { code },
  })
  return json({ template: templateFromSetting(saved), message: '範本已儲存' })
}

async function previewTemplate({ pb, body }: Ctx): Promise<Response> {
  let subjectTpl = str(body.subject_template)
  let bodyTpl = str(body.body_template)
  const templateId = str(body.template_id)
  if (templateId) {
    let record: Row
    try {
      record = (await pb.collection('hk_settings').getOne(templateId)) as Row
    } catch {
      throw new HttpError(404, '找不到範本')
    }
    const template = templateFromSetting(record)
    subjectTpl = template.subject_template || ''
    bodyTpl = template.body_template || ''
  }
  if (!bodyTpl && !subjectTpl) throw new HttpError(400, '請提供範本內容')
  const vars =
    body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables)
      ? (body.variables as Record<string, unknown>)
      : {}
  const subject = renderTemplate(subjectTpl, vars)
  const rendered = renderTemplate(bodyTpl, vars)
  const html = rendered.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
  return json({
    subject: { text: subject.text, missing: subject.missing },
    body: { text: rendered.text, missing: rendered.missing },
    html,
    sample_student_no: str(vars.student_no) || 'U0000000',
  })
}

async function seedTemplates({ pb, staff }: Ctx): Promise<Response> {
  requireAdmin(staff)
  let created = 0
  let skipped = 0
  let updated = 0

  for (const def of TEMPLATE_SEED) {
    const key = templateSettingKey(def.code)
    try {
      await pb.collection('hk_settings').getFirstListItem(
        pb.filter('setting_type = "notification_template" && key = {:key}', { key }),
      )
      skipped += 1
    } catch {
      await pb.collection('hk_settings').create({
        setting_type: 'notification_template',
        key,
        label: def.name,
        value_json: { ...def, version: 1 },
        active: true,
        status: 'active',
        version: 1,
      })
      created += 1
    }
  }

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'NOTIFICATION_TEMPLATES_SEEDED',
    targetId: 'notification_templates',
    payload: { created, skipped, updated },
  })
  return json({
    result: { created, skipped, updated, total: TEMPLATE_SEED.length },
    message: created ? `已建立 ${created} 筆範本` : '範本已存在，未覆寫',
  })
}

async function getDelivery({ pb }: Ctx, id: string): Promise<Response> {
  let record: Row
  try {
    record = (await pb.collection('hk_events').getOne(id)) as Row
  } catch {
    throw new HttpError(404, '找不到寄送紀錄')
  }
  if (str(record.event_type) !== 'email_log') throw new HttpError(404, '找不到寄送紀錄')
  return json({ delivery: deliveryToPlain(record) })
}

async function resendDelivery({ pb, staff }: Ctx, id: string): Promise<Response> {
  requireAdmin(staff)
  let record: Row
  try {
    record = (await pb.collection('hk_events').getOne(id)) as Row
  } catch {
    throw new HttpError(404, '找不到寄送紀錄')
  }
  if (str(record.event_type) !== 'email_log') throw new HttpError(404, '找不到寄送紀錄')

  // Email provider not wired — do not fake "sent".
  throw new HttpError(
    503,
    '郵件寄送尚未設定（站內通知仍可用）。完成 Gmail／SMTP 接線後即可重送。',
  )
}

type Route = {
  method: 'GET' | 'POST'
  pattern: RegExp
  handler: (ctx: Ctx, params: string[]) => Promise<Response>
  adminOnly?: boolean
}

const routes: Route[] = [
  {
    method: 'POST',
    pattern: /^\/api\/hk\/admin\/notifications\/templates$/,
    handler: (c) => upsertTemplate(c),
    adminOnly: true,
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/admin\/notifications\/templates\/preview$/,
    handler: (c) => previewTemplate(c),
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/admin\/notifications\/seed$/,
    handler: (c) => seedTemplates(c),
    adminOnly: true,
  },
  {
    method: 'GET',
    pattern: /^\/api\/hk\/admin\/notifications\/deliveries\/([^/]+)$/,
    handler: (c, [id]) => getDelivery(c, decodeURIComponent(id)),
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/admin\/notifications\/deliveries\/([^/]+)\/resend$/,
    handler: (c, [id]) => resendDelivery(c, decodeURIComponent(id)),
    adminOnly: true,
  },
]

export async function handleAdminNotifications(
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

  const staff = await requireStaff(request, env, { adminOnly: route.adminOnly })
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
    if (err instanceof HttpError) {
      return json({ error: 'request_failed', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '操作失敗' },
      { status: 502 },
    )
  }
}
