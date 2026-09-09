import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type {
  ApplicationCategory,
  ApplicationPeriod,
  CurrentPeriodState,
  HistoryPeriodSummary,
  PeriodStudentProfile,
  StudentCategoryEntry,
} from '@/types'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) return new Error(message)
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

export async function fetchCurrentPeriodState(): Promise<CurrentPeriodState> {
  try {
    return await studentPb.send<CurrentPeriodState>('/api/had/student/current-period', {
      method: 'GET',
    })
  } catch (error) {
    throw mapError(error, '無法載入申請梯次資訊')
  }
}

export interface PeriodBootstrapResponse {
  period: ApplicationPeriod
  existing_profile: PeriodStudentProfile | null
  previous_period: ApplicationPeriod | null
  previous_profile: PeriodStudentProfile | null
  defaults: {
    grade: string
    bank_account_registered: boolean
    bank_account_note: string
    has_applied_before: boolean
  }
}

export async function fetchPeriodBootstrap(): Promise<PeriodBootstrapResponse> {
  try {
    return await studentPb.send<PeriodBootstrapResponse>(
      '/api/had/student/period-profile/bootstrap',
      { method: 'GET' },
    )
  } catch (error) {
    throw mapError(error, '無法載入本學期確認資料')
  }
}

export interface ConfirmPeriodProfileInput {
  grade: string
  application_identity_types: string[]
  disability_level?: string
  weak_aid_level?: string
  bank_account_registered: boolean
  bank_account_note?: string
  qualification_note?: string
  copy_from_previous?: boolean
}

export async function confirmPeriodProfile(
  input: ConfirmPeriodProfileInput,
): Promise<PeriodStudentProfile> {
  try {
    const data = await studentPb.send<{ profile: PeriodStudentProfile }>(
      '/api/had/student/period-profile/confirm',
      { method: 'POST', body: input },
    )
    return data.profile
  } catch (error) {
    throw mapError(error, '確認失敗，請稍後再試')
  }
}

export async function updatePeriodProfile(
  input: ConfirmPeriodProfileInput,
): Promise<PeriodStudentProfile> {
  try {
    const data = await studentPb.send<{ profile: PeriodStudentProfile }>(
      '/api/had/student/period-profile/update',
      { method: 'POST', body: input },
    )
    return data.profile
  } catch (error) {
    throw mapError(error, '更新失敗，請稍後再試')
  }
}

export interface CurrentCategoriesResponse {
  period: ApplicationPeriod
  period_profile: PeriodStudentProfile
  items: Array<{
    category: ApplicationCategory
    entry: StudentCategoryEntry | null
    previous_entry: StudentCategoryEntry | null
  }>
  started_count: number
  min_application_count: number
  min_application_rule: string
}

export async function fetchCurrentCategories(): Promise<CurrentCategoriesResponse> {
  try {
    return await studentPb.send<CurrentCategoriesResponse>(
      '/api/had/student/current/categories',
      { method: 'GET' },
    )
  } catch (error) {
    throw mapError(error, '無法載入申請項目')
  }
}

export async function startCategory(code: string): Promise<{
  entry: StudentCategoryEntry
  category: ApplicationCategory
}> {
  try {
    return await studentPb.send(`/api/had/student/current/categories/${code}/start`, {
      method: 'POST',
    })
  } catch (error) {
    throw mapError(error, '無法開始申請項目')
  }
}

export async function copyPreviousCategory(code: string): Promise<{
  entry: StudentCategoryEntry
  category: ApplicationCategory
  message: string
}> {
  try {
    return await studentPb.send(`/api/had/student/current/categories/${code}/copy-previous`, {
      method: 'POST',
    })
  } catch (error) {
    throw mapError(error, '無法套用上一期項目')
  }
}

export async function fetchStudentHistory(): Promise<HistoryPeriodSummary[]> {
  try {
    const data = await studentPb.send<{ items: HistoryPeriodSummary[] }>(
      '/api/had/student/history',
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入歷史紀錄')
  }
}

export async function fetchStudentHistoryDetail(periodId: string): Promise<{
  period: ApplicationPeriod
  profile: PeriodStudentProfile
  entries: Array<{ entry: StudentCategoryEntry; category: ApplicationCategory | null }>
}> {
  try {
    return await studentPb.send(`/api/had/student/history/${periodId}`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入歷史詳情')
  }
}

export async function adminListPeriods(): Promise<ApplicationPeriod[]> {
  try {
    const data = await staffPb.send<{ items: ApplicationPeriod[] }>('/api/had/admin/periods', {
      method: 'GET',
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入梯次')
  }
}

export type AdminPeriodInput = {
  name: string
  academic_year: number
  semester: '1' | '2'
  start_at: string
  end_at: string
  status: ApplicationPeriod['status']
  active: boolean
  description?: string
  min_application_count: number
  min_application_rule: 'warning_only' | 'enforced'
  sort_order: number
}

export async function adminCreatePeriod(input: AdminPeriodInput): Promise<ApplicationPeriod> {
  try {
    const data = await staffPb.send<{ period: ApplicationPeriod }>('/api/had/admin/periods', {
      method: 'POST',
      body: input,
    })
    return data.period
  } catch (error) {
    throw mapError(error, '建立梯次失敗')
  }
}

export async function adminUpdatePeriod(
  id: string,
  input: AdminPeriodInput,
): Promise<ApplicationPeriod> {
  try {
    const data = await staffPb.send<{ period: ApplicationPeriod }>(
      `/api/had/admin/periods/${id}`,
      { method: 'POST', body: input },
    )
    return data.period
  } catch (error) {
    throw mapError(error, '更新梯次失敗')
  }
}

export async function adminListCategories(): Promise<ApplicationCategory[]> {
  try {
    const data = await staffPb.send<{ items: ApplicationCategory[] }>(
      '/api/had/admin/categories',
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入申請項目')
  }
}

export async function adminUpdateCategory(
  id: string,
  input: Partial<Pick<ApplicationCategory, 'name' | 'description' | 'active' | 'sort_order'>>,
): Promise<ApplicationCategory> {
  try {
    const data = await staffPb.send<{ category: ApplicationCategory }>(
      `/api/had/admin/categories/${id}`,
      { method: 'POST', body: input },
    )
    return data.category
  } catch (error) {
    throw mapError(error, '更新申請項目失敗')
  }
}

export async function adminListStudents(query = ''): Promise<
  Array<{
    id: string
    student_no: string
    name: string
    department_name: string
    identity_masked: string
  }>
> {
  try {
    const data = await staffPb.send<{
      items: Array<{
        id: string
        student_no: string
        name: string
        department_name: string
        identity_masked: string
      }>
    }>('/api/had/admin/students', {
      method: 'GET',
      query: { q: query },
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入學生列表')
  }
}

export async function adminGetStudentDetail(id: string): Promise<{
  student: { id: string; student_no: string }
  profile: {
    name: string
    department_name: string
    grade: string
    email: string
    phone: string
    identity_number_masked: string
  }
  period_profiles: Array<{
    profile: PeriodStudentProfile
    period: ApplicationPeriod | null
  }>
}> {
  try {
    return await staffPb.send(`/api/had/admin/students/${id}`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入學生詳情')
  }
}
