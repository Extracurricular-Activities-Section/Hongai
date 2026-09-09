/**
 * Idempotent seed for notification templates + default reminder rules.
 * Loaded from migration via require(__hooks + '/had_notification_templates_seed.js')
 */

function templateDefs() {
  return [
    {
      code: 'application_submitted',
      name: '申請案件已送出',
      channel: 'both',
      category: 'application',
      is_critical: false,
      subject_template: '【宏愛圓夢】您的申請已成功送出（{{application_number}}）',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）已成功送出，本單位將依作業流程進行審核。\n\n如需查詢進度，請登入系統查看。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'supplement_requested',
      name: '請補件',
      channel: 'both',
      category: 'supplement',
      is_critical: true,
      subject_template: '【宏愛圓夢｜請儘速補件】案件 {{application_number}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）需補件。\n\n補件說明：\n{{student_message}}\n\n補件期限：{{due_at}}\n\n請於期限內登入系統完成補件。逾期未補件可能影響案件進度。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'application_returned',
      name: '申請退回修正',
      channel: 'both',
      category: 'application',
      is_critical: true,
      subject_template: '【宏愛圓夢｜請修正後再送】案件 {{application_number}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）已退回，請依說明修正後重新送件。\n\n退回說明：\n{{student_message}}\n\n請登入系統查看並完成修正。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'application_rejected',
      name: '申請未通過',
      channel: 'both',
      category: 'application',
      is_critical: true,
      subject_template: '【宏愛圓夢】申請結果通知（{{application_number}}）',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）經審核後未能通過。\n\n說明：\n{{student_message}}\n\n如有疑問，請洽承辦單位。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'application_approved',
      name: '申請通過',
      channel: 'both',
      category: 'application',
      is_critical: false,
      subject_template: '【宏愛圓夢】申請通過通知（{{application_number}}）',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）已審核通過。\n\n{{student_message}}\n\n後續補助核定與追蹤事項請登入系統查看。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'funding_decided',
      name: '補助核定通知',
      channel: 'both',
      category: 'funding',
      is_critical: true,
      subject_template: '【宏愛圓夢｜補助核定】案件 {{application_number}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）補助已核定。\n\n核定總額：{{approved_amount}} 元\n\n{{student_message}}\n\n請登入系統查看明細，並留意後續追蹤任務。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'funding_revised',
      name: '補助核定修正通知',
      channel: 'both',
      category: 'funding',
      is_critical: true,
      subject_template: '【宏愛圓夢｜補助核定已修正】案件 {{application_number}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您申請之「{{category_name}}」案件（編號：{{application_number}}）補助核定內容已修正。\n\n修正後核定總額：{{approved_amount}} 元\n\n{{student_message}}\n\n請登入系統確認最新核定內容。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'signed_document_rejected',
      name: '已簽文件未通過',
      channel: 'both',
      category: 'application',
      is_critical: false,
      subject_template: '【宏愛圓夢】已簽文件需重新上傳（{{application_number}}）',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您案件（編號：{{application_number}}）之已簽文件經檢核未能通過。\n\n說明：\n{{student_message}}\n\n請依說明重新上傳正確文件。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'follow_up_created',
      name: '追蹤任務已建立',
      channel: 'both',
      category: 'follow_up',
      is_critical: false,
      subject_template: '【宏愛圓夢】新增追蹤任務：{{task_name}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您的案件（編號：{{application_number}}）已新增追蹤任務「{{task_name}}」。\n\n任務說明：\n{{task_description}}\n\n截止日期：{{due_at}}\n\n請登入系統依指示完成繳交。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'follow_up_due_reminder',
      name: '追蹤任務截止提醒',
      channel: 'both',
      category: 'follow_up',
      is_critical: false,
      subject_template: '【宏愛圓夢｜提醒】追蹤任務即將到期：{{task_name}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n提醒您：案件（編號：{{application_number}}）之追蹤任務「{{task_name}}」即將到期。\n\n截止日期：{{due_at}}\n\n請儘速登入系統完成繳交，以免影響後續作業。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'follow_up_overdue',
      name: '追蹤任務已逾期',
      channel: 'both',
      category: 'follow_up',
      is_critical: true,
      subject_template: '【宏愛圓夢｜逾期】追蹤任務已逾期：{{task_name}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您的案件（編號：{{application_number}}）追蹤任務「{{task_name}}」已超過截止日期。\n\n原訂截止日期：{{due_at}}\n\n請儘速登入系統補齊相關資料。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'follow_up_supplement',
      name: '追蹤任務請補件',
      channel: 'both',
      category: 'follow_up',
      is_critical: true,
      subject_template: '【宏愛圓夢｜追蹤補件】{{task_name}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您的追蹤任務「{{task_name}}」（案件編號：{{application_number}}）需補件。\n\n補件說明：\n{{student_message}}\n\n請登入系統重新繳交。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'follow_up_approved',
      name: '追蹤任務已核准',
      channel: 'both',
      category: 'follow_up',
      is_critical: false,
      subject_template: '【宏愛圓夢】追蹤任務已核准：{{task_name}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您的追蹤任務「{{task_name}}」（案件編號：{{application_number}}）已審核通過。\n\n{{student_message}}\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'event_upcoming',
      name: '活動即將開始提醒',
      channel: 'both',
      category: 'event',
      is_critical: false,
      subject_template: '【宏愛圓夢｜活動提醒】{{event_name}}',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n提醒您：活動「{{event_name}}」即將開始。\n\n時間：{{event_start_at}}\n地點：{{event_location}}\n\n{{event_note}}\n\n請準時參加。\n\n此為系統自動通知，敬請知悉。',
    },
    {
      code: 'identity_reset_processed',
      name: '身分重置申請處理結果',
      channel: 'both',
      category: 'system',
      is_critical: true,
      subject_template: '【宏愛圓夢】身分證件號碼重置申請處理結果',
      body_template:
        '親愛的 {{student_name}} 同學，您好：\n\n您提出之身分證件號碼重置申請已處理完成。\n\n處理結果：{{reset_status_label}}\n\n{{student_message}}\n\n如需登入協助，請洽承辦單位。請勿透過不安全管道提供個人證件資訊。\n\n此為系統自動通知，敬請知悉。',
    },
  ]
}

