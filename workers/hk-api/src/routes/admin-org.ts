/**
 * Admin writes for staff users, departments, and category↔department assignments.
 *
 * Storage (six collections):
 *   staff     → hk_staff_users (+ departments_json)
 *   department → hk_settings setting_type=system key=department:{CODE}
 *   assignment → hk_settings setting_type=system key=category_department:{categoryId}:{departmentId}
 */

import type PocketBase from 'pocketbase'

import { nowIso, writeAudit } from '../lib/application-workflow'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { categoryFromSetting, ensureCategorySeed } from '../lib/categories'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; staff: StaffAuthContext; body: Row; url: URL }

const str = (value: unknown): string => (value == null ? '' : String(value)).trim()
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

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

function baseFields(record: Row) {
  return { id: str(record.id), created: str(record.created), updated: str(record.updated) }
}

function staffToPlain(record: Row): Row {
  return {
    ...baseFields(record),
    email: str(record.email),
    name: str(record.name),
    role: str(record.role),
    is_staff: Boolean(record.is_staff),
    is_admin: Boolean(record.is_admin) || record.role === 'admin' || record.role === 'super_admin',
    active: Boolean(record.active),
    phone: str(record.phone) || null,
    job_title: str(record.job_title) || null,
    last_login_at: record.last_login_at ? str(record.last_login_at) : null,
    notes: str(record.notes) || null,
    departments: arr(record.departments_json).map((item) => {
      const dept = obj(item)
      return {
        id: str(dept.id || dept.department),
        department: str(dept.department || dept.id),
        is_primary: Boolean(dept.is_primary),
        active: dept.active !== false,
      }
    }),
  }
}

function departmentFromSetting(record: Row): Row {
  const value = obj(record.value_json)
  return {
    ...baseFields(record),
    name: str(value.name),
    code: str(value.code),
    description: str(value.description) || undefined,
    sort_order: Number(value.sort_order) || 0,
    active: Boolean(record.active),
  }
}

function assignmentFromSetting(record: Row): Row {
  const value = obj(record.value_json)
  return {
    ...baseFields(record),
    category: str(value.category),
    department: str(value.department),
    assignment_type: str(value.assignment_type) || 'primary',
    active: Boolean(record.active) && value.active !== false,
  }
}

async function loadDepartment(pb: PocketBase, idOrCode: string): Promise<Row> {
  const id = str(idOrCode)
  if (!id) throw new HttpError(400, '單位無效')
  try {
    const byId = (await pb.collection('hk_settings').getOne(id)) as Row
    if (str(byId.setting_type) === 'system' && str(byId.key).startsWith('department:')) {
      return byId
    }
  } catch {
    // try by code key
  }
  try {
    return (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "system" && key = {:key}', {
        key: `department:${id.toUpperCase()}`,
      }),
    )) as Row
  } catch {
    throw new HttpError(400, '單位不存在')
  }
}

async function loadCategory(pb: PocketBase, idOrCode: string): Promise<Row> {
  await ensureCategorySeed(pb)
  const id = str(idOrCode)
  if (!id) throw new HttpError(400, '類別無效')
  try {
    const byId = (await pb.collection('hk_settings').getOne(id)) as Row
    if (str(byId.setting_type) === 'category') return byId
  } catch {
    // try by code
  }
  try {
    return (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "category" && key = {:key}', { key: `category:${id}` }),
    )) as Row
  } catch {
    throw new HttpError(400, '類別不存在')
  }
}

async function departmentsLinks(pb: PocketBase, departmentIds: unknown[]): Promise<Row[]> {
  const links: Row[] = []
  let index = 0
  for (const raw of departmentIds) {
    const id = str(raw)
    if (!id) continue
    const dept = await loadDepartment(pb, id)
    links.push({
      id: str(dept.id),
      department: str(dept.id),
      is_primary: index === 0,
      active: true,
    })
    index += 1
  }
  return links
}

function primaryDepartmentMeta(links: Row[], deptRows: Row[]) {
  const primary = links.find((link) => link.is_primary) || links[0]
  if (!primary) return { department_code: '', department_name: '' }
  const row = deptRows.find((item) => str(item.id) === str(primary.department))
  const plain = row ? departmentFromSetting(row) : null
  return {
    department_code: plain ? str(plain.code) : '',
    department_name: plain ? str(plain.name) : '',
  }
}

