import type PocketBase from 'pocketbase'

import { latestFinalDecision } from './application-workflow'
import type { StaffAuthContext } from './auth-staff'

/**
 * 九項目補助統計（依系所／系所×項目）。
 *
 * 計算基礎：
 * - scope=funded（預設）：僅統計已有「有效核定」的案件，金額為最新核定總額。
 * - scope=submitted：統計所有已送件（非草稿）案件；尚未核定者核定金額為 0。
 * 承辦（非管理員）只會看到自己所屬單位被指派的項目（category_department 指派）。
 */

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export type StatsScope = 'funded' | 'submitted'

export type DepartmentFundingStat = {
  department_name: string
  approved_total: number
  application_count: number
  unique_students: number
}

export type DepartmentCategoryFundingStat = {
  department_name: string
  category_code: string
  category_name: string
  person_times: number
  unique_students: number
  approved_total: number
}

export type CategoryFundingStats = {
  period: string | null
  scope: StatsScope
  restricted_to_categories: string[] | null
  by_department: DepartmentFundingStat[]
  by_department_category: DepartmentCategoryFundingStat[]
  unique_students_across_categories: number
}

const UNKNOWN_DEPARTMENT = '未填系所'

/**
 * Category codes a non-admin staff member may see, or null (= all) for admins.
 * Derived from the staff member's active departments and the active
 * category_department assignments stored in hk_settings.
 */
export async function authorizedCategoryCodes(
  pb: PocketBase,
  staff: StaffAuthContext,
): Promise<Set<string> | null> {
  if (staff.is_admin) return null

  const record = (await pb.collection('hk_staff_users').getOne(staff.id, {
    fields: 'id,departments_json',
  })) as Row
  const departmentIds = new Set(
    arr(record.departments_json)
      .filter((dept) => dept.active !== false)
      .map((dept) => str(dept.id || dept.department))
      .filter(Boolean),
  )
  if (departmentIds.size === 0) return new Set()

  const [assignments, categories] = await Promise.all([
    pb.collection('hk_settings').getFullList({
      filter: pb.filter('setting_type = "system" && key ~ {:prefix} && active = true', {
        prefix: 'category_department:%',
      }),
    }) as Promise<Row[]>,
    pb.collection('hk_settings').getFullList({
      filter: 'setting_type = "category"',
    }) as Promise<Row[]>,
  ])
  const codeById = new Map(categories.map((row) => [str(row.id), str(obj(row.value_json).code)]))

  const codes = new Set<string>()
  for (const row of assignments) {
    const value = obj(row.value_json)
    if (value.active === false) continue
    if (!departmentIds.has(str(value.department))) continue
    const code = str(value.category_code) || codeById.get(str(value.category)) || ''
    if (code) codes.add(code)
  }
  return codes
}

export async function categoryFundingStats(
  pb: PocketBase,
  staff: StaffAuthContext,
  options: { period?: string; scope?: StatsScope } = {},
): Promise<CategoryFundingStats> {
  const scope: StatsScope = options.scope === 'submitted' ? 'submitted' : 'funded'
  const period = options.period?.trim() || null
  const allowed = await authorizedCategoryCodes(pb, staff)

  const empty: CategoryFundingStats = {
    period,
    scope,
    restricted_to_categories: allowed ? [...allowed].sort() : null,
    by_department: [],
    by_department_category: [],
    unique_students_across_categories: 0,
  }
  if (allowed && allowed.size === 0) return empty

  const parts = ['status != "draft"']
  if (period) parts.push(pb.filter('period_key = {:period}', { period }))
  if (allowed) {
    const codes = [...allowed]
    const params: Record<string, string> = {}
    codes.forEach((code, index) => {
      params[`c${index}`] = code
    })
    parts.push(
      pb.filter(
        `(${codes.map((_, index) => `category_code = {:c${index}}`).join(' || ')})`,
        params,
      ),
    )
  }

  const rows = (await pb.collection('hk_applications').getFullList({
    filter: parts.join(' && '),
    expand: 'student',
    fields:
      'id,student,category_code,category_name,status,approved_amount,funding_json,expand.student.id,expand.student.department_name',
  })) as Row[]

  type Seed = { name: string; code: string; department: string }
  type Bucket = Seed & { approved: number; count: number; students: Set<string> }
  const byDepartment = new Map<string, Bucket>()
  const byCell = new Map<string, Bucket>()
  const everyone = new Set<string>()

  const bump = (
    map: Map<string, Bucket>,
    key: string,
    seed: Seed,
    studentId: string,
    approved: number,
  ) => {
    const bucket = map.get(key) ?? { ...seed, approved: 0, count: 0, students: new Set<string>() }
    bucket.approved += approved
    bucket.count += 1
    bucket.students.add(studentId)
    map.set(key, bucket)
  }

  for (const row of rows) {
    const final = latestFinalDecision(row)
    if (scope === 'funded' && !final) continue

    const studentId = str(row.student)
    const student = obj(obj(row.expand).student)
    const department = str(student.department_name).trim() || UNKNOWN_DEPARTMENT
    const code = str(row.category_code)
    const name = str(row.category_name) || code
    const approved = final ? num(final.approved_total) : 0

    everyone.add(studentId)
    bump(byDepartment, department, { department, code: '', name: '' }, studentId, approved)
    bump(byCell, `${department}\u0000${code}`, { department, code, name }, studentId, approved)
  }

  const collator = new Intl.Collator('zh-Hant')
  return {
    ...empty,
    by_department: [...byDepartment.values()]
      .map((bucket) => ({
        department_name: bucket.department,
        approved_total: bucket.approved,
        application_count: bucket.count,
        unique_students: bucket.students.size,
      }))
      .sort(
        (a, b) =>
          b.approved_total - a.approved_total || collator.compare(a.department_name, b.department_name),
      ),
    by_department_category: [...byCell.values()]
      .map((bucket) => ({
        department_name: bucket.department,
        category_code: bucket.code,
        category_name: bucket.name,
        person_times: bucket.count,
        unique_students: bucket.students.size,
        approved_total: bucket.approved,
      }))
      .sort(
        (a, b) =>
          collator.compare(a.department_name, b.department_name) ||
          collator.compare(a.category_code, b.category_code),
      ),
    unique_students_across_categories: everyone.size,
  }
}
