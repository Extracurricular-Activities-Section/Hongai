import type PocketBase from 'pocketbase'

import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { categoryFromSetting, ensureCategorySeed } from '../lib/categories'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import { compareLatestFirst, periodFromSetting, studentPeriodProfiles } from '../lib/periods'

/**
 * Read-only admin APIs backed by the six hk_* collections.
 *
 * Storage for concepts without a dedicated setting_type uses
 * hk_settings setting_type="system" with these key prefixes:
 *   department:, category_department:, follow_up_template:, category_follow_up_template:
 * Identity reset requests are hk_events (event_type="auth", event_key="identity_reset").
 */

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; staff: StaffAuthContext; url: URL }
type Handler = (ctx: Ctx, params: string[]) => Promise<Response>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const nullable = (value: unknown): string | null => (value ? String(value) : null)

function baseFields(record: Row) {
  return { id: str(record.id), created: str(record.created), updated: str(record.updated) }
}

function maskIdentity(last4: unknown): string {
  const tail = str(last4)
  return tail ? `******${tail}` : ''
}

async function settingsByType(pb: PocketBase, type: string, keyPrefix?: string): Promise<Row[]> {
  const filter = keyPrefix
    ? pb.filter('setting_type = {:type} && key ~ {:prefix}', { type, prefix: `${keyPrefix}%` })
    : pb.filter('setting_type = {:type}', { type })
  return (await pb.collection('hk_settings').getFullList({ filter })) as Row[]
}

function settingItem(record: Row): Row {
  return { ...obj(record.value_json), ...baseFields(record), active: Boolean(record.active) }
}

function bySortOrder(a: Row, b: Row): number {
  return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
}

function applicationToPlain(record: Row): Row {
  const workflow = obj(record.workflow_json)
  const period = obj(record.period_json)
  const student = obj(obj(record.expand).student)
  const department = obj(record.current_department_json)
  return {
    ...baseFields(record),
    student: str(record.student),
    period: str(record.period_key),
    category: str(record.category_code),
    submission: str(workflow.submission),
    submission_version: str(workflow.submission_version),
    pdf_document: str(workflow.pdf_document),
    signed_document: nullable(workflow.signed_document),
    application_number: str(record.application_number),
    status: str(record.status),
    submitted_at: nullable(record.submitted_at),
    current_staff: nullable(record.current_staff),
    current_department: nullable(department.id ?? department.code),
    eligibility_status: str(record.eligibility_status) || 'pending',
    requested_amount: record.requested_amount ?? null,
    approved_amount: record.approved_amount ?? null,
    latest_reviewed_at: nullable(record.latest_reviewed_at),
    closed_at: nullable(record.closed_at),
    edit_override_until: nullable(record.edit_override_until),
    supplement_message: nullable(workflow.supplement_message),
    supplement_due_at: nullable(workflow.supplement_due_at),
    return_reason: nullable(workflow.return_reason),
    reject_reason: nullable(workflow.reject_reason),
    notification_pending: Boolean(workflow.notification_pending),
    category_code: str(record.category_code),
    category_name: str(record.category_name),
    period_name: str(period.name),
    student_no: str(student.student_no),
    student_name: str(student.name),
    identity_masked: maskIdentity(student.identity_last4),
    department_name: str(student.department_name),
  }
}

function applicationFilter(pb: PocketBase, url: URL): string {
  const parts: string[] = []
  const q = url.searchParams.get('q')?.trim()
  if (q) {
    parts.push(
      pb.filter(
        '(application_number ~ {:q} || student.student_no ~ {:q} || student.name ~ {:q})',
        { q },
      ),
    )
  }
  const eq: Array<[string, string]> = [
    ['period', 'period_key'],
    ['category', 'category_code'],
    ['status', 'status'],
    ['eligibility_status', 'eligibility_status'],
  ]
  for (const [param, field] of eq) {
    const value = url.searchParams.get(param)
    if (value) parts.push(pb.filter(`${field} = {:v}`, { v: value }))
  }
  return parts.join(' && ')
}

function eventToPlain(record: Row): Row {
  return { ...obj(record.payload_json), ...baseFields(record), status: str(record.status) }
}

async function eventsByType(pb: PocketBase, type: string, extra = ''): Promise<Row[]> {
  const filter = [pb.filter('event_type = {:type}', { type }), extra].filter(Boolean).join(' && ')
  const page = await pb.collection('hk_events').getList(1, 200, { filter, sort: '-created' })
  return page.items as Row[]
}

