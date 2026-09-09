import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'

export interface SignedDocument {
  id: string
  application: string
  student: string
  source_pdf: string
  attachment: string
  version_number: number
  status: string
  uploaded_at: string | null
  student_note: string | null
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created: string
  updated: string
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

export async function registerSignedDocument(input: {
  attachment_id: string
  application_id: string
  student_note?: string
}): Promise<{ signed_document: SignedDocument; message: string }> {
  try {
    return await studentPb.send('/api/had/signed-documents/upload', {
      method: 'POST',
      body: input,
    })
  } catch (error) {
    throw mapError(error, '已簽文件登錄失敗')
  }
}

export async function listSignedDocumentsByApplication(
  applicationId: string,
  asStaff = false,
): Promise<SignedDocument[]> {
  try {
    const pb = asStaff ? staffPb : studentPb
    const data = await pb.send<{ items: SignedDocument[] }>(
      `/api/had/signed-documents/by-application/${applicationId}`,
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入已簽文件')
  }
}
