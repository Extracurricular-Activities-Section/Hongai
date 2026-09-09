import type { BaseRecord, PeriodStudentProfile } from '@/types'
import type { PdfDocument, SignatureUploadMode } from '@/features/pdf/types'
import type {
  FundingDecision,
  FundingDecisionItem,
  FundingExtracted,
  FundingRuleWarning,
  AnnualFundingSummary,
} from '@/features/funding/types'

export type ApplicationStatus =
  | 'submitted'
  | 'eligibility_review'
  | 'under_review'
  | 'supplement_required'
  | 'returned_for_edit'
  | 'approved'
  | 'rejected'
  | 'funding_pending'
  | 'funding_decided'
  | 'closed'

export type EligibilityStatus =
  | 'pending'
  | 'qualified'
  | 'supplement_required'
  | 'disqualified'

export type ApplicationAction =
  | 'start_eligibility_review'
  | 'qualify_eligibility'
  | 'disqualify_eligibility'
  | 'request_supplement'
  | 'accept_supplement'
  | 'return_for_edit'
  | 'approve'
  | 'reject'
  | 'begin_funding'
  | 'decide_funding'
  | 'revise_funding'
  | 'close'
  | 'resubmit'

export type AssignmentType = 'primary' | 'collaborator' | 'viewer'

export type ReviewType = 'eligibility' | 'content' | 'final'
export type ReviewDecision =
  | 'qualified'
  | 'disqualified'
  | 'supplement_required'
  | 'returned_for_edit'
  | 'approved'
  | 'rejected'
  | 'note_only'

export type SupplementStatus = 'pending' | 'submitted' | 'accepted' | 'cancelled'

export type SignatureUploadModeProp = SignatureUploadMode

export interface Application extends BaseRecord {
  student: string
  period: string
  category: string
  submission: string
  submission_version: string
  pdf_document: string
  signed_document?: string | null
  application_number: string
  status: ApplicationStatus
  submitted_at: string | null
  current_staff: string | null
  current_department: string | null
  eligibility_status: EligibilityStatus
  requested_amount: number | null
  approved_amount: number | null
  latest_reviewed_at: string | null
  closed_at: string | null
  edit_override_until: string | null
  supplement_message: string | null
  supplement_due_at: string | null
  return_reason: string | null
  reject_reason: string | null
  notification_pending: boolean
  category_name?: string
  category_code?: string
  period_name?: string
  status_label?: string
  eligibility_label?: string
  student_no?: string
  student_name?: string
  identity_masked?: string
  identity_number?: string
  department_name?: string
}

export interface ApplicationReview {
  id: string
  application: string
  reviewer: string
  review_type: ReviewType
  decision: ReviewDecision
  comment: string | null
  student_message: string | null
  internal_note?: string | null
  created: string
}

export interface StudentFacingReview {
  decision: ReviewDecision | string
  student_message: string | null
  created: string
}

export interface ApplicationStatusHistoryItem {
  id: string
  from_status: ApplicationStatus | string | null
  to_status: ApplicationStatus | string
  changed_by_type: string
  reason: string | null
  created: string
  changed_by_student?: string | null
  changed_by_staff?: string | null
  metadata?: Record<string, unknown> | null
}

export interface SupplementRequest {
  id: string
  application: string
  requested_by: string
  message: string
  due_at: string | null
  status: SupplementStatus | string
  submitted_at: string | null
  resolved_at: string | null
  student_reply: string | null
  created: string
}

export interface ApplicationStaffAssignment {
  id: string
  application: string
  staff: string | null
  department: string | null
  assignment_type: AssignmentType | string
  active: boolean
  assigned_by: string | null
  created: string
}

export interface ApplicationSummaryCounts {
  total: number
  by_status: Partial<Record<ApplicationStatus, number>>
  by_eligibility: Partial<Record<EligibilityStatus, number>>
}

export interface ApplicationListParams {
  q?: string
  period?: string
  category?: string
  status?: string
  eligibility_status?: string
  department?: string
  page?: number
  perPage?: number
  sort?: string
}

export interface ApplicationListResponse {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  items: Application[]
}

export interface StudentApplicationDetail {
  application: Application
  reviews: StudentFacingReview[]
  funding: (FundingDecision & { items?: FundingDecisionItem[] }) | null
  pending_supplements: SupplementRequest[]
  status_history: ApplicationStatusHistoryItem[]
}

export interface AdminApplicationDetail {
  application: Application
  student: {
    id: string
    student_no: string
    profile: Record<string, unknown> | null
  }
  period_profile: PeriodStudentProfile | null
  submission_snapshot: Record<string, unknown> | null
  pdf: Pick<
    PdfDocument,
    | 'id'
    | 'document_number'
    | 'document_version'
    | 'status'
    | 'file_sha256'
    | 'generated_at'
    | 'submission'
    | 'submission_version'
  > | null
  reviews: ApplicationReview[]
  funding_history: Array<FundingDecision & { items?: FundingDecisionItem[] }>
  assignments: ApplicationStaffAssignment[]
  supplements: SupplementRequest[]
  status_history: ApplicationStatusHistoryItem[]
  annual_funding_summary: AnnualFundingSummary
}

export interface ApplicationActionPayload {
  action: ApplicationAction | string
  reason?: string
  student_message?: string
  internal_note?: string
  edit_override_until?: string
  due_at?: string
  comment?: string
}

export interface ApplicationAssignPayload {
  staff_id?: string
  department_id?: string
  assignment_type?: AssignmentType
}

export interface FundingCreatePayload {
  items: Array<{
    item_code: string
    approved_amount: number
    note?: string
  }>
  decision_note?: string
  internal_note?: string
  student_message?: string
  change_reason?: string
  notify_student?: boolean
}

export interface FundingPreviewResponse {
  extracted: FundingExtracted
  annual_funding_summary: AnnualFundingSummary
  warnings: FundingRuleWarning[]
}

export interface StaffUserAdmin extends BaseRecord {
  email: string
  name: string
  is_staff: boolean
  is_admin: boolean
  active: boolean
  phone?: string | null
  job_title?: string | null
  last_login_at?: string | null
  notes?: string | null
  departments?: Array<{
    id: string
    department: string
    is_primary: boolean
    active: boolean
  }>
}

export interface CategoryDepartmentAssignment extends BaseRecord {
  category: string
  department: string
  assignment_type: 'primary' | 'collaborator' | string
  active: boolean
}

export type { FundingDecision, FundingDecisionItem, FundingExtracted, FundingRuleWarning, AnnualFundingSummary }
