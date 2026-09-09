import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type {
  CategoryFollowUpTemplate,
  CreateCategoryTemplatePayload,
  CreateFollowUpTaskPayload,
  CreateTemplatePayload,
  FollowUpTask,
  FollowUpTaskDetail,
  FollowUpTaskTemplate,
  ReviewFollowUpTaskPayload,
  UpdateTemplatePayload,
} from '../types'

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

export async function listMyFollowUpTasks(applicationId?: string): Promise<FollowUpTask[]> {
  try {
    const data = await studentPb.send<{ items: FollowUpTask[] }>('/api/hk/follow-up/tasks', {
      method: 'GET',
      query: applicationId ? { application_id: applicationId } : {},
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入追蹤任務')
  }
}

export async function getMyFollowUpTask(id: string): Promise<FollowUpTaskDetail> {
  try {
    return await studentPb.send(`/api/hk/follow-up/tasks/${id}`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入任務詳情')
  }
}

export async function submitFollowUpTask(
  id: string,
  payload: { text_content?: string; attachment_ids?: string[] },
): Promise<{ task: FollowUpTask; message: string }> {
  try {
    return await studentPb.send(`/api/hk/follow-up/tasks/${id}/submit`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '繳交失敗')
  }
}

// ---------------------------------------------------------------------------
// Admin / Staff
// ---------------------------------------------------------------------------

export async function adminListFollowUpTasks(params?: {
  application_id?: string
  status?: string
}): Promise<FollowUpTask[]> {
  try {
    const query: Record<string, string> = {}
    if (params?.application_id) query.application_id = params.application_id
    if (params?.status) query.status = params.status
    const data = await staffPb.send<{ items: FollowUpTask[] }>('/api/hk/admin/follow-up/tasks', {
      method: 'GET',
      query,
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入追蹤任務')
  }
}

export async function adminGetFollowUpTask(id: string): Promise<FollowUpTaskDetail> {
  try {
    return await staffPb.send(`/api/hk/admin/follow-up/tasks/${id}`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入任務詳情')
  }
}

export async function adminCreateFollowUpTask(
  payload: CreateFollowUpTaskPayload,
): Promise<{ task: FollowUpTask; message: string }> {
  try {
    return await staffPb.send('/api/hk/admin/follow-up/tasks', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '建立任務失敗')
  }
}

export async function adminReviewFollowUpTask(
  id: string,
  payload: ReviewFollowUpTaskPayload,
): Promise<{ task: FollowUpTask; message: string }> {
  try {
    return await staffPb.send(`/api/hk/admin/follow-up/tasks/${id}/review`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '審核失敗')
  }
}

export async function adminWaiveFollowUpTask(
  id: string,
  waive_reason: string,
): Promise<{ task: FollowUpTask; message: string }> {
  try {
    return await staffPb.send(`/api/hk/admin/follow-up/tasks/${id}/waive`, {
      method: 'POST',
      body: { waive_reason },
    })
  } catch (error) {
    throw mapError(error, '豁免失敗')
  }
}

export async function adminUpdateFollowUpDueAt(
  id: string,
  due_at: string,
): Promise<{ task: FollowUpTask; message: string }> {
  try {
    return await staffPb.send(`/api/hk/admin/follow-up/tasks/${id}/due-at`, {
      method: 'POST',
      body: { due_at },
    })
  } catch (error) {
    throw mapError(error, '更新截止日失敗')
  }
}

export async function adminEnsureFollowUpTasks(
  applicationId: string,
): Promise<{ seeded: boolean; created: number; items: FollowUpTask[] }> {
  try {
    return await staffPb.send(`/api/hk/admin/applications/${applicationId}/ensure-follow-up-tasks`, {
      method: 'POST',
      body: {},
    })
  } catch (error) {
    throw mapError(error, '建立預設追蹤任務失敗')
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function adminListFollowUpTemplates(): Promise<FollowUpTaskTemplate[]> {
  try {
    const data = await staffPb.send<{ items: FollowUpTaskTemplate[] }>(
      '/api/hk/admin/follow-up/templates',
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入範本')
  }
}

export async function adminCreateFollowUpTemplate(
  payload: CreateTemplatePayload,
): Promise<{ template: FollowUpTaskTemplate }> {
  try {
    return await staffPb.send('/api/hk/admin/follow-up/templates', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '建立範本失敗')
  }
}

export async function adminUpdateFollowUpTemplate(
  id: string,
  payload: UpdateTemplatePayload,
): Promise<{ template: FollowUpTaskTemplate }> {
  try {
    return await staffPb.send(`/api/hk/admin/follow-up/templates/${id}`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '更新範本失敗')
  }
}

export async function adminListCategoryFollowUpTemplates(
  categoryId?: string,
): Promise<CategoryFollowUpTemplate[]> {
  try {
    const data = await staffPb.send<{ items: CategoryFollowUpTemplate[] }>(
      '/api/hk/admin/follow-up/category-templates',
      {
        method: 'GET',
        query: categoryId ? { category_id: categoryId } : {},
      },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入類別範本指派')
  }
}

export async function adminCreateCategoryFollowUpTemplate(
  payload: CreateCategoryTemplatePayload,
): Promise<{ assignment: CategoryFollowUpTemplate }> {
  try {
    return await staffPb.send('/api/hk/admin/follow-up/category-templates', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '建立類別指派失敗')
  }
}

export async function adminUpdateCategoryFollowUpTemplate(
  id: string,
  payload: Partial<{
    required: boolean
    requires_review_override: boolean
    due_rule: Record<string, unknown>
    sort_order: number
    active: boolean
  }>,
): Promise<{ assignment: CategoryFollowUpTemplate }> {
  try {
    return await staffPb.send(`/api/hk/admin/follow-up/category-templates/${id}`, {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '更新類別指派失敗')
  }
}
