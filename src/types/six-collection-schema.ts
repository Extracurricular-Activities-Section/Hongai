import type { BaseRecord, Gender } from './models'

export type HkApplicationStatus =
  | 'draft'
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

export type HkEligibilityStatus =
  | 'pending'
  | 'qualified'
  | 'supplement_required'
  | 'disqualified'

export type HkJsonObject = Record<string, unknown>

export type StaffRole = 'staff' | 'admin' | 'super_admin' | 'service'

export type SettingType =
  | 'period'
  | 'category'
  | 'policy'
  | 'notification_template'
  | 'system'
  | 'faq'
  | 'counselor'

export type EventType =
  | 'notification'
  | 'email_log'
  | 'audit'
  | 'system'
  | 'auth'
  | 'application'
  | 'scheduler'

export interface HkStudentRecord extends BaseRecord {
  email?: string
  student_no: string
  identity_last4: string
  identity_hash?: string | null
  identity_encrypted?: string | null
  name: string
  gender?: Gender | null
  department_name?: string | null
  program_type?: string | null
  division?: string | null
  grade?: string | null
  phone?: string | null
  line_id?: string | null
  bank_account_registered: boolean
  bank_account_note?: string | null
  profile_json?: Record<string, unknown> | null
  notification_preferences_json?: Record<string, unknown> | null
  active: boolean
  locked_until?: string | null
  failed_login_count: number
  last_login_at?: string | null
  registered_at?: string | null
  updated_by_student_at?: string | null
}

export interface HkStaffUserRecord extends BaseRecord {
  email: string
  name: string
  role: StaffRole
  is_staff?: boolean
  is_admin?: boolean
  department_code?: string | null
  department_name?: string | null
  department_contact_json?: Record<string, unknown> | null
  departments_json?: Array<Record<string, unknown>> | null
  permissions_json?: Record<string, unknown> | null
  can_manage_forms?: boolean
  can_publish_forms?: boolean
  active: boolean
  phone?: string | null
  job_title?: string | null
  last_login_at?: string | null
  notes?: string | null
}

export interface HkFormRecord extends BaseRecord {
  form_code: string
  name: string
  description?: string | null
  category_code?: string | null
  category_name?: string | null
  category_json?: Record<string, unknown> | null
  version: number
  status: 'draft' | 'published' | 'retired'
  schema_json: HkJsonObject
  schema_hash?: string | null
  active: boolean
  published_at?: string | null
  published_by?: string | null
  notes?: string | null
}

export interface HkApplicationRecord extends BaseRecord {
  student: string
  form: string
  application_number: string
  period_key?: string | null
  period_json?: Record<string, unknown> | null
  category_code?: string | null
  category_name?: string | null
  status: HkApplicationStatus
  eligibility_status?: HkEligibilityStatus | null
  answers_json?: HkJsonObject | null
  submission_snapshot_json?: HkJsonObject | null
  workflow_json?: HkJsonObject | null
  tasks_json?: HkJsonObject[] | null
  funding_json?: HkJsonObject | null
  payments_json?: HkJsonObject[] | null
  files_json?: HkJsonObject[] | null
  files?: string[]
  current_staff?: string | null
  current_department_json?: HkJsonObject | null
  requested_amount?: number | null
  approved_amount?: number | null
  submitted_at?: string | null
  latest_reviewed_at?: string | null
  closed_at?: string | null
  edit_override_until?: string | null
}

export interface HkSettingRecord extends BaseRecord {
  key: string
  setting_type: SettingType
  value_json: HkJsonObject | HkJsonObject[]
  version?: number | null
  status?: 'draft' | 'active' | 'archived' | null
  active: boolean
  updated_by?: string | null
  notes?: string | null
}

export interface HkEventRecord extends BaseRecord {
  event_type: EventType
  event_key?: string | null
  actor_student?: string | null
  actor_staff?: string | null
  target_type?: string | null
  target_id?: string | null
  recipient_json?: Record<string, unknown> | null
  payload_json?: Record<string, unknown> | null
  status?: string | null
  occurred_at?: string | null
  ip?: string | null
  user_agent?: string | null
}
