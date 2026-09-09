import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type {
  HadNotification,
  ListAdminDeliveriesParams,
  ListAdminNotificationsParams,
  ListStudentNotificationsParams,
  MailProviderStatus,
  NotificationDashboardSummary,
  NotificationDelivery,
  NotificationPreferences,
  NotificationTemplate,
  NotificationTemplatePreviewPayload,
  NotificationTemplatePreviewResult,
  NotificationTemplateUpsertPayload,
  UpdateNotificationPreferencesPayload,
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

export async function listMyNotifications(
  params?: ListStudentNotificationsParams,
): Promise<HadNotification[]> {
  try {
    const query: Record<string, string> = {}
    if (params?.filter) query.filter = params.filter
    if (params?.category) query.category = params.category
    const data = await studentPb.send<{ items: HadNotification[] }>('/api/had/notifications', {
      method: 'GET',
      query,
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入通知')
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const data = await studentPb.send<{ count?: number; unread?: number }>(
      '/api/had/notifications/unread-count',
      { method: 'GET' },
    )
    return Number(data.count ?? data.unread) || 0
  } catch (error) {
    throw mapError(error, '無法載入未讀數量')
  }
}

export async function getStaffUnreadNotificationCount(): Promise<number> {
  try {
    const data = await staffPb.send<{ unread?: number; count?: number }>(
      '/api/had/admin/notifications/unread-count',
      { method: 'GET' },
    )
    return Number(data.unread ?? data.count) || 0
  } catch (error) {
    throw mapError(error, '無法載入未讀數量')
  }
}

export async function markNotificationRead(
  id: string,
): Promise<{ notification: HadNotification; message: string }> {
  try {
    return await studentPb.send(`/api/had/notifications/${id}/read`, { method: 'POST', body: {} })
  } catch (error) {
    throw mapError(error, '標示已讀失敗')
  }
}

export async function markAllNotificationsRead(): Promise<{ updated: number; message: string }> {
  try {
    return await studentPb.send('/api/had/notifications/read-all', { method: 'POST', body: {} })
  } catch (error) {
    throw mapError(error, '全部標示已讀失敗')
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const data = await studentPb.send<{ preferences: NotificationPreferences }>(
      '/api/had/notifications/preferences',
      { method: 'GET' },
    )
    return data.preferences
  } catch (error) {
    throw mapError(error, '無法載入通知偏好')
  }
}

export async function updateNotificationPreferences(
  payload: UpdateNotificationPreferencesPayload,
): Promise<{ preferences: NotificationPreferences; message: string }> {
  try {
    return await studentPb.send('/api/had/notifications/preferences', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '更新偏好失敗')
  }
}

// ---------------------------------------------------------------------------
// Admin / Staff
// ---------------------------------------------------------------------------

export async function adminListNotifications(
  params?: ListAdminNotificationsParams,
): Promise<HadNotification[]> {
  try {
    const query: Record<string, string> = {}
    if (params?.student_id) query.student_id = params.student_id
    if (params?.application_id) query.application_id = params.application_id
    if (params?.category) query.category = params.category
    const data = await staffPb.send<{ items: HadNotification[] }>('/api/had/admin/notifications', {
      method: 'GET',
      query,
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入通知列表')
  }
}

export async function adminListDeliveries(
  params?: ListAdminDeliveriesParams,
): Promise<NotificationDelivery[]> {
  try {
    const query: Record<string, string> = {}
    if (params?.status) query.status = params.status
    if (params?.application_id) query.application_id = params.application_id
    const data = await staffPb.send<{ items: NotificationDelivery[] }>(
      '/api/had/admin/notifications/deliveries',
      { method: 'GET', query },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入寄送紀錄')
  }
}

export async function adminGetDelivery(id: string): Promise<NotificationDelivery> {
  try {
    const data = await staffPb.send<{ delivery: NotificationDelivery }>(
      `/api/had/admin/notifications/deliveries/${id}`,
      { method: 'GET' },
    )
    return data.delivery
  } catch (error) {
    throw mapError(error, '無法載入寄送詳情')
  }
}

export async function adminResendDelivery(
  id: string,
): Promise<{ delivery: NotificationDelivery; message: string }> {
  try {
    return await staffPb.send(`/api/had/admin/notifications/deliveries/${id}/resend`, {
      method: 'POST',
      body: {},
    })
  } catch (error) {
    throw mapError(error, '重新寄送失敗')
  }
}

export async function adminGetMailStatus(): Promise<MailProviderStatus> {
  try {
    const data = await staffPb.send<{ status: MailProviderStatus }>(
      '/api/had/admin/notifications/mail-status',
      { method: 'GET' },
    )
    return data.status
  } catch (error) {
    throw mapError(error, '無法載入郵件狀態')
  }
}

export async function adminGetNotificationDashboard(): Promise<NotificationDashboardSummary> {
  try {
    const data = await staffPb.send<{ summary: NotificationDashboardSummary }>(
      '/api/had/admin/notifications/dashboard',
      { method: 'GET' },
    )
    return data.summary
  } catch (error) {
    throw mapError(error, '無法載入通知儀表板')
  }
}

export async function adminListNotificationTemplates(): Promise<NotificationTemplate[]> {
  try {
    const data = await staffPb.send<{ items: NotificationTemplate[] }>(
      '/api/had/admin/notifications/templates',
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入通知範本')
  }
}

export async function adminUpsertNotificationTemplate(
  payload: NotificationTemplateUpsertPayload,
): Promise<{ template: NotificationTemplate; message: string }> {
  try {
    return await staffPb.send('/api/had/admin/notifications/templates', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '儲存範本失敗')
  }
}

export async function adminPreviewNotificationTemplate(
  payload: NotificationTemplatePreviewPayload,
): Promise<NotificationTemplatePreviewResult> {
  try {
    return await staffPb.send('/api/had/admin/notifications/templates/preview', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    throw mapError(error, '預覽失敗')
  }
}

export async function adminSeedNotificationTemplates(): Promise<{
  result: unknown
  message: string
}> {
  try {
    return await staffPb.send('/api/had/admin/notifications/seed', {
      method: 'POST',
      body: {},
    })
  } catch (error) {
    throw mapError(error, '種子資料失敗')
  }
}
