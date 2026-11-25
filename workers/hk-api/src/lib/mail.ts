/**
 * Notification + email-job helpers shared by outreach and approval notices.
 *
 * Mail architecture today: the Worker has NO mail sender (see docs/EMAIL-ARCHITECTURE.md —
 * production provider NOT CONFIGURED). So every email job is recorded as an `email_log`
 * hk_event with status "skipped" and error_code "mail_provider_disabled"; in-app
 * notifications are always created. When a provider is wired, flip `mailProviderConfigured`
 * and jobs are written as "queued" for the sender to pick up.
 *
 * Attachments are never embedded in email: approval notices carry authenticated
 * download references (and a login-gated page link) instead.
 */

import type PocketBase from 'pocketbase'

import { nowIso, studentActionUrl, workflowOf } from './application-workflow'
import { attachmentsOf } from './attachments'
import type { WorkerEnv } from './http'
import { TEMPLATE_SEED, templateFromSetting, templateSettingKey } from './notification-templates'
import { pdfDocumentsOf } from './pdf'

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))

/** No mail sender is wired in the Worker yet. */
export function mailProviderConfigured(_env: WorkerEnv): boolean {
  return false
}

export const MAIL_DISABLED_CODE = 'mail_provider_disabled'
export const MAIL_DISABLED_MESSAGE = '郵件提供者尚未設定，僅建立站內通知，未實際寄出 Email。'

/** Active template from hk_settings, falling back to the built-in seed. */
export async function loadTemplate(
  pb: PocketBase,
  code: string,
): Promise<{ subject_template: string; body_template: string }> {
  try {
    const record = (await pb.collection('hk_settings').getFirstListItem(
      pb.filter('setting_type = "notification_template" && key = {:key} && active = true', {
        key: templateSettingKey(code),
      }),
    )) as Row
    const template = templateFromSetting(record)
    if (template.body_template) {
      return { subject_template: template.subject_template || '', body_template: template.body_template }
    }
  } catch {
    // fall through to the seed
  }
  const seed = TEMPLATE_SEED.find((item) => item.code === code)
  return { subject_template: seed?.subject_template || '', body_template: seed?.body_template || '' }
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type AttachmentRef = {
  kind: 'generated_pdf' | 'signed_document'
  id: string
  name: string
  /** Worker path (needs the signed-in user's token); never a public URL. */
  download_path: string
}

export async function createNotificationEvent(
  pb: PocketBase,
  input: {
    studentId: string
    notificationType: string
    uiCategory: 'application' | 'supplement' | 'funding' | 'follow_up' | 'system'
    title: string
    message: string
    actionUrl: string
    targetType: string
    targetId: string
    applicationId?: string
    attachments?: AttachmentRef[]
    extra?: Row
  },
): Promise<string> {
  const record = (await pb.collection('hk_events').create({
    event_type: 'notification',
    event_key: input.notificationType,
    target_type: input.targetType,
    target_id: input.targetId,
    recipient_json: { student: input.studentId },
    payload_json: {
      notification_type: input.notificationType,
      ui_category: input.uiCategory,
      title: input.title,
      message: input.message,
      application: input.applicationId ?? null,
      action_url: input.actionUrl,
      attachments: input.attachments ?? [],
      read_at: null,
      ...input.extra,
    },
    status: 'unread',
    occurred_at: nowIso(),
  })) as Row
  return str(record.id)
}

export type EmailJobStatus = 'queued' | 'skipped'

export async function createEmailJob(
  pb: PocketBase,
  env: WorkerEnv,
  input: {
    studentId?: string
    recipient: string
    subject: string
    body: string
    template: string
    notificationId?: string
    applicationId?: string
    targetType: string
    targetId: string
    attachments?: AttachmentRef[]
    downloadUrl?: string
    extra?: Row
  },
): Promise<{ id: string; status: EmailJobStatus }> {
  const configured = mailProviderConfigured(env)
  const status: EmailJobStatus = configured ? 'queued' : 'skipped'
  const record = (await pb.collection('hk_events').create({
    event_type: 'email_log',
    event_key: input.template,
    target_type: input.targetType,
    target_id: input.targetId,
    recipient_json: { email: input.recipient, student: input.studentId ?? null },
    payload_json: {
      channel: 'email',
      template: input.template,
      notification: input.notificationId ?? null,
      application: input.applicationId ?? null,
      recipient: input.recipient,
      subject: input.subject,
      rendered_body: input.body,
      provider: configured ? 'configured' : 'none',
      attempt_count: 0,
      error_code: configured ? null : MAIL_DISABLED_CODE,
      error_message: configured ? null : MAIL_DISABLED_MESSAGE,
      // Email never embeds the file: recipients sign in and download from the system.
      attachment_mode: input.attachments?.length ? 'login_link' : 'none',
      attachments: input.attachments ?? [],
      download_url: input.downloadUrl ?? null,
      ...input.extra,
    },
    status,
    occurred_at: nowIso(),
  })) as Row
  return { id: str(record.id), status }
}

// ---------------------------------------------------------------------------
// Attachments for approval notices
// ---------------------------------------------------------------------------

/** Latest valid generated PDF + the active signed document (if any) of an application. */
export function attachmentRefsOf(application: Row): AttachmentRef[] {
  const refs: AttachmentRef[] = []

  const pdf = pdfDocumentsOf(application)
    .filter((doc) => str(doc.status) === 'valid')
    .sort((a, b) => (Number(b.document_version) || 0) - (Number(a.document_version) || 0))[0]
  if (pdf) {
    refs.push({
      kind: 'generated_pdf',
      id: str(pdf.id),
      name: `${str(pdf.document_number)}-V${Number(pdf.document_version) || 1}.pdf`,
      download_path: `/api/hk/pdf/${str(pdf.id)}/download`,
    })
  }

  const signedId = str(workflowOf(application).signed_document)
  if (signedId) {
    const entry = attachmentsOf(application).find(
      (item) => str(item.id) === signedId && str(item.status) === 'active',
    )
    if (entry) {
      refs.push({
        kind: 'signed_document',
        id: signedId,
        name: str(entry.original_filename) || '已簽文件',
        download_path: `/api/hk/attachments/${signedId}/download`,
      })
    }
  }
  return refs
}

export function attachmentLabel(ref: AttachmentRef): string {
  return `${ref.kind === 'generated_pdf' ? '申請書 PDF' : '已簽文件'}：${ref.name}`
}

/** Login-gated page where the student can download the files. */
export function downloadPageUrl(env: WorkerEnv, application: Row): string {
  const base = (env.HK_STUDENT_APP_URL || '').replace(/\/$/, '')
  return `${base}${studentActionUrl(application)}`
}
