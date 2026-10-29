/**
 * In-app / email notification templates stored in hk_settings
 * (setting_type = notification_template, key = notification_template:{code}).
 */

export type TemplateDef = {
  code: string
  name: string
  channel: 'both' | 'in_app' | 'email'
  category: string
  is_critical: boolean
  subject_template: string
  body_template: string
}

/** Default templates (idempotent seed). Product name: 弘愛築夢. */
export const TEMPLATE_SEED: TemplateDef[] = [
  {
    code: 'application_submitted',
    name: '申請案件已送出',
    channel: 'both',
    category: 'application',
    is_critical: false,
    subject_template: '【弘愛築夢】您的申請已成功送出（{{application_number}}）',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）已成功送出，本單位將依作業流程進行審核。\n\n如需查詢進度，請登入系統查看。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'supplement_requested',
    name: '請補件',
    channel: 'both',
    category: 'supplement',
    is_critical: true,
    subject_template: '【弘愛築夢｜請儘速補件】案件 {{application_number}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）需補件。\n\n補件說明：\n{{student_message}}\n\n補件期限：{{due_at}}\n\n請於期限內登入系統完成補件。逾期未補件可能影響案件進度。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'application_returned',
    name: '申請退回修正',
    channel: 'both',
    category: 'application',
    is_critical: true,
    subject_template: '【弘愛築夢｜請修正後再送】案件 {{application_number}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）已退回，請依說明修正後重新送件。\n\n退回說明：\n{{student_message}}\n\n請登入系統查看並完成修正。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'application_rejected',
    name: '申請未通過',
    channel: 'both',
    category: 'application',
    is_critical: true,
    subject_template: '【弘愛築夢】申請結果通知（{{application_number}}）',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）經審核後未能通過。\n\n說明：\n{{student_message}}\n\n如有疑問，請洽承辦單位。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'application_approved',
    name: '申請通過',
    channel: 'both',
    category: 'application',
    is_critical: false,
    subject_template: '【弘愛築夢】申請通過通知（{{application_number}}）',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）已審核通過。\n\n{{student_message}}\n\n後續補助核定與追蹤事項請登入系統查看。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'funding_decided',
    name: '補助核定通知',
    channel: 'both',
    category: 'funding',
    is_critical: true,
    subject_template: '【弘愛築夢｜補助核定】案件 {{application_number}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）補助已核定。\n\n核定總額：{{approved_amount}} 元\n\n{{student_message}}\n\n請登入系統查看明細，並留意後續追蹤任務。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'funding_revised',
    name: '補助核定修正通知',
    channel: 'both',
    category: 'funding',
    is_critical: true,
    subject_template: '【弘愛築夢｜補助核定已修正】案件 {{application_number}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）補助核定內容已修正。\n\n修正後核定總額：{{approved_amount}} 元\n\n{{student_message}}\n\n請登入系統確認最新核定內容。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'signed_document_rejected',
    name: '已簽文件未通過',
    channel: 'both',
    category: 'application',
    is_critical: false,
    subject_template: '【弘愛築夢】已簽文件需重新上傳（{{application_number}}）',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您案件（編號：{{application_number}}）之已簽文件經檢核未能通過。\n\n說明：\n{{student_message}}\n\n請依說明重新上傳正確文件。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'follow_up_created',
    name: '追蹤任務已建立',
    channel: 'both',
    category: 'follow_up',
    is_critical: false,
    subject_template: '【弘愛築夢】新增追蹤任務：{{task_name}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您的案件（編號：{{application_number}}）已新增追蹤任務「{{task_name}}」。\n\n任務說明：\n{{task_description}}\n\n截止日期：{{due_at}}\n\n請登入系統依指示完成繳交。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'follow_up_due_reminder',
    name: '追蹤任務截止提醒',
    channel: 'both',
    category: 'follow_up',
    is_critical: false,
    subject_template: '【弘愛築夢｜提醒】追蹤任務即將到期：{{task_name}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n提醒您：案件（編號：{{application_number}}）之追蹤任務「{{task_name}}」即將到期。\n\n截止日期：{{due_at}}\n\n請儘速登入系統完成繳交，以免影響後續作業。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'follow_up_overdue',
    name: '追蹤任務已逾期',
    channel: 'both',
    category: 'follow_up',
    is_critical: true,
    subject_template: '【弘愛築夢｜逾期】追蹤任務已逾期：{{task_name}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您的案件（編號：{{application_number}}）追蹤任務「{{task_name}}」已超過截止日期。\n\n原訂截止日期：{{due_at}}\n\n請儘速登入系統補齊相關資料。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'follow_up_supplement',
    name: '追蹤任務請補件',
    channel: 'both',
    category: 'follow_up',
    is_critical: true,
    subject_template: '【弘愛築夢｜追蹤補件】{{task_name}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您的追蹤任務「{{task_name}}」（案件編號：{{application_number}}）需補件。\n\n補件說明：\n{{student_message}}\n\n請登入系統重新繳交。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'follow_up_approved',
    name: '追蹤任務已核准',
    channel: 'both',
    category: 'follow_up',
    is_critical: false,
    subject_template: '【弘愛築夢】追蹤任務已核准：{{task_name}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您的追蹤任務「{{task_name}}」（案件編號：{{application_number}}）已審核通過。\n\n{{student_message}}\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'event_upcoming',
    name: '活動即將開始提醒',
    channel: 'both',
    category: 'event',
    is_critical: false,
    subject_template: '【弘愛築夢｜活動提醒】{{event_name}}',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n提醒您：活動「{{event_name}}」即將開始。\n\n時間：{{event_start_at}}\n地點：{{event_location}}\n\n{{event_note}}\n\n請準時參加。\n\n此為系統自動通知，敬請知悉。',
  },
  {
    code: 'identity_reset_processed',
    name: '身分重置申請處理結果',
    channel: 'both',
    category: 'system',
    is_critical: true,
    subject_template: '【弘愛築夢】身分證件號碼重置申請處理結果',
    body_template:
      '親愛的 {{student_name}} 同學，您好：\n\n您提出之身分證件號碼重置申請已處理完成。\n\n處理結果：{{reset_status_label}}\n\n{{student_message}}\n\n如需登入協助，請洽承辦單位。\n\n此為系統自動通知，敬請知悉。',
  },
]

