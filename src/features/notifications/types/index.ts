export type NotificationUiCategory =
  | 'application'
  | 'supplement'
  | 'funding'
  | 'follow_up'
  | 'event'
  | 'system'
  | string

export type NotificationDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'sent_simulated'
  | 'failed'
  | 'cancelled'
  | string

export type NotificationChannel = 'email' | 'in_app' | 'both' | string

export interface HadNotification {
  id: string
  recipient_student: string | null
  recipient_staff: string | null
  notification_type: string
  title: string
  message: string
  application: string | null
  follow_up_task: string | null
  supplement_request: string | null
  action_url: string | null
  read_at: string | null
  status: string
  ui_category: NotificationUiCategory | null
  created: string
  updated: string
}

export interface NotificationDelivery {
  id: string
  notification: string | null
  template: string | null
  channel: string
  recipient: string
  subject: string
  provider: string | null
  provider_message_id: string | null
  status: NotificationDeliveryStatus
  attempt_count: number
  last_attempt_at: string | null
  sent_at: string | null
  next_retry_at: string | null
  error_code: string | null
  error_message: string | null
  application: string | null
  recipient_student: string | null
  rendered_body?: string | null
  created: string
  updated: string
}

export interface NotificationTemplate {
  id: string
  code: string
  name: string
  channel: NotificationChannel
  subject_template: string | null
  body_template: string
  active: boolean
  category: string
  version: number
  is_critical: boolean
  created: string
  updated: string
}

export interface NotificationPreferences {
  id: string
  student: string
  email_enabled: boolean
  in_app_enabled: boolean
  event_reminders: boolean
  follow_up_reminders: boolean
  system_critical_email: boolean
  created: string
  updated: string
}

export interface UpdateNotificationPreferencesPayload {
  email_enabled?: boolean
  in_app_enabled?: boolean
  event_reminders?: boolean
  follow_up_reminders?: boolean
}

export interface MailProviderStatus {
  configured: boolean
  provider: string
  from: string
  from_name: string
  app_base_url: string
  support_email: string
  support_phone: string
  smtp_host_set: boolean
  notes: string
}

export interface NotificationDashboardSummary {
  notifications_active: number
  notifications_unread: number
  deliveries_queued: number
  deliveries_failed: number
  deliveries_sent: number
  reminders_pending: number
}

export interface NotificationTemplateUpsertPayload {
  code: string
  name?: string
  channel?: string
  subject_template?: string
  body_template?: string
  category?: string
  active?: boolean
  is_critical?: boolean
}

export interface NotificationTemplatePreviewPayload {
  template_id?: string
  subject_template?: string
  body_template?: string
  variables?: Record<string, string>
}

export interface NotificationTemplatePreviewResult {
  subject: { text: string; missing?: string[] }
  body: { text: string; missing?: string[] }
  html: string
  sample_student_no: string
}

export interface ListStudentNotificationsParams {
  filter?: 'all' | 'unread'
  category?: string
}

export interface ListAdminNotificationsParams {
  student_id?: string
  application_id?: string
  category?: string
}

export interface ListAdminDeliveriesParams {
  status?: string
  application_id?: string
}
