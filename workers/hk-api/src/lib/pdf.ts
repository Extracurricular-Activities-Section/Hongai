/**
 * PDF document helpers for the six-collection data layer.
 *
 * Bytes: hk_applications.files (+ files_json entry attachment_type=generated_pdf)
 * Metadata: workflow_json.pdf_documents[]
 * Verify / admin index: hk_events (system / pdf_token:* and pdf_document)
 */

import type PocketBase from 'pocketbase'

import { nowIso, workflowOf } from './application-workflow'
import { newAttachmentId, storedFilename } from './attachments'
import { toSchema } from './forms'

type Row = Record<string, unknown>

export const CATEGORY_SHORT_CODES: Record<string, string> = {
  academic_learning: 'ACAD',
  common_competency: 'COMM',
  language_certification: 'LANG',
  professional_certification: 'CERT',
  career_enhancement: 'CAREER',
  external_competition: 'COMP',
  overseas_study: 'OVERSEA',
  cross_domain_learning: 'CROSS',
  other: 'OTHER',
}

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

export function categoryShortCode(code: string): string {
  return CATEGORY_SHORT_CODES[code] || 'OTH'
}

export function buildDocumentNumber(
  academicYear: number,
  semester: string,
  categoryCode: string,
  serial: number,
): string {
  const seq = String(serial).padStart(6, '0')
  return `HAD-${academicYear}${semester}-${categoryShortCode(categoryCode)}-${seq}`
}

export function createVerificationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}

export function pdfDocumentsOf(application: Row): Row[] {
  return arr(workflowOf(application).pdf_documents)
}

export function withPdfDocuments(application: Row, documents: Row[]): Row {
  return { ...workflowOf(application), pdf_documents: documents }
}

export function pdfToPlain(doc: Row, extras: Row = {}): Row {
  return {
    id: str(doc.id),
    student: str(doc.student),
    period: str(doc.period),
    category: str(doc.category),
    submission: str(doc.submission),
    submission_version: str(doc.submission_version),
    document_number: str(doc.document_number),
    document_version: Number(doc.document_version) || 1,
    status: str(doc.status) || 'valid',
    file_sha256: str(doc.file_sha256),
    generated_at: doc.generated_at ? str(doc.generated_at) : null,
    generated_by_type: str(doc.generated_by_type) || 'student',
    superseded_by: doc.superseded_by ? str(doc.superseded_by) : null,
    revoked_at: doc.revoked_at ? str(doc.revoked_at) : null,
    revoke_reason: doc.revoke_reason ? str(doc.revoke_reason) : null,
    created: str(doc.created),
    updated: str(doc.updated),
    ...extras,
  }
}

export function applicationIdOfPdf(id: string): string | null {
  const match = /^([a-z0-9]{15})-[a-f0-9]{16}$/i.exec(id)
  return match ? match[1] : null
}

/** Allocate the next serial for HAD-{year}{sem}-{SHORT}-###### via hk_settings. */
export async function nextDocumentSerial(
  pb: PocketBase,
  academicYear: number,
  semester: string,
  categoryCode: string,
): Promise<number> {
  const key = `pdf_serial:${academicYear}${semester}:${categoryShortCode(categoryCode)}`
  try {
    const row = (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "system" && key = {:key}', { key }),
    )) as Row
    const current = Number(obj(row.value_json).next) || 1
    await pb.collection('hk_settings').update(str(row.id), {
      value_json: { next: current + 1 },
    })
    return current
  } catch {
    await pb.collection('hk_settings').create({
      setting_type: 'system',
      key,
      value_json: { next: 2 },
      active: true,
      label: `PDF serial ${key}`,
    })
    return 1
  }
}

export function assertSnapshotComplete(snapshot: Row) {
  if (!snapshot.studentProfileSnapshot) throw new Error('snapshot 缺少學生資料')
  if (!snapshot.periodProfileSnapshot) throw new Error('snapshot 缺少梯次資格資料')
  if (!snapshot.answers && !snapshot.computed) throw new Error('snapshot 缺少 answers')
  if (!snapshot.formVersion && !snapshot.form) throw new Error('snapshot 缺少 formVersion')
  if (!snapshot.category) throw new Error('snapshot 缺少 category')
}

export function schemaForRender(formRecord: Row): Row {
  return toSchema(formRecord)
}

