export type AttachmentContext =
  | 'application'
  | 'signed_document'
  | 'supplement'
  | 'follow_up'

export type AttachmentStatus = 'active' | 'deleted' | 'superseded' | 'quarantined'

export type AttachmentType =
  | 'application'
  | 'signed_document'
  | 'supplement'
  | 'follow_up'

export interface Attachment {
  id: string
  owner_student: string
  application: string | null
  submission: string | null
  supplement_request: string | null
  follow_up_task: string | null
  attachment_type: AttachmentType | string
  field_code: string | null
  original_filename: string
  stored_filename: string
  mime_type: string
  extension: string
  size_bytes: number
  sha256: string
  status: AttachmentStatus | string
  uploaded_by_type: string
  uploaded_by_student: string | null
  uploaded_by_staff: string | null
  scan_status: string
  created: string
  updated: string
}

export interface AttachmentBrief {
  id: string
  original_filename: string
  mime_type: string
  extension: string
  size_bytes: number
  status: string
}

export interface UploadAttachmentInput {
  file: File
  context: AttachmentContext
  submissionId?: string
  applicationId?: string
  fieldCode?: string
  supplementRequestId?: string
  followUpTaskId?: string
  replaceAttachmentId?: string
  /** Use staff client when uploading from admin UI */
  asStaff?: boolean
}

export interface FileFieldConfig {
  allowed_extensions?: string[]
  max_files?: number
  max_file_size_mb?: number
  placeholder_message?: string
}
