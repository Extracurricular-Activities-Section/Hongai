import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { Attachment, UploadAttachmentInput } from '../types'

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

function clientFor(asStaff?: boolean) {
  return asStaff ? staffPb : studentPb
}

function authToken(): string {
  return studentPb.authStore.token || staffPb.authStore.token || ''
}

function baseUrl(): string {
  return import.meta.env.VITE_POCKETBASE_URL?.replace(/\/$/, '') || ''
}

export async function uploadAttachment(
  input: UploadAttachmentInput,
): Promise<{ attachment: Attachment; message: string }> {
  try {
    const form = new FormData()
    form.append('file', input.file)
    form.append('context', input.context)
    if (input.submissionId) form.append('submission_id', input.submissionId)
    if (input.applicationId) form.append('application_id', input.applicationId)
    if (input.fieldCode) form.append('field_code', input.fieldCode)
    if (input.supplementRequestId) form.append('supplement_request_id', input.supplementRequestId)
    if (input.followUpTaskId) form.append('follow_up_task_id', input.followUpTaskId)
    if (input.replaceAttachmentId) form.append('replace_attachment_id', input.replaceAttachmentId)

    const pb = clientFor(input.asStaff)
    return await pb.send('/api/hk/attachments/upload', {
      method: 'POST',
      body: form,
    })
  } catch (error) {
    throw mapError(error, '上傳失敗')
  }
}

export async function downloadAttachmentBlob(
  id: string,
  disposition: 'inline' | 'attachment' = 'attachment',
): Promise<{ blob: Blob; filename: string | null; mimeType: string | null }> {
  try {
    const token = authToken()
    const response = await fetch(
      `${baseUrl()}/api/hk/attachments/${encodeURIComponent(id)}/download?disposition=${disposition}`,
      { headers: token ? { Authorization: token } : {} },
    )
    if (!response.ok) {
      let message = '下載失敗'
      try {
        const data = (await response.json()) as { message?: string }
        if (data.message) message = data.message
      } catch {
        // ignore
      }
      throw new Error(message)
    }
    const blob = await response.blob()
    const dispositionHeader = response.headers.get('Content-Disposition') || ''
    const mimeType = response.headers.get('Content-Type')
    let filename: string | null = null
    const utfMatch = dispositionHeader.match(/filename\*=UTF-8''([^;]+)/i)
    const plainMatch = dispositionHeader.match(/filename="?([^";]+)"?/i)
    if (utfMatch?.[1]) {
      try {
        filename = decodeURIComponent(utfMatch[1])
      } catch {
        filename = utfMatch[1]
      }
    } else if (plainMatch?.[1]) {
      filename = plainMatch[1]
    }
    return { blob, filename, mimeType }
  } catch (error) {
    throw mapError(error, '下載失敗')
  }
}

export async function softDeleteAttachment(
  id: string,
  asStaff = false,
): Promise<{ attachment: Attachment; message: string }> {
  try {
    const pb = clientFor(asStaff)
    return await pb.send(`/api/hk/attachments/${id}/delete`, {
      method: 'POST',
      body: {},
    })
  } catch (error) {
    throw mapError(error, '刪除失敗')
  }
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function canPreviewExtension(ext: string): boolean {
  const normalized = ext.replace(/^\./, '').toLowerCase()
  return ['pdf', 'jpg', 'jpeg', 'png'].includes(normalized)
}