export function templateSettingKey(code: string): string {
  return `notification_template:${code}`
}

export function templateFromSetting(record: Record<string, unknown>) {
  const value =
    record.value_json && typeof record.value_json === 'object' && !Array.isArray(record.value_json)
      ? (record.value_json as Record<string, unknown>)
      : {}
  return {
    id: String(record.id || ''),
    code: String(value.code || ''),
    name: String(value.name || ''),
    channel: String(value.channel || 'both'),
    subject_template: value.subject_template == null ? null : String(value.subject_template),
    body_template: String(value.body_template || ''),
    active: Boolean(record.active),
    category: String(value.category || 'system'),
    version: Number(value.version) || Number(record.version) || 1,
    is_critical: Boolean(value.is_critical),
    created: String(record.created || ''),
    updated: String(record.updated || ''),
  }
}

/** Safe {{var}} render — no eval. Missing vars → empty string. */
export function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
): { ok: boolean; text: string; missing: string[] } {
  const text = template == null ? '' : String(template)
  const missing: string[] = []
  const seen = new Set<string>()
  const rendered = text
    .replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => {
      const raw = vars[key]
      if (raw == null || raw === '') {
        if (!seen.has(key)) {
          seen.add(key)
          missing.push(key)
        }
        return ''
      }
      const value = String(raw)
      if (value === 'undefined' || value === 'null') {
        if (!seen.has(key)) {
          seen.add(key)
          missing.push(key)
        }
        return ''
      }
      return value
    })
    .replace(/\bundefined\b/g, '')
  return { ok: missing.length === 0, text: rendered, missing }
}
