/**
 * 經濟不利生名冊匯入 + 分批通知（admin only）。
 *
 * Storage (no new collection): hk_settings setting_type="system"
 *   outreach_ed:{batchId}              meta + progress cursor + counters
 *   outreach_ed:{batchId}:chunk:{n}    up to CHUNK_SIZE roster rows each (keeps json small)
 *
 * No Cloudflare Queue is bound yet, so `send` processes ONE batch (<= 50 recipients) per call
 * (optionally up to `max_batches`), advancing a server-side cursor. The UI loops until done.
 * Every recipient gets an in-app notification (if the student already has an hk_students
 * record) and an email_log job; with no mail provider the job is stored as "skipped".
 */

import type PocketBase from 'pocketbase'

import { nowIso, writeAudit } from '../lib/application-workflow'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { parseCsvRecords } from '../lib/csv'
import { json, type WorkerEnv } from '../lib/http'
import {
  MAIL_DISABLED_MESSAGE,
  createEmailJob,
  createNotificationEvent,
  loadTemplate,
  mailProviderConfigured,
} from '../lib/mail'
import { renderTemplate } from '../lib/notification-templates'
import { createServicePb } from '../lib/pb'
import { publicErrorMessage } from '../lib/public-error'

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; env: WorkerEnv; staff: StaffAuthContext; body: Row; request: Request }

const str = (value: unknown): string => (value == null ? '' : String(value)).trim()
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const KEY_PREFIX = 'outreach_ed:'
const TEMPLATE_CODE = 'economically_disadvantaged_outreach'
const NOTIFICATION_TYPE = 'OUTREACH_ECONOMICALLY_DISADVANTAGED'
const CHUNK_SIZE = 500
const MAX_ROWS = 5000
const MAX_CSV_CHARS = 1_000_000
const MAX_BATCH_SIZE = 50
const MAX_BATCHES_PER_CALL = 4
const LOCK_SECONDS = 120

type RosterRow = { student_no: string; name: string; email: string }
type Counters = {
  in_app: number
  email_queued: number
  email_skipped: number
  no_account: number
  failed: number
}
type Meta = {
  batch_id: string
  filename: string
  created_by: string
  created_at: string
  total: number
  invalid: number
  duplicates: number
  chunk_count: number
  cursor: number
  status: 'imported' | 'sending' | 'completed'
  lock_until: string | null
  last_sent_at: string | null
  counters: Counters
  invalid_samples: Array<{ line: number; reason: string }>
}

const metaKey = (batchId: string) => `${KEY_PREFIX}${batchId}`
const chunkKey = (batchId: string, index: number) => `${KEY_PREFIX}${batchId}:chunk:${index}`

const HEADER_ALIASES: Record<keyof RosterRow, string[]> = {
  student_no: ['student_no', '學號'],
  name: ['name', '姓名'],
  email: ['email', 'e-mail', '電子郵件', '信箱'],
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STUDENT_NO_PATTERN = /^[A-Za-z0-9_-]{3,32}$/

function pick(record: Record<string, string>, field: keyof RosterRow): string {
  for (const alias of HEADER_ALIASES[field]) {
    if (alias in record) return record[alias]
  }
  return ''
}

function metaToPlain(record: Row) {
  const meta = obj(record.value_json) as unknown as Meta
  const remaining = Math.max(0, num(meta.total) - num(meta.cursor))
  return {
    id: str(meta.batch_id),
    filename: str(meta.filename),
    created_at: str(meta.created_at) || str(record.created),
    status: str(meta.status) || 'imported',
    total: num(meta.total),
    invalid: num(meta.invalid),
    duplicates: num(meta.duplicates),
    processed: num(meta.cursor),
    remaining,
    last_sent_at: meta.last_sent_at ? str(meta.last_sent_at) : null,
    counters: {
      in_app: num(meta.counters?.in_app),
      email_queued: num(meta.counters?.email_queued),
      email_skipped: num(meta.counters?.email_skipped),
      no_account: num(meta.counters?.no_account),
      failed: num(meta.counters?.failed),
    },
    invalid_samples: Array.isArray(meta.invalid_samples) ? meta.invalid_samples : [],
  }
}

async function loadMeta(pb: PocketBase, batchId: string): Promise<{ record: Row; meta: Meta }> {
  if (!/^[a-f0-9]{12}$/.test(batchId)) throw new HttpError(400, 'batch_id 無效')
  try {
    const record = (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "system" && key = {:key}', { key: metaKey(batchId) }),
    )) as Row
    return { record, meta: obj(record.value_json) as unknown as Meta }
  } catch {
    throw new HttpError(404, '找不到名冊批次')
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function readCsvText(request: Request, body: Row): Promise<{ csv: string; filename: string }> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    return { csv: await request.text(), filename: str(request.headers.get('x-filename')) || 'roster.csv' }
  }
  return { csv: typeof body.csv === 'string' ? body.csv : '', filename: str(body.filename) || 'roster.csv' }
}

