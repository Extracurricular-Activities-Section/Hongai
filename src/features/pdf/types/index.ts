export type PdfDocumentStatus = 'valid' | 'superseded' | 'revoked'
export type PdfGeneratedByType = 'student' | 'staff' | 'admin' | 'system'
export type SignatureUploadMode = 'disabled' | 'optional' | 'required'

export interface PdfDocument {
  id: string
  student: string
  period: string
  category: string
  submission: string
  submission_version: string
  document_number: string
  document_version: number
  status: PdfDocumentStatus
  file_sha256: string
  generated_at: string | null
  generated_by_type: PdfGeneratedByType
  superseded_by?: string | null
  revoked_at?: string | null
  revoke_reason?: string | null
  created: string
  updated: string
  student_no?: string
  category_name?: string
}

export interface PdfGenerationResult {
  document: PdfDocument
  message: string
}

export interface PdfVerificationResult {
  status: PdfDocumentStatus | 'unknown'
  message: string
  document_number?: string
  document_version?: number
  category_name?: string | null
  academic_year?: number | null
  semester?: string | null
  generated_at?: string | null
}

export interface PdfApprovalBlock {
  code: string
  title: string
  checkboxes: string[]
  show_opinion: boolean
  show_signature: boolean
  optional?: boolean
}

export interface PdfCategoryConfig {
  title: string
  student_confirmation_text: string
  signature_upload_mode: SignatureUploadMode
  approval_blocks: PdfApprovalBlock[]
}
