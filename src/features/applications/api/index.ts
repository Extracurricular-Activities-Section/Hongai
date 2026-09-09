import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { Department, StaffUser } from '@/types'
import type {
  AdminApplicationDetail,
  Application,
  ApplicationActionPayload,
  ApplicationAssignPayload,
  ApplicationListParams,
  ApplicationListResponse,
  ApplicationSummaryCounts,
  CategoryDepartmentAssignment,
  FundingCreatePayload,
  FundingPreviewResponse,
  StaffUserAdmin,
  StudentApplicationDetail,
  SupplementRequest,
} from '../types'
import type { FundingDecision, FundingDecisionItem } from '@/features/funding/types'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) return new Error(message)
    if (error.status === 403) return new Error('無權限')
    if (error.status === 401) return new Error('請先登入')
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export async function submitApplication(submissionId: string): Promise<{
  application: Application
  message: string
}> {
  try {
    return await studentPb.send('/api/had/applications/submit', {
      method: 'POST',
      body: { submission_id: submissionId },
    })
  } catch (error) {
    throw mapError(error, '送件失敗')
  }
}

export async function listMyApplications(): Promise<Application[]> {
  try {
    const data = await studentPb.send<{ items: Application[] }>('/api/had/applications/mine', {
      method: 'GET',
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入申請案件')
  }
}

export async function getMyApplication(id: string): Promise<StudentApplicationDetail> {
  try {
    return await studentPb.send(`/api/had/applications/mine/${id}`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入申請詳情')
  }
}

export async function replySupplement(
  id: string,
  reply: string,
  attachmentIds: string[] = [],
): Promise<{ message: string; supplements: SupplementRequest[] }> {
  try {
    return await studentPb.send(`/api/had/applications/${id}/supplement-reply`, {
      method: 'POST',
      body: { reply, attachment_ids: attachmentIds },
    })
  } catch (error) {
    throw mapError(error, '補件回覆失敗')
  }
}

// ---------------------------------------------------------------------------
// Admin / Staff applications
// ---------------------------------------------------------------------------

export async function adminApplicationsSummary(): Promise<ApplicationSummaryCounts> {
  try {
    return await staffPb.send('/api/had/admin/applications/summary', { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入案件摘要')
  }
}

export async function adminListApplications(
  params: ApplicationListParams = {},
): Promise<ApplicationListResponse> {
  try {
    const query: Record<string, string> = {}
    if (params.q) query.q = params.q
    if (params.period) query.period = params.period
    if (params.category) query.category = params.category
    if (params.status) query.status = params.status
    if (params.eligibility_status) query.eligibility_status = params.eligibility_status
    if (params.department) query.department = params.department
    if (params.page != null) query.page = String(params.page)
    if (params.perPage != null) query.perPage = String(params.perPage)
    if (params.sort) query.sort = params.sort
    return await staffPb.send('/api/had/admin/applications', {
      method: 'GET',
      query,
    })
  } catch (error) {
    throw mapError(error, '無法載入案件列表')
  }
}

export async function adminGetApplication(id: string): Promise<AdminApplicationDetail> {
  try {
    return await staffPb.send(`/api/had/admin/applications/${id}`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入案件詳情')
  }
}

export async function adminApplicationAction(
  id: string,
  payload: ApplicationActionPayload,
): Promise<{ application: Application; message: string }> {
  try {
    return await staffPb.send(`/api/had/admin/applications/${id}/action`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '操作失敗')
  }
}

export async function adminAssignApplication(
  id: string,
  payload: ApplicationAssignPayload,
): Promise<{ application: Application; assignment: unknown }> {
  try {
    return await staffPb.send(`/api/had/admin/applications/${id}/assign`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '指派失敗')
  }
}

export async function adminFundingPreview(id: string): Promise<FundingPreviewResponse> {
  try {
    return await staffPb.send(`/api/had/admin/applications/${id}/funding-preview`, {
      method: 'GET',
    })
  } catch (error) {
    throw mapError(error, '無法載入核定預覽')
  }
}

export async function adminCreateFunding(
  id: string,
  payload: FundingCreatePayload,
): Promise<{
  application: Application
  funding: FundingDecision & { items: FundingDecisionItem[] }
  warnings: unknown[]
  message: string
}> {
  try {
    return await staffPb.send(`/api/had/admin/applications/${id}/funding`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '核定失敗')
  }
}

// ---------------------------------------------------------------------------
// Admin staff users / departments / assignments
// ---------------------------------------------------------------------------

export async function adminListStaffUsers(): Promise<StaffUserAdmin[]> {
  try {
    const data = await staffPb.send<{ items: StaffUserAdmin[] }>('/api/had/admin/staff-users', {
      method: 'GET',
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入承辦帳號')
  }
}

export async function adminCreateStaffUser(input: {
  email: string
  password: string
  name: string
  is_staff?: boolean
  is_admin?: boolean
  active?: boolean
  phone?: string
  job_title?: string
  notes?: string
  department_ids?: string[]
}): Promise<StaffUser> {
  try {
    const data = await staffPb.send<{ staff_user: StaffUser }>('/api/had/admin/staff-users', {
      method: 'POST',
      body: input,
    })
    return data.staff_user
  } catch (error) {
    throw mapError(error, '建立帳號失敗')
  }
}

export async function adminUpdateStaffUser(
  id: string,
  input: {
    email?: string
    password?: string
    name?: string
    is_staff?: boolean
    is_admin?: boolean
    active?: boolean
    phone?: string
    job_title?: string
    notes?: string
  },
): Promise<StaffUser> {
  try {
    const data = await staffPb.send<{ staff_user: StaffUser }>(`/api/had/admin/staff-users/${id}`, {
      method: 'POST',
      body: input,
    })
    return data.staff_user
  } catch (error) {
    throw mapError(error, '更新帳號失敗')
  }
}

export async function adminListDepartmentsApi(): Promise<Department[]> {
  try {
    const data = await staffPb.send<{ items: Department[] }>('/api/had/admin/departments', {
      method: 'GET',
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入單位')
  }
}

export async function adminSaveDepartment(input: {
  id?: string
  name?: string
  code?: string
  active?: boolean
  description?: string
  sort_order?: number
  deactivate?: boolean
}): Promise<Department> {
  try {
    const data = await staffPb.send<{ department: Department }>('/api/had/admin/departments', {
      method: 'POST',
      body: input,
    })
    return data.department
  } catch (error) {
    throw mapError(error, '儲存單位失敗')
  }
}

export async function adminListCategoryDepartmentAssignments(
  category?: string,
): Promise<CategoryDepartmentAssignment[]> {
  try {
    const data = await staffPb.send<{ items: CategoryDepartmentAssignment[] }>(
      '/api/had/admin/category-department-assignments',
      {
        method: 'GET',
        query: category ? { category } : {},
      },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入類別單位指派')
  }
}

export async function adminSaveCategoryDepartmentAssignment(input: {
  id?: string
  category?: string
  department?: string
  assignment_type?: string
  active?: boolean
}): Promise<CategoryDepartmentAssignment> {
  try {
    const data = await staffPb.send<{ assignment: CategoryDepartmentAssignment }>(
      '/api/had/admin/category-department-assignments',
      {
        method: 'POST',
        body: input,
      },
    )
    return data.assignment
  } catch (error) {
    throw mapError(error, '儲存類別單位指派失敗')
  }
}