async function importRoster({ pb, staff, body, request }: Ctx): Promise<Response> {
  const { csv, filename } = await readCsvText(request, body)
  if (!csv.trim()) throw new HttpError(400, '請上傳 CSV 內容')
  if (csv.length > MAX_CSV_CHARS) throw new HttpError(400, 'CSV 檔案過大（上限約 1MB）')

  const { headers, records } = parseCsvRecords(csv)
  const known = (field: keyof RosterRow) => HEADER_ALIASES[field].some((alias) => headers.includes(alias))
  if (!known('student_no') || !known('name') || !known('email')) {
    throw new HttpError(400, 'CSV 需包含欄位：student_no,name,email（第一列為標題）')
  }
  if (records.length === 0) throw new HttpError(400, 'CSV 沒有資料列')
  if (records.length > MAX_ROWS) throw new HttpError(400, `名冊筆數超過上限 ${MAX_ROWS}`)

  const rows: RosterRow[] = []
  const seen = new Set<string>()
  const invalidSamples: Meta['invalid_samples'] = []
  let invalid = 0
  let duplicates = 0

  records.forEach((record, index) => {
    const line = index + 2
    const studentNo = pick(record, 'student_no')
    const name = pick(record, 'name')
    const email = pick(record, 'email')
    let reason = ''
    if (!STUDENT_NO_PATTERN.test(studentNo)) reason = '學號格式無效'
    else if (email && !EMAIL_PATTERN.test(email)) reason = 'Email 格式無效'

    if (reason) {
      invalid += 1
      if (invalidSamples.length < 20) invalidSamples.push({ line, reason })
      return
    }
    const dedupeKey = studentNo.toUpperCase()
    if (seen.has(dedupeKey)) {
      duplicates += 1
      return
    }
    seen.add(dedupeKey)
    rows.push({ student_no: studentNo, name, email })
  })

  if (rows.length === 0) throw new HttpError(400, '沒有可匯入的有效資料列')

  const batchId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const chunkCount = Math.ceil(rows.length / CHUNK_SIZE)
  for (let index = 0; index < chunkCount; index += 1) {
    await pb.collection('hk_settings').create({
      setting_type: 'system',
      key: chunkKey(batchId, index),
      notes: `經濟不利名冊 ${batchId} #${index + 1}`,
      value_json: { rows: rows.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE) },
      active: true,
      status: 'active',
      version: 1,
    })
  }

  const now = nowIso()
  const meta: Meta = {
    batch_id: batchId,
    filename: filename.slice(0, 120),
    created_by: staff.id,
    created_at: now,
    total: rows.length,
    invalid,
    duplicates,
    chunk_count: chunkCount,
    cursor: 0,
    status: 'imported',
    lock_until: null,
    last_sent_at: null,
    counters: { in_app: 0, email_queued: 0, email_skipped: 0, no_account: 0, failed: 0 },
    invalid_samples: invalidSamples,
  }
  const saved = (await pb.collection('hk_settings').create({
    setting_type: 'system',
    key: metaKey(batchId),
    notes: `經濟不利名冊 ${batchId}`,
    value_json: meta,
    active: true,
    status: 'active',
    version: 1,
  })) as Row

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'OUTREACH_ED_IMPORTED',
    targetId: batchId,
    payload: { total: rows.length, invalid, duplicates },
  })

  return json({
    batch: metaToPlain(saved),
    message: `已匯入 ${rows.length} 筆（無效 ${invalid}、重複 ${duplicates}），尚未發送通知。`,
  })
}

// ---------------------------------------------------------------------------
// Send (batched)
// ---------------------------------------------------------------------------

