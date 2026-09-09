export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'date_range'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multiselect'
  | 'repeat_group'
  | 'monthly_plan'
  | 'computed'
  | 'display'
  | 'url'
  | 'email'
  | 'file'

export type FormVersionStatus = 'draft' | 'published' | 'retired'
export type FormSubmissionStatus = 'draft' | 'completed'
export type FormRuleType = 'show_if' | 'hide_if' | 'require_if'
export type FormRuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_true'
  | 'is_false'
  | 'is_empty'
  | 'is_not_empty'

export type SubmissionVersionReason =
  | 'autosave_snapshot'
  | 'manual_save'
  | 'completed'
  | 'copied'
  | 'other'

export type ComputedOperation = 'sum' | 'date_diff_days' | 'date_diff_months'

export interface ComputedFieldConfig {
  operation: ComputedOperation
  fields?: string[]
  start?: string
  end?: string
}

export interface RepeatGroupColumn {
  code: string
  label: string
  field_type: 'text' | 'number' | 'currency' | 'textarea'
  required?: boolean
}

export interface RepeatGroupConfig {
  max_rows?: number
  columns: RepeatGroupColumn[]
}

export interface MonthlyPlanConfig {
  months: number[]
}

export type MonthlyPlanValue = Record<string, string>

export type RepeatGroupValue = Array<Record<string, string | number | null>>

export type FormFieldValue =
  | string
  | number
  | boolean
  | string[]
  | MonthlyPlanValue
  | RepeatGroupValue
  | null
  | undefined

export type FormValues = Record<string, FormFieldValue>

export interface FormFieldOption {
  id: string
  value: string
  label: string
  sort_order: number
  active: boolean
}

export interface FormRule {
  id: string
  field_id: string
  field_code: string
  rule_type: FormRuleType
  source_field_code: string
  operator: FormRuleOperator
  value: unknown
  sort_order: number
}

export interface FormFieldSchema {
  id: string
  code: string
  label: string
  field_type: FieldType
  help_text?: string | null
  placeholder?: string | null
  required: boolean
  sort_order: number
  default_value?: unknown
  validation?: {
    warnings?: Array<{ type: string; value?: number; message: string }>
  } | null
  config?: ComputedFieldConfig | RepeatGroupConfig | MonthlyPlanConfig | Record<string, unknown> | null
  pdf_visible: boolean
  copy_previous: boolean
  active: boolean
  options: FormFieldOption[]
}

export interface FormSectionSchema {
  id: string
  code: string
  title: string
  description?: string | null
  sort_order: number
  visible: boolean
  pdf_visible: boolean
  fields: FormFieldSchema[]
}

export interface FormSchema {
  form: {
    id: string
    name: string
    description?: string | null
    category_id: string
    category_code: string
    category_name: string
  }
  version: {
    id: string
    version_number: number
    status: FormVersionStatus
  }
  sections: FormSectionSchema[]
  rules: FormRule[]
}

export interface FormSubmission {
  id: string
  student: string
  period: string
  category: string
  category_entry: string
  form: string
  form_version: string
  status: FormSubmissionStatus
  current_version_number: number
  copied_from_submission?: string | null
  last_saved_at?: string | null
  completed_at?: string | null
  created: string
  updated: string
}

export interface FormSubmissionVersion {
  id: string
  submission: string
  version_number: number
  snapshot: SubmissionSnapshot
  reason: SubmissionVersionReason
  created: string
}

export interface SubmissionSnapshot {
  formVersion: { id: string; version_number: number }
  answers: FormValues
  computed: FormValues
  studentProfileSnapshot: Record<string, unknown>
  periodProfileSnapshot: Record<string, unknown>
  category: { id: string; code: string; name: string }
  timestamps: {
    created_at?: string
    completed_at?: string | null
    saved_at?: string | null
  }
}

export interface FormIssue {
  code: string
  field_code?: string
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface EvaluatedFieldState {
  visible: boolean
  required: boolean
}