async function createStaff({ pb, staff, body }: Ctx): Promise<Response> {
  requireAdmin(staff)
  const email = str(body.email).toLowerCase()
  const password = String(body.password || '')
  const name = str(body.name)
  if (!email || !email.includes('@')) throw new HttpError(400, 'Email 無效')
  if (password.length < 8) throw new HttpError(400, '密碼至少 8 碼')
  if (!name) throw new HttpError(400, '請填寫姓名')

  const isAdmin = bool(body.is_admin, false)
  const isStaff = bool(body.is_staff, true)
  const links = await departmentsLinks(pb, arr(body.department_ids))
  const deptRows = await Promise.all(links.map((link) => loadDepartment(pb, str(link.department))))
  const meta = primaryDepartmentMeta(links, deptRows)

  let record: Row
  try {
    record = (await pb.collection('hk_staff_users').create({
      email,
      emailVisibility: true,
      password,
      passwordConfirm: password,
      name,
      role: isAdmin ? 'admin' : 'staff',
      is_staff: isStaff || isAdmin,
      is_admin: isAdmin,
      active: bool(body.active, true),
      phone: str(body.phone),
      job_title: str(body.job_title),
      notes: str(body.notes),
      departments_json: links,
      department_code: meta.department_code,
      department_name: meta.department_name,
      can_manage_forms: isAdmin,
      can_publish_forms: isAdmin,
    })) as Row
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : '建立帳號失敗')
  }

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'STAFF_USER_CREATED',
    targetId: str(record.id),
    payload: { email },
  })
  return json({ staff_user: staffToPlain(record) })
}

async function updateStaff({ pb, staff, body }: Ctx, id: string): Promise<Response> {
  requireAdmin(staff)
  let record: Row
  try {
    record = (await pb.collection('hk_staff_users').getOne(id)) as Row
  } catch {
    throw new HttpError(404, '找不到帳號')
  }
  if (str(record.role) === 'service') throw new HttpError(403, '不可修改服務帳號')

  const patch: Row = {}
  const name = str(body.name)
  if (name) patch.name = name
  const email = str(body.email).toLowerCase()
  if (email) {
    if (!email.includes('@')) throw new HttpError(400, 'Email 無效')
    patch.email = email
  }
  if (typeof body.is_staff === 'boolean') patch.is_staff = body.is_staff
  if (typeof body.is_admin === 'boolean') {
    patch.is_admin = body.is_admin
    patch.role = body.is_admin ? 'admin' : 'staff'
    if (body.is_admin) patch.is_staff = true
  }
  if (typeof body.active === 'boolean') patch.active = body.active
  if (body.phone !== undefined) patch.phone = str(body.phone)
  if (body.job_title !== undefined) patch.job_title = str(body.job_title)
  if (body.notes !== undefined) patch.notes = str(body.notes)

  const password = String(body.password || '')
  if (password) {
    if (password.length < 8) throw new HttpError(400, '密碼至少 8 碼')
    patch.password = password
    patch.passwordConfirm = password
  }

  if (Array.isArray(body.department_ids)) {
    const links = await departmentsLinks(pb, body.department_ids)
    const deptRows = await Promise.all(links.map((link) => loadDepartment(pb, str(link.department))))
    const meta = primaryDepartmentMeta(links, deptRows)
    patch.departments_json = links
    patch.department_code = meta.department_code
    patch.department_name = meta.department_name
  }

  try {
    record = (await pb.collection('hk_staff_users').update(id, patch)) as Row
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : '更新帳號失敗')
  }

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'STAFF_USER_UPDATED',
    targetId: id,
    payload: {},
  })
  return json({ staff_user: staffToPlain(record) })
}

async function saveDepartment({ pb, staff, body }: Ctx): Promise<Response> {
  requireAdmin(staff)
  const existingId = str(body.id)

  if (existingId) {
    let record: Row
    try {
      record = (await pb.collection('hk_settings').getOne(existingId)) as Row
    } catch {
      throw new HttpError(404, '找不到單位')
    }
    if (str(record.setting_type) !== 'system' || !str(record.key).startsWith('department:')) {
      throw new HttpError(404, '找不到單位')
    }
    const value = obj(record.value_json)
    const deactivate = body.deactivate === true || body.active === false
    const nextValue = deactivate
      ? value
      : {
          ...value,
          name: str(body.name) || str(value.name),
          description: body.description !== undefined ? str(body.description) : str(value.description),
          sort_order:
            typeof body.sort_order === 'number' ? Number(body.sort_order) : Number(value.sort_order) || 0,
          // code immutable
          code: str(value.code),
        }
    const saved = (await pb.collection('hk_settings').update(existingId, {
      value_json: nextValue,
      active: deactivate ? false : bool(body.active, Boolean(record.active)),
      label: str(nextValue.name) || str(record.label),
    })) as Row

    await writeAudit(pb, {
      actorStaff: staff.id,
      action: 'DEPARTMENT_UPDATED',
      targetId: existingId,
      payload: { active: Boolean(saved.active) },
    })
    return json({ department: departmentFromSetting(saved) })
  }

  const name = str(body.name)
  const code = str(body.code).toUpperCase()
  if (!name || !code) throw new HttpError(400, '請填寫單位名稱與代碼')
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw new HttpError(400, '單位代碼格式無效')

  const key = `department:${code}`
  try {
    await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "system" && key = {:key}', { key }),
    )
    throw new HttpError(400, '單位代碼已存在')
  } catch (err) {
    if (err instanceof HttpError) throw err
  }

  const saved = (await pb.collection('hk_settings').create({
    setting_type: 'system',
    key,
    label: name,
    value_json: {
      code,
      name,
      description: str(body.description),
      sort_order: Number(body.sort_order) || 0,
    },
    active: bool(body.active, true),
    status: 'active',
    version: 1,
  })) as Row

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'DEPARTMENT_CREATED',
    targetId: str(saved.id),
    payload: { code },
  })
  return json({ department: departmentFromSetting(saved) })
}

