export type FollowUpTaskType =
  | 'file_upload'
  | 'text'
  | 'file_and_text'
  | 'event_attendance'
  | 'confirmation'
  | 'other'

export type FollowUpTaskStatus =
  | 'pending'
  | 'submitted'
  | 'under_review'
  | 'supplement_required'
  | 'approved'
  | 'rejected'
  | 'waived'
  | 'overdue'

export type FollowUpReviewDecision = 'approved' | 'supplement_required' | 'rejected'

export interface FollowUpTask {
  id: string
  application: string
  student: string
  template: string | null
  name: string
  task_type: FollowUpTaskType | string
  description: string | null
  required: boolean
  requires_review: boolean
  due_at: string | null
  status: FollowUpTaskStatus | string
  completed_at: string | null
  created_by: string | null
  student_instructions: string | null
  event_start_at: string | null
  event_end_at: string | null
  event_location: string | null
  event_note: string | null
  allow_resubmit: boolean
  waive_reason?: string | null
  max_files: number | null
  max_file_size_mb: number | null
  allowed_extensions: string[] | null
  is_overdue: boolean
  created: string
  updated: string
}

export interface FollowUpSubmission {
  id: string
  task: string
  student: string
  submission_version: number
  text_content: string | null
  status: string
  submitted_at: string | null
  is_overdue_at_submit: boolean
  created: string
  updated: string
}

export interface FollowUpReview {
  id: string
  task: string
  submission: string
  reviewer: string
  decision: FollowUpReviewDecision | string
  internal_note?: string | null
  student_message: string | null
  allow_resubmit: boolean
  created: string
  updated: string
}

export interface FollowUpTaskTemplate {
  id: string
  name: string
  code: string
  description: string | null
  task_type: FollowUpTaskType | string
  allowed_extensions: string[] | null
  max_files: number | null
  max_file_size_mb: number | null
  requires_review: boolean
  required: boolean
  default_due_offset_days: number | null
  active: boolean
  student_instructions: string | null
  review_instructions: string | null
  created: string
  updated: string
}

export interface CategoryFollowUpTemplate {
  id: string
  category: string
  task_template: string
  required: boolean
  requires_review_override: boolean
  due_rule: Record<string, unknown> | null
  sort_order: number
  active: boolean
  created: string
  updated: string
}

export interface FollowUpTaskDetail {
  task: FollowUpTask
  submissions: FollowUpSubmission[]
  attachments: Array<{
    id: string
    original_filename: string
    mime_type: string
    extension: string
    size_bytes: number
    status: string
  }>
  reviews: FollowUpReview[]
}

export interface CreateFollowUpTaskPayload {
  application_id: string
  name: string
  task_type?: string
  description?: string
  required?: boolean
  requires_review?: boolean
  due_at?: string
  student_instructions?: string
  allowed_extensions?: string[]
  max_files?: number
  max_file_size_mb?: number
  template_id?: string
  event_start_at?: string
  event_end_at?: string
  event_location?: string
  event_note?: string
}

export interface ReviewFollowUpTaskPayload {
  decision: FollowUpReviewDecision
  internal_note?: string
  student_message?: string
  allow_resubmit?: boolean
}

export interface CreateTemplatePayload {
  name: string
  code: string
  description?: string
  task_type?: string
  allowed_extensions?: string[]
  max_files?: number
  max_file_size_mb?: number
  requires_review?: boolean
  required?: boolean
  default_due_offset_days?: number
  active?: boolean
  student_instructions?: string
  review_instructions?: string
}

export interface UpdateTemplatePayload {
  name?: string
  description?: string
  task_type?: string
  allowed_extensions?: string[]
  max_files?: number
  max_file_size_mb?: number
  requires_review?: boolean
  required?: boolean
  default_due_offset_days?: number
  active?: boolean
  student_instructions?: string
  review_instructions?: string
}

export interface CreateCategoryTemplatePayload {
  category_id: string
  task_template_id: string
  required?: boolean
  requires_review_override?: boolean
  due_rule?: Record<string, unknown>
  sort_order?: number
  active?: boolean
}
