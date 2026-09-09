export interface BaseRecord {
  id: string
  created: string
  updated: string
}

export type Gender = 'male' | 'female' | 'other'

export type ApplicationPeriodStatus =
  | 'draft'
  | 'scheduled'
  | 'open'
  | 'closed'
  | 'archived'

export type Semester = '1' | '2'

export type MinApplicationRule = 'warning_only' | 'enforced'

export type IdentityResetStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'closed'

export type AuditActorType = 'student' | 'staff' | 'admin' | 'system'

export interface StaffUser extends BaseRecord {
  email: string
  name: string
  is_staff: boolean
  is_admin: boolean
  active: boolean
  phone?: string
  job_title?: string
  last_login_at?: string
  notes?: string
}

export interface Department extends BaseRecord {
  name: string
  code: string
  active: boolean
  description?: string
  sort_order: number
}

export interface StaffDepartment extends BaseRecord {
  staff: string
  department: string
  is_primary: boolean
  active: boolean
}

/**
 * hk_students Auth record.
 * Full identity_number is stored on StudentProfile, not here.
 */
export interface Student extends BaseRecord {
  email?: string
  student_no: string
  identity_last4: string
  active: boolean
  locked_until?: string
  failed_login_count: number
  last_login_at?: string
  registered_at?: string
}

export interface StudentProfile extends BaseRecord {
  student: string
  name: string
  identity_number: string
  gender?: Gender
  department_name: string
  program_type?: string
  division?: string
  grade: string
  phone: string
  line_id?: string
  email: string
  bank_account_registered: boolean
  bank_account_note?: string
  updated_by_student_at?: string
}

export interface StudentMeResponse {
  student: Pick<Student, 'id' | 'student_no' | 'active' | 'last_login_at'>
  profile: StudentProfile
}

export interface ApplicationPeriod extends BaseRecord {
  name: string
  academic_year: number
  semester: Semester
  start_at: string
  end_at: string
  status: ApplicationPeriodStatus
  active: boolean
  sort_order: number
  description?: string
  min_application_count: number
  min_application_rule: MinApplicationRule
}

export interface IdentityResetRequest extends BaseRecord {
  student_no: string
  name: string
  email: string
  phone: string
  reason: string
  status: IdentityResetStatus
  resolved_by?: string
  resolved_at?: string
  resolution_note?: string
  created_student?: string
}

export interface AuditLog extends BaseRecord {
  actor_type: AuditActorType
  actor_student?: string
  actor_staff?: string
  action: string
  target_type?: string
  target_id?: string
  ip?: string
  user_agent?: string
  metadata?: Record<string, unknown>
}

export interface StudentAuthState {
  isAuthenticated: boolean
  studentId: string | null
  studentNo: string | null
}

export interface BackofficeAuthState {
  isAuthenticated: boolean
  staffId: string | null
  email: string | null
  name: string | null
  isStaff: boolean
  isAdmin: boolean
  active: boolean
}

export type CategoryEntryStatus = 'not_started' | 'draft'

export type CurrentPeriodUiState = 'none' | 'open' | 'scheduled' | 'closed'

export interface PeriodStudentProfile extends BaseRecord {
  student: string
  period: string
  grade?: string | null
  application_identity_types: string[]
  disability_level?: string | null
  weak_aid_level?: string | null
  has_applied_before: boolean
  bank_account_registered: boolean
  bank_account_note?: string | null
  qualification_note?: string | null
  confirmed_at?: string | null
  source_period?: string | null
  copied_from_previous: boolean
}

export interface ApplicationCategory extends BaseRecord {
  code: string
  name: string
  description?: string | null
  active: boolean
  sort_order: number
  allow_copy_previous: boolean
}

export interface StudentCategoryEntry extends BaseRecord {
  student: string
  period: string
  category: string
  status: CategoryEntryStatus
  last_opened_at?: string | null
  copied_from_entry?: string | null
}

export interface CurrentPeriodState {
  server_now: string
  ui_state: CurrentPeriodUiState
  latest_period: ApplicationPeriod | null
  current_open_period: ApplicationPeriod | null
  period_profile: PeriodStudentProfile | null
  previous_period: ApplicationPeriod | null
  has_history: boolean
  history_count: number
}

export interface HistoryPeriodSummary {
  period: ApplicationPeriod
  profile: PeriodStudentProfile
  entry_count: number
  category_names: string[]
  is_current_editable: boolean
}

export interface PreviousPeriodSource {
  previous_period: ApplicationPeriod | null
  previous_profile: PeriodStudentProfile | null
}
