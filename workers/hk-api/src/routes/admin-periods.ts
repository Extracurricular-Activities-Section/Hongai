import type PocketBase from 'pocketbase'

import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { categoryFromSetting } from '../lib/categories'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import { periodFromSetting, type PeriodStatus } from '../lib/periods'

type Body = Record<string, unknown>

const PERIOD_STATUSES: PeriodStatus[] = ['draft', 'scheduled', 'open', 'closed', 'archived']

function badRequest(message: string): Response {
  return json({ error: 'bad_request', message }, { status: 400 })
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

async function writeAudit(pb: PocketBase, staff: StaffAuthContext, action: string, targetId: string) {
  try {
    await pb.collection('hk_events').create({
      event_type: 'audit',
      event_key: action,
      actor_staff: staff.id,
      target_type: 'period',
      target_id: targetId,
      occurred_at: new Date().toISOString(),
    })
  } catch {
    // audit is best-effort
  }
}

/** Validate a period payload; returns value_json + active, or an error message. */
async function parsePeriod(
  pb: PocketBase,
  body: Body,
  excludeId: string | null,
): Promise<{ value: Body; active: boolean } | string> {
  const name = String(body.name ?? '').trim()
  const startAt = String(body.start_at ?? '').trim()
  const endAt = String(body.end_at ?? '').trim()
  const academicYear = Number(body.academic_year)
  const minCount = Number(body.min_application_count ?? 2)
  const status = String(body.status || 'draft') as PeriodStatus
  const active = body.active !== false

  if (!name || !startAt || !endAt) return '請完整填寫梯次資料'
  const start = Date.parse(startAt)
  const end = Date.parse(endAt)
  if (Number.isNaN(start) || Number.isNaN(end)) return '開始或結束時間格式錯誤'
  if (start >= end) return '開始時間必須早於結束時間'
  if (!Number.isFinite(minCount) || minCount < 0) return '最低申請項數無效'
  if (!academicYear || academicYear < 100 || academicYear > 200) return '學年度數值不合理'
  if (!PERIOD_STATUSES.includes(status)) return '梯次狀態無效'

  if (status === 'open' && active) {
    const rows = await pb.collection('hk_settings').getFullList({
      filter: 'setting_type = "period" && active = true',
    })
    const clash = rows
      .map((row) => periodFromSetting(row as Body))
      .some(
        (p) =>
          p.id !== excludeId &&
          p.status === 'open' &&
          rangesOverlap(start, end, Date.parse(p.start_at), Date.parse(p.end_at)),
      )
    if (clash) return '目前已有開放中的申請梯次，請先調整原梯次時間或狀態。'
  }

  return {
    active,
    value: {
      name,
      academic_year: academicYear,
      semester: String(body.semester) === '2' ? '2' : '1',
      start_at: new Date(start).toISOString(),
      end_at: new Date(end).toISOString(),
      status,
      sort_order: Number(body.sort_order) || 0,
      description: String(body.description ?? '').trim(),
      min_application_count: minCount || 2,
      min_application_rule: body.min_application_rule === 'enforced' ? 'enforced' : 'warning_only',
    },
  }
}

export async function handleAdminPeriods(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (request.method !== 'POST') return null
  const periodMatch = path.match(/^\/api\/hk\/admin\/periods(?:\/([^/]+))?$/)
  const categoryMatch = path.match(/^\/api\/hk\/admin\/categories\/([^/]+)$/)
  if (!periodMatch && !categoryMatch) return null

  const staff = await requireStaff(request, env, { adminOnly: true })
  if (staff instanceof Response) return staff

  const body = (await request.json().catch(() => null)) as Body | null
  if (!body) return badRequest('請求內容格式錯誤')

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

  try {
    if (periodMatch) {
      const id = periodMatch[1] ? decodeURIComponent(periodMatch[1]) : null
      if (id) {
        const existing = await pb.collection('hk_settings').getOne(id)
        if (existing.setting_type !== 'period') {
          return json({ error: 'not_found', message: '找不到梯次' }, { status: 404 })
        }
      }
      const parsed = await parsePeriod(pb, body, id)
      if (typeof parsed === 'string') return badRequest(parsed)

      const payload = {
        setting_type: 'period',
        value_json: parsed.value,
        active: parsed.active,
        status: parsed.value.status === 'archived' ? 'archived' : 'active',
        updated_by: staff.id,
      }
      const record = id
        ? await pb.collection('hk_settings').update(id, payload)
        : await pb
            .collection('hk_settings')
            .create({ ...payload, key: `period:${crypto.randomUUID()}`, version: 1 })
      const action = !id
        ? 'PERIOD_CREATED'
        : parsed.value.status === 'archived'
          ? 'PERIOD_ARCHIVED'
          : 'PERIOD_UPDATED'
      await writeAudit(pb, staff, action, record.id)
      return json({ period: periodFromSetting(record as Body) })
    }

    const id = decodeURIComponent((categoryMatch as RegExpMatchArray)[1])
    const record = (await pb.collection('hk_settings').getOne(id)) as Body
    if (record.setting_type !== 'category') {
      return json({ error: 'not_found', message: '找不到申請項目' }, { status: 404 })
    }
    const value = { ...((record.value_json as Body) || {}) }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name) value.name = name
    if (typeof body.description === 'string') value.description = body.description.trim()
    if (typeof body.sort_order === 'number') value.sort_order = body.sort_order
    const update: Body = { value_json: value, updated_by: staff.id }
    if (typeof body.active === 'boolean') update.active = body.active
    const saved = await pb.collection('hk_settings').update(id, update)
    return json({ category: categoryFromSetting(saved as Body) })
  } catch (err) {
    const status = (err as { status?: number }).status === 404 ? 404 : 502
    return json(
      {
        error: status === 404 ? 'not_found' : 'pb_error',
        message: status === 404 ? '找不到資料' : err instanceof Error ? err.message : '儲存失敗',
      },
      { status },
    )
  }
}
