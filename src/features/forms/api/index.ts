import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { FormIssue, FormSchema, FormValues } from '@/features/forms/types'
import type { ApplicationPeriod, PeriodStudentProfile } from '@/types'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) return new Error(message)
    if (Array.isArray(error.response?.issues) && error.response.issues[0]?.message) {
      return new Error(String(error.response.issues[0].message))
    }
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

export interface FormWorkspaceResponse {
  period: ApplicationPeriod
  category: { id: string; code: string; name: string }
  submission: {
    id: string
    status: 'draft' | 'completed'
    current_version_number: number
    last_saved_at: string | null
    completed_at: string | null
    form_version: string
  }
  schema: FormSchema
  answers: FormValues
  applicant: Record<string, unknown>
  period_profile: PeriodStudentProfile | Record<string, unknown>
}

export async function fetchFormWorkspace(categoryCode: string): Promise<FormWorkspaceResponse> {
  try {
    return await studentPb.send(`/api/hk/forms/by-category/${categoryCode}/workspace`, {
      method: 'GET',
    })
  } catch (error) {
    throw mapError(error, '無法載入表單')
  }
}

export async function saveFormSubmission(input: {
  submission_id: string
  answers: FormValues
  create_snapshot?: boolean
}): Promise<{
  submission_id: string
  status: string
  last_saved_at: string
  answers: FormValues
  issues: FormIssue[]
}> {
  try {
    return await studentPb.send('/api/hk/forms/submission/save', {
      method: 'POST',
      body: input,
    })
  } catch (error) {
    throw mapError(error, '儲存失敗')
  }
}

export async function completeFormSubmission(input: {
  submission_id: string
  answers: FormValues
}): Promise<{
  submission_id: string
  status: string
  completed_at: string
  issues: FormIssue[]
}> {
  try {
    return await studentPb.send('/api/hk/forms/submission/complete', {
      method: 'POST',
      body: input,
    })
  } catch (error) {
    throw mapError(error, '完成填寫失敗')
  }
}

export async function copyPreviousFormSubmission(categoryCode: string): Promise<{
  submission_id: string
  answers: FormValues
  message: string
}> {
  try {
    return await studentPb.send('/api/hk/forms/submission/copy-previous', {
      method: 'POST',
      body: { category_code: categoryCode },
    })
  } catch (error) {
    throw mapError(error, '套用上一期失敗')
  }
}

export async function fetchHistoryForm(
  periodId: string,
  categoryCode: string,
): Promise<{
  period: ApplicationPeriod
  category: { id: string; code: string; name: string }
  submission: {
    id: string
    status: string
    current_version_number: number
    completed_at: string | null
  }
  latest_version: {
    id: string
    version_number: number
    reason: string
    created: string
    snapshot: Record<string, unknown>
  }
  schema: FormSchema
  answers: FormValues
  applicant: Record<string, unknown>
  period_profile: Record<string, unknown>
}> {
  try {
    return await studentPb.send(`/api/hk/forms/history/${periodId}/${categoryCode}`, {
      method: 'GET',
    })
  } catch (error) {
    throw mapError(error, '無法載入歷史表單')
  }
}

export async function adminListForms(): Promise<
  Array<{
    id: string
    name: string
    description: string | null
    active: boolean
    category_code: string | null
    category_name: string | null
    current_published_version_id: string | null
    current_published_version_number: number | null
    current_published_status: string | null
  }>
> {
  try {
    const data = await staffPb.send<{ items: Array<Record<string, unknown>> }>(
      '/api/hk/admin/forms',
      { method: 'GET' },
    )
    return data.items as never
  } catch (error) {
    throw mapError(error, '無法載入表單列表')
  }
}

export async function adminPreviewFormVersion(
  formId: string,
  versionId: string,
): Promise<{ schema: FormSchema }> {
  try {
    return await staffPb.send(`/api/hk/admin/forms/${formId}/versions/${versionId}/preview`, {
      method: 'GET',
    })
  } catch (error) {
    throw mapError(error, '無法預覽表單')
  }
}
