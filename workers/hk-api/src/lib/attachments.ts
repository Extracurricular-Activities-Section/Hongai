/**
 * Attachment validation and metadata helpers.
 * Ported from legacy pb_hooks/hk_attachment_security.js + hk_attachments.pb.js.
 *
 * Bytes live in hk_applications.files; metadata lives in hk_applications.files_json[].
 * Attachment ids are "<application id>-<random hex>" so the owning record is known
 * without scanning. No malware scanner is configured — never claim otherwise.
 */

type Row = Record<string, unknown>

export type AttachmentContext = 'application' | 'signed_document' | 'supplement' | 'follow_up'

export const ATTACHMENT_CONTEXTS: AttachmentContext[] = [
  'application',
  'signed_document',
  'supplement',
  'follow_up',
]

const ALLOWED_EXTENSIONS: Record<AttachmentContext, string[]> = {
  application: ['pdf', 'jpg', 'jpeg', 'png', 'docx'],
  follow_up: ['pdf', 'jpg', 'jpeg', 'png', 'docx'],
  signed_document: ['pdf', 'jpg', 'jpeg', 'png'],
  supplement: ['pdf', 'jpg', 'jpeg', 'png'],
}

const FORBIDDEN_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'ps1', 'sh', 'bash', 'dll', 'sys', 'drv', 'cpl', 'jar', 'war', 'apk', 'dmg', 'iso', 'img',
  'html', 'htm', 'svg', 'php', 'asp', 'aspx', 'jsp', 'cgi', 'pl', 'py', 'rb', 'hta', 'lnk',
  'reg', 'inf', 'docm', 'xlsm', 'pptm', 'rtf',
])

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export const DEFAULT_MAX_UPLOAD_MB = 10
/** hk_applications.files maxSize in the schema. */
export const SCHEMA_MAX_UPLOAD_MB = 20

export const ATTACHMENT_ID_PATTERN = '([a-z0-9]{15})-([a-f0-9]{16})'

export function allowedExtensionsFor(context: AttachmentContext): string[] {
  return [...ALLOWED_EXTENSIONS[context]]
}

export function sanitizeOriginalFilename(name: string): string {
  let value = String(name ?? '').replace(/\\/g, '/')
  value = value.split('/').pop() || ''
  value = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim()
  if (!value) value = 'file'
  if (value.length > 180) {
    const ext = extensionOf(value)
    value = ext ? `${value.slice(0, 160)}.${ext}` : value.slice(0, 160)
  }
  return value
}

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index < 0 || index === filename.length - 1) return ''
  return filename.slice(index + 1).toLowerCase()
}

function sniffKind(head: Uint8Array): 'pdf' | 'jpeg' | 'png' | 'zip' | null {
  const at = (i: number) => (i < head.length ? head[i] : -1)
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return 'pdf'
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg'
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png'
  if (at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04) return 'zip'
  return null
}

const KIND_FOR_EXT: Record<string, ReturnType<typeof sniffKind>> = {
  pdf: 'pdf',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  docx: 'zip',
}

export function validateUpload(input: {
  filename: string
  bytes: Uint8Array
  allowedExtensions: string[]
  maxSizeMb: number
}): { ok: true; extension: string; mimeType: string } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const ext = extensionOf(input.filename)
  if (!ext) errors.push('檔名缺少副檔名')
  else if (FORBIDDEN_EXTENSIONS.has(ext)) errors.push(`不允許的檔案類型：${ext}`)
  else if (!input.allowedExtensions.includes(ext)) errors.push(`此情境不支援 .${ext} 檔案`)

  const size = input.bytes.byteLength
  if (size <= 0) errors.push('檔案大小無效')
  else if (size > input.maxSizeMb * 1024 * 1024) errors.push(`檔案超過大小上限（${input.maxSizeMb}MB）`)

  if (!errors.length) {
    const kind = sniffKind(input.bytes.subarray(0, 16))
    if (kind !== KIND_FOR_EXT[ext]) errors.push(`檔案內容與副檔名 .${ext} 不符`)
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, extension: ext, mimeType: MIME_BY_EXT[ext] }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function newAttachmentId(applicationId: string): string {
  return `${applicationId}-${randomHex(8)}`
}

export function storedFilename(extension: string): string {
  return `hk_${randomHex(12)}.${extension}`
}

export function contentDisposition(originalFilename: string, disposition: 'inline' | 'attachment') {
  const name = sanitizeOriginalFilename(originalFilename)
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download'
  const encoded = encodeURIComponent(name).replace(
    /['()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export function attachmentsOf(application: Row): Row[] {
  return Array.isArray(application.files_json) ? (application.files_json as Row[]) : []
}

export function attachmentToPlain(application: Row, entry: Row): Row {
  const text = (value: unknown) => (value == null || value === '' ? null : String(value))
  return {
    id: String(entry.id),
    owner_student: String(application.student ?? ''),
    application: String(application.id),
    submission: String(application.id),
    supplement_request: text(entry.supplement_request),
    follow_up_task: text(entry.follow_up_task),
    attachment_type: String(entry.attachment_type ?? ''),
    field_code: text(entry.field_code),
    original_filename: String(entry.original_filename ?? ''),
    stored_filename: '',
    mime_type: String(entry.mime_type ?? ''),
    extension: String(entry.extension ?? ''),
    size_bytes: Number(entry.size_bytes ?? 0),
    sha256: String(entry.sha256 ?? ''),
    status: String(entry.status ?? ''),
    uploaded_by_type: String(entry.uploaded_by_type ?? ''),
    uploaded_by_student: text(entry.uploaded_by_student),
    uploaded_by_staff: text(entry.uploaded_by_staff),
    scan_status: String(entry.scan_status ?? 'not_configured'),
    created: String(entry.created ?? ''),
    updated: String(entry.updated ?? ''),
  }
}

/** Ids from a request that are active attachments of this application with the given type. */
export function ownActiveAttachmentIds(application: Row, ids: unknown, type: AttachmentContext): string[] {
  if (!Array.isArray(ids)) return []
  const valid = new Set(
    attachmentsOf(application)
      .filter((entry) => entry.status === 'active' && entry.attachment_type === type)
      .map((entry) => String(entry.id)),
  )
  return [...new Set(ids.map(String))].filter((id) => valid.has(id))
}