function reminderRuleDefs() {
  return [
    { name: '追蹤截止前 14 天', target_type: 'follow_up_due', offset_minutes: -20160, template_code: 'follow_up_due_reminder', channel: 'both' },
    { name: '追蹤截止前 7 天', target_type: 'follow_up_due', offset_minutes: -10080, template_code: 'follow_up_due_reminder', channel: 'both' },
    { name: '追蹤截止前 1 天', target_type: 'follow_up_due', offset_minutes: -1440, template_code: 'follow_up_due_reminder', channel: 'both' },
    { name: '追蹤截止當日', target_type: 'follow_up_due', offset_minutes: 0, template_code: 'follow_up_due_reminder', channel: 'both' },
    { name: '追蹤逾期後 7 天', target_type: 'follow_up_due', offset_minutes: 10080, template_code: 'follow_up_overdue', channel: 'both' },
    { name: '活動前 7 天', target_type: 'event_start', offset_minutes: -10080, template_code: 'event_upcoming', channel: 'both' },
    { name: '活動前 1 天', target_type: 'event_start', offset_minutes: -1440, template_code: 'event_upcoming', channel: 'both' },
    { name: '活動當日', target_type: 'event_start', offset_minutes: 0, template_code: 'event_upcoming', channel: 'both' },
    { name: '補件截止前 7 天', target_type: 'supplement_due', offset_minutes: -10080, template_code: 'supplement_requested', channel: 'both' },
    { name: '補件截止前 1 天', target_type: 'supplement_due', offset_minutes: -1440, template_code: 'supplement_requested', channel: 'both' },
  ]
}

function ensureTemplate(app, def) {
  var existing = null
  try {
    existing = app.findFirstRecordByData('had_notification_templates', 'code', def.code)
  } catch (_) {
    existing = null
  }
  if (existing) {
    // Keep admin edits; only backfill empty critical fields if needed
    var changed = false
    if (!existing.getString('name')) {
      existing.set('name', def.name)
      changed = true
    }
    if (existing.get('active') == null) {
      existing.set('active', true)
      changed = true
    }
    if (changed) app.save(existing)
    return existing
  }

  var col = app.findCollectionByNameOrId('had_notification_templates')
  var record = new Record(col)
  record.set('code', def.code)
  record.set('name', def.name)
  record.set('channel', def.channel)
  record.set('subject_template', def.subject_template)
  record.set('body_template', def.body_template)
  record.set('active', true)
  record.set('category', def.category)
  record.set('version', 1)
  record.set('is_critical', !!def.is_critical)
  app.save(record)
  return record
}

function findExistingRule(app, targetType, offsetMinutes, templateId) {
  try {
    var rows = app.findRecordsByFilter(
      'had_reminder_rules',
      'target_type = {:tt} && offset_minutes = {:off} && template = {:tid}',
      '',
      1,
      0,
      { tt: targetType, off: offsetMinutes, tid: templateId },
    )
    return rows.length ? rows[0] : null
  } catch (_) {
    return null
  }
}

function ensureReminderRules(app) {
  var defs = reminderRuleDefs()
  var created = 0
  for (var i = 0; i < defs.length; i++) {
    var def = defs[i]
    var template = null
    try {
      template = app.findFirstRecordByData('had_notification_templates', 'code', def.template_code)
    } catch (_) {
      template = null
    }
    if (!template) {
      console.log('[hong-ai-dream] skip reminder rule, missing template: ' + def.template_code)
      continue
    }
    var existing = findExistingRule(app, def.target_type, def.offset_minutes, template.id)
    if (existing) continue

    var col = app.findCollectionByNameOrId('had_reminder_rules')
    var record = new Record(col)
    record.set('name', def.name)
    record.set('target_type', def.target_type)
    record.set('offset_minutes', def.offset_minutes)
    record.set('channel', def.channel || 'both')
    record.set('template', template.id)
    record.set('active', true)
    app.save(record)
    created++
  }
  return created
}

function ensureNotificationSeeds(app) {
  var templates = templateDefs()
  var tCreated = 0
  for (var i = 0; i < templates.length; i++) {
    var before = null
    try {
      before = app.findFirstRecordByData('had_notification_templates', 'code', templates[i].code)
    } catch (_) {}
    ensureTemplate(app, templates[i])
    if (!before) tCreated++
  }
  var rulesCreated = 0
  try {
    rulesCreated = ensureReminderRules(app)
  } catch (err) {
    console.log('[hong-ai-dream] reminder rules seed error: ' + String(err.message || err))
  }
  console.log(
    '[hong-ai-dream] notification seeds: templates_new=' +
      tCreated +
      ' rules_new=' +
      rulesCreated,
  )
  return { templates_created: tCreated, rules_created: rulesCreated }
}

module.exports = {
  ensureNotificationSeeds: ensureNotificationSeeds,
  templateDefs: templateDefs,
  reminderRuleDefs: reminderRuleDefs,
}
