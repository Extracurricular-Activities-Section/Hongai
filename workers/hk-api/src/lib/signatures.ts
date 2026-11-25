import { WorkflowError, nowIso, workflowOf } from './application-workflow'
import { flattenFields } from './forms'

/**
 * Electronic signatures (canvas PNG + attestation) stored on
 * hk_applications.workflow_json.signatures.{student,teacher}.
 *
 * student: { signer_name, signature_data_url, confirmed, confirmation_text, signed_at, user_agent }
 * teacher: { signer_name, signer_email, signature_data_url|null, method: 'canvas'|'paper',
 *            signed_at, user_agent, registered_by_staff, status: 'registered'|'confirmed',
 *            confirmed_at, confirmed_by_staff }
 * Teacher notification attempts live in workflow_json.teacher_notifications[];
 * the resolved teacher email is remembered in workflow_json.teacher_email.
 *
 * The status transition itself (submitted -> teacher_signed) is the `mark_teacher_signed`
 * action in admin-applications; it calls confirmTeacherSignature() to stamp the teacher record.
 */

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

export const STUDENT_CONFIRMATION_TEXT = '本人確認以上資料屬實'
const MAX_DATA_URL_LENGTH = 400_000
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Statuses where signatures may no longer change. */
const LOCKED_STATUSES = new Set(['closed', 'rejected'])

export function signaturesOf(application: Row): { student: Row | null; teacher: Row | null } {
  const signatures = obj(workflowOf(application).signatures)
  const student = obj(signatures.student)
  const teacher = obj(signatures.teacher)
  return {
    student: Object.keys(student).length ? student : null,
    teacher: Object.keys(teacher).length ? teacher : null,
  }
}

/** Strip the heavy image when only metadata is needed. */
export function signatureView(entry: Row | null, includeImage: boolean): Row | null {
  if (!entry) return null
  const { signature_data_url: image, ...rest } = entry
  return {
    ...rest,
    has_signature_image: Boolean(image),
    ...(includeImage ? { signature_data_url: image ?? null } : {}),
  }
}

export function signaturesView(application: Row, includeImage: boolean) {
  const { student, teacher } = signaturesOf(application)
  return {
    student: signatureView(student, includeImage),
    teacher: signatureView(teacher, includeImage),
    teacher_email: findTeacherEmail(application, null),
    teacher_notifications: arr(workflowOf(application).teacher_notifications)
      .slice(-5)
      .reverse(),
  }
}

export function assertSignable(application: Row) {
  if (LOCKED_STATUSES.has(str(application.status))) {
    throw new WorkflowError(400, '此申請已結案或未通過，不可再更新簽名')
  }
}

function cleanName(value: unknown): string {
  const name = str(value).trim()
  if (!name) throw new WorkflowError(400, '請填寫簽署人姓名')
  if (name.length > 60) throw new WorkflowError(400, '簽署人姓名過長')
  return name
}

function cleanImage(value: unknown, required: boolean): string | null {
  const image = str(value).trim()
  if (!image) {
    if (required) throw new WorkflowError(400, '請先簽名')
    return null
  }
  if (image.length > MAX_DATA_URL_LENGTH) throw new WorkflowError(400, '簽名圖檔過大，請重新簽名')
  if (!PNG_DATA_URL.test(image)) throw new WorkflowError(400, '簽名格式無效（需為 PNG）')
  return image
}

function cleanUserAgent(body: Row, request: Request): string {
  return (str(body.user_agent).trim() || request.headers.get('user-agent') || '').slice(0, 300)
}

export function parseStudentSignature(body: Row, request: Request): Row {
  if (body.confirmed !== true) throw new WorkflowError(400, `請勾選「${STUDENT_CONFIRMATION_TEXT}」`)
  return {
    signer_name: cleanName(body.signer_name),
    signature_data_url: cleanImage(body.signature_data_url, true),
    confirmed: true,
    confirmation_text: STUDENT_CONFIRMATION_TEXT,
    signed_at: nowIso(),
    user_agent: cleanUserAgent(body, request),
  }
}

export function parseTeacherSignature(body: Row, request: Request, staffId: string): Row {
  const image = cleanImage(body.signature_data_url, false)
  const paper = body.signed_on_paper === true
  if (!image && !paper) throw new WorkflowError(400, '請簽名，或勾選「老師已於紙本簽名」')
  const email = str(body.teacher_email).trim()
  if (email && !EMAIL_PATTERN.test(email)) throw new WorkflowError(400, '導師 email 格式不正確')
  return {
    signer_name: cleanName(body.signer_name),
    signer_email: email || null,
    signature_data_url: image,
    method: image ? 'canvas' : 'paper',
    signed_at: nowIso(),
    user_agent: cleanUserAgent(body, request),
    registered_by_staff: staffId,
    status: 'registered',
    confirmed_at: null,
    confirmed_by_staff: null,
  }
}

/** Teacher email: explicit input, then a form answer that looks like one, then the stored value. */
export function findTeacherEmail(application: Row, form: Row | null, explicit?: string): string | null {
  const direct = str(explicit).trim()
  if (direct) return direct

  const answers = obj(application.answers_json)
  const looksLikeEmail = (value: unknown) => EMAIL_PATTERN.test(str(value).trim())
  const codePattern = /(teacher|advisor|adviser|tutor|mentor).*mail|mail.*(teacher|advisor|adviser|tutor|mentor)/i
  const labelPattern = /導師|輔導老師|指導老師|系輔/
  const labelMail = /e-?mail|信箱|電子郵件/i

  for (const [code, value] of Object.entries(answers)) {
    if (codePattern.test(code) && looksLikeEmail(value)) return str(value).trim()
  }
  if (form) {
    for (const field of flattenFields(form)) {
      const label = str(field.label)
      if (labelPattern.test(label) && labelMail.test(label) && looksLikeEmail(answers[field.code])) {
        return str(answers[field.code]).trim()
      }
    }
  }
  const stored = str(workflowOf(application).teacher_email).trim()
  return stored || null
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

/**
 * Stamp the registered teacher signature as confirmed. Returns the signatures object to store on
 * workflow_json (unchanged when no teacher signature was registered — paper-only flows still work).
 */
export function confirmTeacherSignature(workflow: Row, staffId: string): Row {
  const signatures = obj(workflow.signatures)
  const teacher = obj(signatures.teacher)
  if (!Object.keys(teacher).length) return signatures
  return {
    ...signatures,
    teacher: { ...teacher, status: 'confirmed', confirmed_at: nowIso(), confirmed_by_staff: staffId },
  }
}