export async function callPdfRender(
  env: {
    HK_PDF_SERVICE_URL?: string
    HK_PDF_SERVICE_SECRET?: string
  },
  payload: Row,
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const base = (env.HK_PDF_SERVICE_URL || '').replace(/\/$/, '')
  const secret = env.HK_PDF_SERVICE_SECRET || ''
  if (!base) {
    throw new Error(
      'PDF 服務未設定（HK_PDF_SERVICE_URL）。請部署 workers/hk-pdf Container 後再試。',
    )
  }
  if (!secret) {
    throw new Error('PDF 服務密鑰未設定（HK_PDF_SERVICE_SECRET）')
  }

  const response = await fetch(`${base}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HK-PDF-SECRET': secret,
      'X-HAD-PDF-SECRET': secret,
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let message = 'PDF 產生失敗'
    try {
      const data = (await response.json()) as { message?: string }
      if (data.message) message = data.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  const sha256 =
    response.headers.get('X-HK-SHA256') || response.headers.get('X-HAD-SHA256') || ''
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!sha256) throw new Error('PDF 服務未回傳 SHA-256')
  if (!bytes.byteLength) throw new Error('PDF 服務回傳空檔')
  return { bytes, sha256 }
}

export async function storePdfFile(
  pb: PocketBase,
  application: Row,
  bytes: Uint8Array,
  meta: {
    documentId: string
    documentNumber: string
    documentVersion: number
    sha256: string
    studentId: string
  },
): Promise<{ file: string; filesJson: Row[] }> {
  const applicationId = str(application.id)
  const before = new Set(Array.isArray(application.files) ? (application.files as string[]) : [])
  const filename = `${meta.documentNumber}-V${meta.documentVersion}.pdf`
  const payload = new FormData()
  payload.append(
    'files+',
    new File([bytes], storedFilename('pdf'), { type: 'application/pdf' }),
  )
  const uploaded = (await pb.collection('hk_applications').update(applicationId, payload)) as Row
  const storedName = (Array.isArray(uploaded.files) ? (uploaded.files as string[]) : []).find(
    (name) => !before.has(name),
  )
  if (!storedName) throw new Error('PDF 檔案儲存失敗，請重試')

  const now = nowIso()
  const entry: Row = {
    id: meta.documentId,
    file: storedName,
    attachment_type: 'generated_pdf',
    field_code: null,
    supplement_request: null,
    follow_up_task: null,
    original_filename: filename,
    mime_type: 'application/pdf',
    extension: 'pdf',
    size_bytes: bytes.byteLength,
    sha256: meta.sha256,
    status: 'active',
    uploaded_by_type: 'student',
    uploaded_by_student: meta.studentId,
    uploaded_by_staff: null,
    scan_status: 'not_configured',
    created: now,
    updated: now,
  }
  const filesJson = [
    ...arr(application.files_json).map((item) =>
      item.attachment_type === 'generated_pdf' && item.status === 'active'
        ? { ...item, status: 'superseded', updated: now }
        : item,
    ),
    entry,
  ]
  return { file: storedName, filesJson }
}

export function newPdfDocumentId(applicationId: string): string {
  return newAttachmentId(applicationId)
}

export async function upsertVerifyIndex(
  pb: PocketBase,
  input: {
    token: string
    applicationId: string
    documentId: string
    status: string
    document_number: string
    document_version: number
    category_name: string
    academic_year: number | null
    semester: string | null
    generated_at: string
    student_no?: string
  },
) {
  const key = `pdf_token:${input.token}`
  const payload = {
    document_id: input.documentId,
    application_id: input.applicationId,
    document_number: input.document_number,
    document_version: input.document_version,
    category_name: input.category_name,
    academic_year: input.academic_year,
    semester: input.semester,
    generated_at: input.generated_at,
    student_no: input.student_no || '',
  }
  try {
    const existing = (await pb.collection('hk_events').getFirstListItem(
      pb.filter('event_type = "system" && event_key = {:key}', { key }),
    )) as Row
    await pb.collection('hk_events').update(str(existing.id), {
      status: input.status,
      payload_json: payload,
      target_id: input.applicationId,
    })
  } catch {
    await pb.collection('hk_events').create({
      event_type: 'system',
      event_key: key,
      target_type: 'application',
      target_id: input.applicationId,
      payload_json: payload,
      status: input.status,
      occurred_at: nowIso(),
    })
  }

  // Admin list index (one row per document id)
  const docKey = `pdf_document:${input.documentId}`
  try {
    const existing = (await pb.collection('hk_events').getFirstListItem(
      pb.filter('event_type = "system" && event_key = {:key}', { key: docKey }),
    )) as Row
    await pb.collection('hk_events').update(str(existing.id), {
      status: input.status,
      payload_json: { ...payload, verification_token: input.token },
    })
  } catch {
    await pb.collection('hk_events').create({
      event_type: 'system',
      event_key: docKey,
      target_type: 'pdf',
      target_id: input.documentId,
      payload_json: { ...payload, verification_token: input.token },
      status: input.status,
      occurred_at: nowIso(),
    })
  }
}

export async function updateVerifyStatus(
  pb: PocketBase,
  token: string,
  documentId: string,
  status: string,
  extra: Row = {},
) {
  const tokenKey = `pdf_token:${token}`
  const docKey = `pdf_document:${documentId}`
  for (const key of [tokenKey, docKey]) {
    try {
      const row = (await pb.collection('hk_events').getFirstListItem(
        pb.filter('event_type = "system" && event_key = {:key}', { key }),
      )) as Row
      await pb.collection('hk_events').update(str(row.id), {
        status,
        payload_json: { ...obj(row.payload_json), ...extra },
      })
    } catch {
      // index may be missing for legacy rows
    }
  }
}
