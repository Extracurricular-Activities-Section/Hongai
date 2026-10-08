type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const nullable = (value: unknown): string | null => (value ? String(value) : null)
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

export function maskIdentity(last4: unknown): string {
  const tail = str(last4)
  return tail ? `******${tail}` : ''
}

/**
 * hk_applications row -> frontend Application.
 * The application row id doubles as the form submission id.
 * Pass the student record when it is not expanded on the row.
 */
export function applicationToPlain(record: Row, studentRecord?: Row): Row {
  const workflow = obj(record.workflow_json)
  const period = obj(record.period_json)
  const student = studentRecord ?? obj(obj(record.expand).student)
  const department = obj(record.current_department_json)
  return {
    id: str(record.id),
    created: str(record.created),
    updated: str(record.updated),
    student: str(record.student),
    period: str(record.period_key),
    category: str(record.category_code),
    submission: str(record.id),
    submission_version: str(workflow.submission_version),
    pdf_document: str(workflow.pdf_document),
    signed_document: nullable(workflow.signed_document),
    application_number: str(record.application_number),
    status: str(record.status),
    submitted_at: nullable(record.submitted_at),
    current_staff: nullable(record.current_staff),
    current_department: nullable(department.id ?? department.code),
    eligibility_status: str(record.eligibility_status) || 'pending',
    requested_amount: record.requested_amount ?? null,
    approved_amount: record.approved_amount ?? null,
    latest_reviewed_at: nullable(record.latest_reviewed_at),
    closed_at: nullable(record.closed_at),
    edit_override_until: nullable(record.edit_override_until),
    supplement_message: nullable(workflow.supplement_message),
    supplement_due_at: nullable(workflow.supplement_due_at),
    return_reason: nullable(workflow.return_reason),
    reject_reason: nullable(workflow.reject_reason),
    notification_pending: Boolean(workflow.notification_pending),
    category_code: str(record.category_code),
    category_name: str(record.category_name),
    period_name: str(period.name),
    student_no: str(student.student_no),
    student_name: str(student.name),
    identity_masked: maskIdentity(student.identity_last4),
    department_name: str(student.department_name),
  }
}