async function loadChunkRows(pb: PocketBase, batchId: string, index: number): Promise<RosterRow[]> {
  try {
    const record = (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "system" && key = {:key}', { key: chunkKey(batchId, index) }),
    )) as Row
    const rows = obj(record.value_json).rows
    return Array.isArray(rows) ? (rows as RosterRow[]) : []
  } catch {
    throw new HttpError(500, '名冊資料遺失，請重新匯入')
  }
}

async function findStudents(pb: PocketBase, rows: RosterRow[]): Promise<Map<string, Row>> {
  const params: Record<string, string> = {}
  const terms = rows.map((row, index) => {
    params[`s${index}`] = row.student_no
    return `student_no = {:s${index}}`
  })
  const found = await pb.collection('hk_students').getList(1, 100, {
    filter: pb.filter(terms.join(' || '), params),
    fields: 'id,student_no,name',
  })
  return new Map((found.items as Row[]).map((student) => [str(student.student_no).toUpperCase(), student]))
}

async function sendOneBatch(
  { pb, env }: Ctx,
  meta: Meta,
  templates: { subject_template: string; body_template: string },
  batchSize: number,
): Promise<{ processed: number; counters: Counters }> {
  const counters: Counters = { in_app: 0, email_queued: 0, email_skipped: 0, no_account: 0, failed: 0 }
  const chunkIndex = Math.floor(meta.cursor / CHUNK_SIZE)
  const offset = meta.cursor - chunkIndex * CHUNK_SIZE
  const chunk = await loadChunkRows(pb, meta.batch_id, chunkIndex)
  const rows = chunk.slice(offset, offset + batchSize)
  if (rows.length === 0) return { processed: 0, counters }

  const students = await findStudents(pb, rows)
  const applyUrl = `${(env.HK_STUDENT_APP_URL || '').replace(/\/$/, '')}/student/current`

  const handle = async (row: RosterRow) => {
    const student = students.get(row.student_no.toUpperCase())
    const vars = {
      student_name: row.name || str(student?.name) || '同學',
      student_no: row.student_no,
      apply_url: applyUrl,
    }
    const subject = renderTemplate(templates.subject_template, vars).text
    const body = renderTemplate(templates.body_template, vars).text
    try {
      let notificationId: string | undefined
      if (student) {
        notificationId = await createNotificationEvent(pb, {
          studentId: str(student.id),
          notificationType: NOTIFICATION_TYPE,
          uiCategory: 'system',
          title: subject || '您符合經濟不利資格，歡迎申請弘愛築夢',
          message: body,
          actionUrl: '/student/current',
          targetType: 'outreach',
          targetId: meta.batch_id,
          extra: { outreach_batch: meta.batch_id },
        })
        counters.in_app += 1
      } else {
        counters.no_account += 1
      }
      if (row.email) {
        const job = await createEmailJob(pb, env, {
          studentId: student ? str(student.id) : undefined,
          recipient: row.email,
          subject,
          body,
          template: TEMPLATE_CODE,
          notificationId,
          targetType: 'outreach',
          targetId: meta.batch_id,
          extra: { outreach_batch: meta.batch_id, student_no: row.student_no },
        })
        if (job.status === 'queued') counters.email_queued += 1
        else counters.email_skipped += 1
      } else {
        counters.email_skipped += 1
      }
    } catch {
      counters.failed += 1
    }
  }

  // Small concurrency window keeps a 50-recipient batch fast without flooding PocketBase.
  for (let i = 0; i < rows.length; i += 10) {
    await Promise.all(rows.slice(i, i + 10).map(handle))
  }
  return { processed: rows.length, counters }
}