const routes: Array<{ pattern: RegExp; adminOnly?: boolean; handler: Handler }> = [
  {
    pattern: /^\/api\/hk\/admin\/applications\/summary$/,
    handler: async ({ pb }) => {
      const rows = (await pb
        .collection('hk_applications')
        .getFullList({ fields: 'status,eligibility_status' })) as Row[]
      const byStatus: Record<string, number> = {}
      const byEligibility: Record<string, number> = {}
      for (const row of rows) {
        const status = str(row.status)
        const eligibility = str(row.eligibility_status) || 'pending'
        byStatus[status] = (byStatus[status] || 0) + 1
        byEligibility[eligibility] = (byEligibility[eligibility] || 0) + 1
      }
      return json({ total: rows.length, by_status: byStatus, by_eligibility: byEligibility })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/applications$/,
    handler: async ({ pb, url }) => {
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
      const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage')) || 20))
      const result = await pb.collection('hk_applications').getList(page, perPage, {
        filter: applicationFilter(pb, url),
        sort: url.searchParams.get('sort') || '-created',
        expand: 'student',
      })
      return json({
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        items: (result.items as Row[]).map(applicationToPlain),
      })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/follow-up\/tasks$/,
    handler: async ({ pb, url }) => {
      const applicationId = url.searchParams.get('application_id')
      const status = url.searchParams.get('status')
      const rows = (await pb.collection('hk_applications').getFullList({
        filter: applicationId ? pb.filter('id = {:id}', { id: applicationId }) : '',
        fields: 'id,tasks_json',
      })) as Row[]
      const items = rows
        .flatMap((row) =>
          arr(row.tasks_json).map((task): Row => ({ ...task, application: str(row.id) })),
        )
        .filter((task) => !status || task.status === status)
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/follow-up\/templates$/,
    handler: async ({ pb }) => {
      const rows = await settingsByType(pb, 'system', 'follow_up_template:')
      return json({ items: rows.map(settingItem).sort(bySortOrder) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/follow-up\/category-templates$/,
    handler: async ({ pb, url }) => {
      const categoryId = url.searchParams.get('category_id')
      const rows = await settingsByType(pb, 'system', 'category_follow_up_template:')
      const items = rows
        .map(settingItem)
        .filter((item) => !categoryId || item.category === categoryId)
        .sort(bySortOrder)
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/notifications$/,
    handler: async ({ pb, url }) => {
      const studentId = url.searchParams.get('student_id')
      const extra = studentId ? pb.filter('recipient_json ~ {:sid}', { sid: studentId }) : ''
      const rows = await eventsByType(pb, 'notification', extra)
      return json({ items: rows.map(eventToPlain) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/notifications\/unread-count$/,
    handler: async ({ pb, staff }) => {
      const result = await pb.collection('hk_events').getList(1, 1, {
        filter: pb.filter(
          'event_type = "notification" && status = "unread" && recipient_json ~ {:sid}',
          { sid: staff.id },
        ),
        fields: 'id',
      })
      return json({ unread: result.totalItems })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/notifications\/deliveries$/,
    handler: async ({ pb, url }) => {
      const status = url.searchParams.get('status')
      const extra = status ? pb.filter('status = {:status}', { status }) : ''
      const rows = await eventsByType(pb, 'email_log', extra)
      return json({ items: rows.map(eventToPlain) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/notifications\/mail-status$/,
    handler: async ({ url }) =>
      json({
        status: {
          configured: false,
          provider: 'none',
          from: '',
          from_name: '弘愛築夢管理系統',
          app_base_url: url.origin,
          support_email: '',
          support_phone: '',
          smtp_host_set: false,
          notes: '郵件寄送尚未在 Cloudflare Worker 設定。',
        },
      }),
  },
  {
    pattern: /^\/api\/hk\/admin\/notifications\/dashboard$/,
    handler: async ({ pb }) => {
      const count = async (filter: string) =>
        (await pb.collection('hk_events').getList(1, 1, { filter, fields: 'id' })).totalItems
      const [active, unread, queued, failed, sent] = await Promise.all([
        count('event_type = "notification"'),
        count('event_type = "notification" && status = "unread"'),
        count('event_type = "email_log" && status = "queued"'),
        count('event_type = "email_log" && status = "failed"'),
        count('event_type = "email_log" && status = "sent"'),
      ])
      return json({
        summary: {
          notifications_active: active,
          notifications_unread: unread,
          deliveries_queued: queued,
          deliveries_failed: failed,
          deliveries_sent: sent,
          reminders_pending: 0,
        },
      })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/notifications\/templates$/,
    handler: async ({ pb }) => {
      const rows = await settingsByType(pb, 'notification_template')
      return json({ items: rows.map(settingItem) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/staff-users$/,
    adminOnly: true,
    handler: async ({ pb }) => {
      const rows = (await pb.collection('hk_staff_users').getFullList({
        filter: 'role != "service"',
        sort: 'name',
      })) as Row[]
      const items = rows.map((row) => ({
        ...baseFields(row),
        email: str(row.email),
        name: str(row.name),
        role: str(row.role),
        is_staff: Boolean(row.is_staff),
        is_admin: Boolean(row.is_admin) || row.role === 'admin' || row.role === 'super_admin',
        active: Boolean(row.active),
        phone: nullable(row.phone),
        job_title: nullable(row.job_title),
        last_login_at: nullable(row.last_login_at),
        notes: nullable(row.notes),
        departments: arr(row.departments_json).map((dept) => ({
          id: str(dept.id || dept.department),
          department: str(dept.department || dept.id),
          is_primary: Boolean(dept.is_primary),
          active: dept.active !== false,
        })),
      }))
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/departments$/,
    handler: async ({ pb }) => {
      const rows = await settingsByType(pb, 'system', 'department:')
      return json({ items: rows.map(settingItem).sort(bySortOrder) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/category-department-assignments$/,
    handler: async ({ pb, url }) => {
      const category = url.searchParams.get('category')
      const rows = await settingsByType(pb, 'system', 'category_department:')
      const items = rows
        .map(settingItem)
        .filter((item) => !category || item.category === category)
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/periods$/,
    handler: async ({ pb }) => {
      const rows = await settingsByType(pb, 'period')
      return json({ items: rows.map(periodFromSetting).sort(compareLatestFirst) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/categories$/,
    handler: async ({ pb }) => {
      const rows = await ensureCategorySeed(pb)
      return json({ items: rows.map(categoryFromSetting).sort(bySortOrder) })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/forms$/,
    handler: async ({ pb }) => {
      const rows = (await pb.collection('hk_forms').getFullList({ sort: 'form_code,-version' })) as Row[]
      const byCode = new Map<string, Row[]>()
      for (const row of rows) {
        const code = str(row.form_code)
        byCode.set(code, [...(byCode.get(code) || []), row])
      }
      const items = [...byCode.values()].map((versions) => {
        const latest = versions[0]
        const published = versions.find((v) => v.status === 'published') || null
        return {
          id: str(latest.form_code),
          name: str(latest.name),
          description: nullable(latest.description),
          active: Boolean(latest.active),
          category_code: nullable(latest.category_code),
          category_name: nullable(latest.category_name),
          current_published_version_id: published ? str(published.id) : null,
          current_published_version_number: published ? Number(published.version) : null,
          current_published_status: published ? str(published.status) : null,
        }
      })
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/documents$/,
    handler: async ({ pb }) => {
      const rows = (await pb
        .collection('hk_applications')
        .getFullList({ fields: 'id,files_json' })) as Row[]
      const items = rows.flatMap((row) =>
        arr(row.files_json)
          .filter((file) => file.kind === 'pdf')
          .map((file) => ({ ...file, application: str(row.id) })),
      )
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/students$/,
    handler: async ({ pb, url }) => {
      const q = url.searchParams.get('q')?.trim()
      const result = await pb.collection('hk_students').getList(1, 100, {
        filter: q ? pb.filter('student_no ~ {:q} || name ~ {:q}', { q }) : '',
        sort: 'student_no',
      })
      const items = (result.items as Row[]).map((row) => ({
        id: str(row.id),
        student_no: str(row.student_no),
        name: str(row.name),
        department_name: str(row.department_name),
        identity_masked: maskIdentity(row.identity_last4),
      }))
      return json({ items })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/students\/([^/]+)$/,
    handler: async ({ pb }, [id]) => {
      const row = (await pb.collection('hk_students').getOne(id)) as Row
      const periods = await settingsByType(pb, 'period')
      const periodById = new Map(periods.map((p) => [str(p.id), periodFromSetting(p)]))
      const profiles = studentPeriodProfiles(row)
      return json({
        student: { id: str(row.id), student_no: str(row.student_no) },
        profile: {
          name: str(row.name),
          department_name: str(row.department_name),
          grade: str(row.grade),
          email: str(obj(row.profile_json).contact_email),
          phone: str(row.phone),
          identity_number_masked: maskIdentity(row.identity_last4),
        },
        period_profiles: Object.entries(profiles).map(([periodId, profile]) => ({
          profile: { ...profile, period: periodId, student: str(row.id) },
          period: periodById.get(periodId) ?? null,
        })),
      })
    },
  },
  {
    pattern: /^\/api\/hk\/admin\/identity-resets$/,
    handler: async ({ pb, url }) => {
      const status = url.searchParams.get('status')
      const extra = [
        'event_key = "identity_reset"',
        status ? pb.filter('status = {:status}', { status }) : '',
      ]
        .filter(Boolean)
        .join(' && ')
      const rows = await eventsByType(pb, 'auth', extra)
      return json({ items: rows.map(eventToPlain) })
    },
  },
]

export async function handleAdminRead(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (request.method !== 'GET') return null
  let match: RegExpMatchArray | null = null
  const route = routes.find((candidate) => (match = path.match(candidate.pattern)))
  if (!route || !match) return null

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

  try {
    const params = (match as RegExpMatchArray).slice(1).map(decodeURIComponent)
    return await route.handler({ pb, staff, url: new URL(request.url) }, params)
  } catch (err) {
    const status = (err as { status?: number }).status === 404 ? 404 : 502
    return json(
      { error: status === 404 ? 'not_found' : 'pb_error', message: err instanceof Error ? err.message : '讀取失敗' },
      { status },
    )
  }
}
