import { ClientResponseError } from 'pocketbase'

import { staffPb, studentPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'

export interface SignatureRecord {
  signer_name: string
  signed_at: string
  user_agent?: string
  has_signature_image: boolean
  signature_data_url?: string | null
  /** student */
  confirmed?: boolean
  confirmation_text?: string
  /** teacher */
  signer_email?: string | null
  method?: 'canvas' | 'paper'
  status?: 'registered' | 'confirmed'
  confirmed_at?: string | null
}

export interface TeacherNotification {
  id: string
  email: string
  channel_email: string
  created: string
  requested_by_type: string
}

export interface ApplicationSignatures {
  student: SignatureRecord | null
  teacher: SignatureRecord | null
  teacher_email: string | null
  teacher_notifications: TeacherNotification[]
}

export interface NotifyTeacherResult {
  teacher_email: string
  in_app: { status: string }
  email: { status: string; error_code?: string; message?: string }
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

const userAgent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)

// --- Student -------------------------------------------------------------

export async function getMySignatures(
  applicationId: string,
): Promise<{ signatures: ApplicationSignatures; default_signer_name: string; teacher_email: string | null }> {
  try {
    return await studentPb.send(`/api/hk/applications/${applicationId}/signatures`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入簽名資料')
  }
}

export async function saveStudentSignature(
  applicationId: string,
  input: { signer_name: string; signature_data_url: string; confirmed: boolean },
): Promise<{ signatures: ApplicationSignatures; message: string }> {
  try {
    return await studentPb.send(`/api/hk/applications/${applicationId}/signatures`, {
      method: 'POST',
      body: { role: 'student', ...input, user_agent: userAgent() },
    })
  } catch (error) {
    throw mapError(error, '簽名儲存失敗')
  }
}

export async function studentNotifyTeacher(
  applicationId: string,
  teacherEmail?: string,
): Promise<NotifyTeacherResult> {
  try {
    return await studentPb.send(`/api/hk/applications/${applicationId}/notify-teacher`, {
      method: 'POST',
      body: { actor: 'student', teacher_email: teacherEmail || undefined },
    })
  } catch (error) {
    throw mapError(error, '通知導師失敗')
  }
}

// --- Staff ---------------------------------------------------------------

export async function adminGetSignatures(
  applicationId: string,
): Promise<{ signatures: ApplicationSignatures }> {
  try {
    return await staffPb.send(`/api/hk/admin/applications/${applicationId}/signatures`, {
      method: 'GET',
    })
  } catch (error) {
    throw mapError(error, '無法載入簽名資料')
  }
}

export async function adminSaveTeacherSignature(
  applicationId: string,
  input: {
    signer_name: string
    teacher_email?: string
    signature_data_url?: string
    signed_on_paper?: boolean
  },
): Promise<{ signatures: ApplicationSignatures; message: string }> {
  try {
    return await staffPb.send(`/api/hk/applications/${applicationId}/signatures`, {
      method: 'POST',
      body: { role: 'teacher', ...input, user_agent: userAgent() },
    })
  } catch (error) {
    throw mapError(error, '老師簽名登記失敗')
  }
}

export async function adminNotifyTeacher(
  applicationId: string,
  teacherEmail?: string,
): Promise<NotifyTeacherResult> {
  try {
    return await staffPb.send(`/api/hk/applications/${applicationId}/notify-teacher`, {
      method: 'POST',
      body: { actor: 'staff', teacher_email: teacherEmail || undefined },
    })
  } catch (error) {
    throw mapError(error, '通知導師失敗')
  }
}