async function sendBatches(ctx: Ctx): Promise<Response> {
  const { pb, staff, body } = ctx
  const batchId = str(body.batch_id)
  const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(num(body.batch_size)) || MAX_BATCH_SIZE))
  const maxBatches = Math.min(MAX_BATCHES_PER_CALL, Math.max(1, Math.floor(num(body.max_batches)) || 1))

  const { record, meta } = await loadMeta(pb, batchId)
  if (meta.status === 'completed' || meta.cursor >= meta.total) {
    throw new HttpError(400, '此批次已全部處理完成')
  }
  if (meta.lock_until && Date.parse(meta.lock_until) > Date.now()) {
    throw new HttpError(409, '此批次正在發送中，請稍後再試')
  }

  const templates = await loadTemplate(pb, TEMPLATE_CODE)
  if (!templates.body_template) throw new HttpError(500, '找不到通知範本')

  meta.lock_until = new Date(Date.now() + LOCK_SECONDS * 1000).toISOString()
  meta.status = 'sending'
  await pb.collection('hk_settings').update(str(record.id), { value_json: meta })

  const total: Counters & { processed: number; batches: number } = {
    in_app: 0,
    email_queued: 0,
    email_skipped: 0,
    no_account: 0,
    failed: 0,
    processed: 0,
    batches: 0,
  }
  let failure: unknown = null

  try {
    for (let n = 0; n < maxBatches && meta.cursor < meta.total; n += 1) {
      // Never cross a chunk boundary so each batch reads one chunk record.
      const toBoundary = CHUNK_SIZE - (meta.cursor % CHUNK_SIZE)
      const result = await sendOneBatch(ctx, meta, templates, Math.min(batchSize, toBoundary))
      if (result.processed === 0) break
      meta.cursor += result.processed
      for (const key of ['in_app', 'email_queued', 'email_skipped', 'no_account', 'failed'] as const) {
        meta.counters[key] = num(meta.counters[key]) + result.counters[key]
        total[key] += result.counters[key]
      }
      total.processed += result.processed
      total.batches += 1
    }
  } catch (err) {
    failure = err
  }

  meta.lock_until = null
  meta.last_sent_at = nowIso()
  meta.status = meta.cursor >= meta.total ? 'completed' : 'sending'
  const saved = (await pb.collection('hk_settings').update(str(record.id), { value_json: meta })) as Row

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'OUTREACH_ED_SENT',
    targetId: meta.batch_id,
    payload: { ...total, cursor: meta.cursor, total: meta.total },
  })

  if (failure && total.processed === 0) throw failure

  const mailConfigured = mailProviderConfigured(ctx.env)
  return json({
    batch: metaToPlain(saved),
    result: {
      processed: total.processed,
      batches: total.batches,
      queued: total.email_queued,
      in_app_created: total.in_app,
      email_skipped: total.email_skipped,
      no_account: total.no_account,
      failed: total.failed,
      done: meta.status === 'completed',
    },
    mail_provider_configured: mailConfigured,
    message: mailConfigured
      ? `已處理 ${total.processed} 筆，Email 已排入佇列 ${total.email_queued} 筆。`
      : `已處理 ${total.processed} 筆（站內通知 ${total.in_app}）。${MAIL_DISABLED_MESSAGE}`,
  })
}

async function listBatches({ pb, env }: Ctx): Promise<Response> {
  const page = await pb.collection('hk_settings').getList(1, 20, {
    filter: 'setting_type = "system" && key ~ "outreach_ed:%" && key !~ ":chunk:"',
    sort: '-created',
  })
  return json({
    items: (page.items as Row[]).map(metaToPlain),
    mail_provider_configured: mailProviderConfigured(env),
  })
}

type Route = { method: 'GET' | 'POST'; pattern: RegExp; handler: (ctx: Ctx) => Promise<Response> }

const BASE = '/api/hk/admin/outreach/economically-disadvantaged'
const routes: Route[] = [
  { method: 'GET', pattern: new RegExp(`^${BASE}/batches$`), handler: listBatches },
  { method: 'POST', pattern: new RegExp(`^${BASE}/import$`), handler: importRoster },
  { method: 'POST', pattern: new RegExp(`^${BASE}/send$`), handler: sendBatches },
]

export async function handleAdminOutreach(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  const route = routes.find((item) => item.method === request.method && item.pattern.test(path))
  if (!route) return null

  const staff = await requireStaff(request, env, { adminOnly: true })
  if (staff instanceof Response) return staff

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

  // Import may be raw text/csv; only JSON bodies are pre-parsed here.
  const isJson = (request.headers.get('content-type') || '').includes('application/json')
  const body: Row =
    request.method === 'POST' && isJson
      ? ((await request.json().catch(() => ({}))) as Row) ?? {}
      : {}

  try {
    return await route.handler({ pb, env, staff, body, request })
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: 'request_failed', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: publicErrorMessage('操作失敗，請稍後再試', err) },
      { status: 502 },
    )
  }
}
