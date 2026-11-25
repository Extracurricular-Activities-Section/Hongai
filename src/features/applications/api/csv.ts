import { ClientResponseError } from 'pocketbase'

import { staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'

export interface ApplicationCsvFilters {
  q?: string
  status?: string
  eligibility_status?: string
  period?: string
  category?: string
}

export interface ApplicationCsvImportResult {
  updated: Array<{ application_number: string; approved_total: number }>
  errors: Array<{ application_number: string; message: string }>
  message: string
}

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

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get('Content-Disposition') || ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      /* fall through */
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] || fallback
}

/** Download the authorized case list as CSV (opens in Excel). `items` = funding-item import template. */
export async function adminDownloadApplicationsCsv(
  filters: ApplicationCsvFilters = {},
  format: 'applications' | 'items' = 'applications',
): Promise<void> {
  try {
    const url = new URL(`${staffPb.baseURL.replace(/\/+$/, '')}/api/hk/admin/applications/export.csv`)
    for (const [key, value] of Object.entries(filters)) {
      if (value) url.searchParams.set(key, value)
    }
    if (format === 'items') url.searchParams.set('format', 'items')

    const token = staffPb.authStore.token
    const response = await fetch(url.toString(), {
      headers: token ? { Authorization: token } : {},
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(body?.message || `匯出失敗（${response.status}）`)
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filenameFrom(response, 'applications.csv')
    link.click()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    if (error instanceof Error && !(error instanceof ClientResponseError)) throw error
    throw mapError(error, '匯出失敗')
  }
}

export async function adminImportApprovedAmountsCsv(
  csv: string,
  changeReason?: string,
): Promise<ApplicationCsvImportResult> {
  try {
    return await staffPb.send('/api/hk/admin/applications/import.csv', {
      method: 'POST',
      body: { csv, change_reason: changeReason || undefined },
    })
  } catch (error) {
    throw mapError(error, '匯入失敗')
  }
}

export interface ApprovalNoticeResult {
  notification_id: string
  delivery: { id: string; status: string } | null
  download_url: string
  message: string
}

/** Admin: send the approval notice with attachment download references. */
export async function adminSendApprovalNotice(
  applicationId: string,
  studentMessage?: string,
): Promise<ApprovalNoticeResult> {
  try {
    return await staffPb.send(`/api/hk/admin/applications/${applicationId}/send-approval-notice`, {
      method: 'POST',
      body: { student_message: studentMessage || undefined },
    })
  } catch (error) {
    throw mapError(error, '寄送通過通知失敗')
  }
}