async function saveAssignment({ pb, staff, body }: Ctx): Promise<Response> {
  requireAdmin(staff)
  const assignmentType = str(body.assignment_type) || 'primary'
  if (assignmentType !== 'primary' && assignmentType !== 'collaborator') {
    throw new HttpError(400, 'assignment_type 無效')
  }

  const existingId = str(body.id)
  if (existingId) {
    let record: Row
    try {
      record = (await pb.collection('hk_settings').getOne(existingId)) as Row
    } catch {
      throw new HttpError(404, '找不到指派')
    }
    if (str(record.setting_type) !== 'system' || !str(record.key).startsWith('category_department:')) {
      throw new HttpError(404, '找不到指派')
    }
    const value = obj(record.value_json)
    if (str(body.department)) {
      const dept = await loadDepartment(pb, str(body.department))
      value.department = str(dept.id)
      value.department_code = str(departmentFromSetting(dept).code)
    }
    value.assignment_type = assignmentType
    if (typeof body.active === 'boolean') value.active = body.active

    const saved = (await pb.collection('hk_settings').update(existingId, {
      value_json: value,
      active: typeof body.active === 'boolean' ? body.active : Boolean(record.active),
    })) as Row

    await writeAudit(pb, {
      actorStaff: staff.id,
      action: 'CATEGORY_DEPARTMENT_ASSIGNMENT_UPDATED',
      targetId: existingId,
      payload: {},
    })
    return json({ assignment: assignmentFromSetting(saved) })
  }

  const categoryRow = await loadCategory(pb, str(body.category))
  const departmentRow = await loadDepartment(pb, str(body.department))
  const category = categoryFromSetting(categoryRow)
  const department = departmentFromSetting(departmentRow)
  const categoryId = str(category.id)
  const departmentId = str(department.id)
  const key = `category_department:${categoryId}:${departmentId}`

  if (assignmentType === 'primary') {
    const rows = (await pb.collection('hk_settings').getFullList({
      filter: pb.filter('setting_type = "system" && key ~ {:prefix} && active = true', {
        prefix: `category_department:${categoryId}:`,
      }),
    })) as Row[]
    for (const row of rows) {
      const value = obj(row.value_json)
      if (str(value.assignment_type) !== 'primary') continue
      await pb.collection('hk_settings').update(str(row.id), {
        active: false,
        value_json: { ...value, active: false },
      })
    }
  }

  try {
    const existing = (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "system" && key = {:key}', { key }),
    )) as Row
    const saved = (await pb.collection('hk_settings').update(str(existing.id), {
      active: bool(body.active, true),
      value_json: {
        category: categoryId,
        category_code: str(category.code),
        department: departmentId,
        department_code: str(department.code),
        assignment_type: assignmentType,
        active: bool(body.active, true),
      },
      label: `${str(category.name)} → ${str(department.name)}`,
    })) as Row
    await writeAudit(pb, {
      actorStaff: staff.id,
      action: 'CATEGORY_DEPARTMENT_ASSIGNMENT_UPDATED',
      targetId: str(saved.id),
      payload: { key },
    })
    return json({ assignment: assignmentFromSetting(saved) })
  } catch {
    // create new
  }

  const saved = (await pb.collection('hk_settings').create({
    setting_type: 'system',
    key,
    label: `${str(category.name)} → ${str(department.name)}`,
    value_json: {
      category: categoryId,
      category_code: str(category.code),
      department: departmentId,
      department_code: str(department.code),
      assignment_type: assignmentType,
      active: bool(body.active, true),
      created_at: nowIso(),
    },
    active: bool(body.active, true),
    status: 'active',
    version: 1,
  })) as Row

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'CATEGORY_DEPARTMENT_ASSIGNMENT_CREATED',
    targetId: str(saved.id),
    payload: { key },
  })
  return json({ assignment: assignmentFromSetting(saved) })
}

type Route = {
  method: 'POST'
  pattern: RegExp
  handler: (ctx: Ctx, params: string[]) => Promise<Response>
}

const routes: Route[] = [
  { method: 'POST', pattern: /^\/api\/hk\/admin\/staff-users$/, handler: (c) => createStaff(c) },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/admin\/staff-users\/([^/]+)$/,
    handler: (c, [id]) => updateStaff(c, decodeURIComponent(id)),
  },
  { method: 'POST', pattern: /^\/api\/hk\/admin\/departments$/, handler: (c) => saveDepartment(c) },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/admin\/category-department-assignments$/,
    handler: (c) => saveAssignment(c),
  },
]

export async function handleAdminOrg(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (request.method !== 'POST') return null
  let params: string[] = []
  const route = routes.find((candidate) => {
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

  const body = ((await request.json().catch(() => ({}))) as Row) || {}
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
