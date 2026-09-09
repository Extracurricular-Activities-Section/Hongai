import { ClientResponseError } from 'pocketbase'

import { studentPb, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { PdfDocument, PdfGenerationResult, PdfVerificationResult } from '../types'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) return new Error(message)
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

export async function generatePdf(submissionId: string): Promise<PdfGenerationResult> {
  try {
    return await studentPb.send('/api/had/pdf/generate', {
      method: 'POST',
      body: { submission_id: submissionId },
    })
  } catch (error) {
    throw mapError(error, '產生 PDF 失敗')
  }
}

export async function listPdfsBySubmission(submissionId: string): Promise<PdfDocument[]> {
  try {
    const data = await studentPb.send<{ items: PdfDocument[] }>(
      `/api/had/pdf/by-submission/${submissionId}`,
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入 PDF 列表')
  }
}

export function pdfDownloadUrl(id: string): string {
  const base = import.meta.env.VITE_POCKETBASE_URL?.replace(/\/$/, '') || ''
  return `${base}/api/had/pdf/${id}/download`
}

export async function downloadPdfBlob(id: string): Promise<Blob> {
  try {
    const token = studentPb.authStore.token || staffPb.authStore.token
    const response = await fetch(pdfDownloadUrl(id), {
      headers: token ? { Authorization: token } : {},
    })
    if (!response.ok) throw new Error('下載失敗')
    return await response.blob()
  } catch (error) {
    throw mapError(error, '下載 PDF 失敗')
  }
}

export async function verifyPdfToken(token: string): Promise<PdfVerificationResult> {
  const base = import.meta.env.VITE_POCKETBASE_URL?.replace(/\/$/, '') || ''
  const response = await fetch(`${base}/api/had/pdf/verify/${encodeURIComponent(token)}`)
  if (!response.ok) {
    return { status: 'unknown', message: '查無此文件或驗證碼無效。' }
  }
  return (await response.json()) as PdfVerificationResult
}

export async function adminListDocuments(query = ''): Promise<PdfDocument[]> {
  try {
    const data = await staffPb.send<{ items: PdfDocument[] }>('/api/had/admin/documents', {
      method: 'GET',
      query: { q: query },
    })
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入文件列表')
  }
}

export async function adminRevokeDocument(id: string, revoke_reason: string): Promise<PdfDocument> {
  try {
    const data = await staffPb.send<{ document: PdfDocument }>(`/api/had/admin/pdf/${id}/revoke`, {
      method: 'POST',
      body: { revoke_reason },
    })
    return data.document
  } catch (error) {
    throw mapError(error, '撤銷失敗')
  }
}
