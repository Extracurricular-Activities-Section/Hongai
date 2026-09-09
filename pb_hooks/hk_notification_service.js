/**
 * Core notification emit, queue, reminders, read-state helpers.
 */

var EVENT_TEMPLATE_MAP = {
  APPLICATION_SUBMITTED: 'application_submitted',
  APPLICATION_RESUBMITTED: 'application_submitted',
  SUPPLEMENT_REQUESTED: 'supplement_requested',
  APPLICATION_RETURNED: 'application_returned',
  APPLICATION_REJECTED: 'application_rejected',
  APPLICATION_APPROVED: 'application_approved',
  FUNDING_DECIDED: 'funding_decided',
  FUNDING_REVISED: 'funding_revised',
  SIGNED_DOCUMENT_REJECTED: 'signed_document_rejected',
  FOLLOW_UP_CREATED: 'follow_up_created',
  FOLLOW_UP_DUE_REMINDER: 'follow_up_due_reminder',
  FOLLOW_UP_OVERDUE: 'follow_up_overdue',
  FOLLOW_UP_SUPPLEMENT: 'follow_up_supplement',
  FOLLOW_UP_APPROVED: 'follow_up_approved',
  EVENT_UPCOMING: 'event_upcoming',
  IDENTITY_RESET_PROCESSED: 'identity_reset_processed',
}

var RETRY_BACKOFF_MINUTES = [0, 5, 30, 120]
var MAX_ATTEMPTS = 5
var PROCESSING_LEASE_MINUTES = 5

function loadRender() {
  return require(`${__hooks}/hk_notification_render.js`)
}

function loadMail() {
  return require(`${__hooks}/hk_mail_provider.js`)
}

function mapEventToTemplateCode(eventType) {
  var key = String(eventType || '').trim().toUpperCase()
  return EVENT_TEMPLATE_MAP[key] || ''
}

function findByIdempotency(app, collectionName, key) {
  if (!key) return null
  try {
    var rows = app.findRecordsByFilter(
      collectionName,
      'idempotency_key = {:k}',
      '-created',
      1,
      0,
      { k: key },
    )
    return rows.length ? rows[0] : null
  } catch (_) {
    return null
  }
}

function loadStudentProfileEmail(app, h, studentId) {
  try {
    var profile = app.findFirstRecordByFilter(h.COLLECTIONS.studentProfiles, 'student = {:sid}', {
      sid: studentId,
    })
    if (profile) return String(profile.getString('email') || '').trim()
  } catch (_) {}
  return ''
}

function loadStudentName(app, h, studentId) {
  try {
    var student = app.findRecordById(h.COLLECTIONS.students, studentId)
    return student.getString('name') || ''
  } catch (_) {}
  return ''
}

function getOrCreatePreferences(app, h, studentId) {
  try {
    var rows = app.findRecordsByFilter(
      h.COLLECTIONS.notificationPreferences,
      'student = {:sid}',
      '',
      1,
      0,
      { sid: studentId },
    )
    if (rows.length) return rows[0]
  } catch (_) {}
  try {
    var col = app.findCollectionByNameOrId(h.COLLECTIONS.notificationPreferences)
    var rec = new Record(col)
    rec.set('student', studentId)
    rec.set('email_enabled', true)
    rec.set('in_app_enabled', true)
    rec.set('event_reminders', true)
    rec.set('follow_up_reminders', true)
    rec.set('system_critical_email', true)
    app.save(rec)
    return rec
  } catch (_) {
    return null
  }
}

function preferencesAllowEmail(prefs, template) {
  var isCritical = !!(template && template.getBool('is_critical'))
  if (isCritical) return true
  if (!prefs) return true
  return prefs.getBool('email_enabled') !== false
}

function preferencesAllowInApp(prefs) {
  if (!prefs) return true
  return prefs.getBool('in_app_enabled') !== false
}

function preferencesAllowReminder(prefs, category) {
  if (!prefs) return true
  if (category === 'event') return prefs.getBool('event_reminders') !== false
  if (category === 'follow_up') return prefs.getBool('follow_up_reminders') !== false
  return true
}

function fallbackTitle(eventType, vars) {
  var code = mapEventToTemplateCode(eventType) || eventType
  var appNo = vars && vars.application_number ? String(vars.application_number) : ''
  return '系統通知' + (appNo ? '（' + appNo + '）' : '') + '：' + code
}

function fallbackBody(vars) {
  var parts = []
  if (vars && vars.student_message) parts.push(String(vars.student_message))
  if (vars && vars.task_name) parts.push('任務：' + String(vars.task_name))
  if (!parts.length) parts.push('請登入宏愛圓夢系統查看詳情。')
  return parts.join('\n')
}

function uiCategoryFromTemplate(template) {
  if (!template) return 'system'
  var c = template.getString('category') || 'system'
  if (c === 'supplement') return 'supplement'
  return c
}

/**
 * Core emit. Soft-fail wrappers should call this inside try/catch.
 *
 * payload: {
 *   studentId, applicationId?, taskId?, supplementId?,
 *   variables{}, idempotencyKey?, actionUrl?, staffRecipients?[],
 *   skipEmail?, skipInApp?
 * }
 */
function emitNotificationEvent(app, h, eventType, payload) {
  payload = payload || {}
  var render = loadRender()
  var mail = loadMail()

  var idem = String(payload.idempotencyKey || '').trim()
  if (idem) {
    var existing = findByIdempotency(app, h.COLLECTIONS.notifications, idem)
    if (existing) {
      var existingDelivery = null
      try {
        var drows = app.findRecordsByFilter(
          h.COLLECTIONS.notificationDeliveries,
          'notification = {:nid}',
          '-created',
          1,
          0,
          { nid: existing.id },
        )
        if (drows.length) existingDelivery = drows[0]
      } catch (_) {}
      return { notification: existing, delivery: existingDelivery, duplicated: true }
    }
  }

  var templateCode = mapEventToTemplateCode(eventType)
  if (!templateCode && payload.templateCode) templateCode = String(payload.templateCode)
  if (!templateCode) {
    throw new Error('未知通知事件類型：' + eventType)
  }

  var template = null
  try {
    template = app.findFirstRecordByData(h.COLLECTIONS.notificationTemplates, 'code', templateCode)
  } catch (_) {
    template = null
  }
  if (!template || !template.getBool('active')) {
    throw new Error('通知範本不存在或未啟用：' + templateCode)
  }

  var vars = Object.assign({}, payload.variables || {})
  if (!vars.student_name && payload.studentId) {
    vars.student_name = loadStudentName(app, h, payload.studentId)
  }

  var subjectTpl = template.getString('subject_template') || ''
  var bodyTpl = template.getString('body_template') || ''
  var subjectResult = render.renderTemplate(subjectTpl, vars)
  var bodyResult = render.renderTemplate(bodyTpl, vars)

  var title = subjectResult.text || fallbackTitle(eventType, vars)
  var message = bodyResult.text || fallbackBody(vars)
  // Soft: missing vars already emptied; do not hard-fail in-app

  var prefs = payload.studentId ? getOrCreatePreferences(app, h, payload.studentId) : null
  var channel = template.getString('channel') || 'both'
  var wantInApp = (channel === 'in_app' || channel === 'both') && !payload.skipInApp
  var wantEmail = (channel === 'email' || channel === 'both') && !payload.skipEmail

  if (wantInApp && prefs && !preferencesAllowInApp(prefs)) {
    wantInApp = false
  }
  // Reminder categories respect reminder prefs for non-critical
  if (
    wantInApp &&
    prefs &&
    !template.getBool('is_critical') &&
    !preferencesAllowReminder(prefs, template.getString('category'))
  ) {
    // still allow in-app for explicit events unless reminder category blocked for scheduled ones
    if (payload.isReminder) wantInApp = false
  }

  var notification = null
  if (wantInApp && payload.studentId) {
    var ncol = app.findCollectionByNameOrId(h.COLLECTIONS.notifications)
    notification = new Record(ncol)
    notification.set('recipient_student', payload.studentId)
    notification.set('notification_type', templateCode)
    notification.set('title', title.slice(0, 200) || '系統通知')
    notification.set('message', message || '請登入系統查看。')
    if (payload.applicationId) notification.set('application', payload.applicationId)
    if (payload.taskId) notification.set('follow_up_task', payload.taskId)
    if (payload.supplementId) notification.set('supplement_request', payload.supplementId)
    if (payload.actionUrl) notification.set('action_url', String(payload.actionUrl))
    notification.set('status', 'active')
    if (idem) notification.set('idempotency_key', idem)
    notification.set('ui_category', uiCategoryFromTemplate(template))
    app.save(notification)
  }

  // Staff recipients (in-app only, optional)
  if (wantInApp && Array.isArray(payload.staffRecipients)) {
    for (var si = 0; si < payload.staffRecipients.length; si++) {
      var staffId = String(payload.staffRecipients[si] || '').trim()
      if (!staffId) continue
      try {
        var scol = app.findCollectionByNameOrId(h.COLLECTIONS.notifications)
        var srec = new Record(scol)
        srec.set('recipient_staff', staffId)
        srec.set('notification_type', templateCode)
        srec.set('title', title.slice(0, 200) || '系統通知')
        srec.set('message', message || '請登入系統查看。')
        if (payload.applicationId) srec.set('application', payload.applicationId)
        if (payload.taskId) srec.set('follow_up_task', payload.taskId)
        srec.set('status', 'active')
        if (idem) srec.set('idempotency_key', idem + ':staff:' + staffId)
        srec.set('ui_category', uiCategoryFromTemplate(template))
        app.save(srec)
        if (!notification) notification = srec
      } catch (_) {}
    }
  }

  try {
    h.writeAudit(app, {
      actor_type: 'system',
      action: 'NOTIFICATION_CREATED',
      target_type: 'hk_notifications',
      target_id: notification ? notification.id : '',
      metadata: {
        event_type: eventType,
        template_code: templateCode,
        application_id: payload.applicationId || null,
        student_id: payload.studentId || null,
        has_missing_vars: !!(subjectResult.missing.length || bodyResult.missing.length),
      },
    })
  } catch (_) {}

  var delivery = null
  if (wantEmail && payload.studentId) {
    if (!preferencesAllowEmail(prefs, template)) {
      wantEmail = false
    } else if (
      prefs &&
      payload.isReminder &&
      !template.getBool('is_critical') &&
      !preferencesAllowReminder(prefs, template.getString('category'))
    ) {
      wantEmail = false
    }
  } else {
    wantEmail = false
  }

  if (wantEmail) {
    var email = loadStudentProfileEmail(app, h, payload.studentId)
    var deliveryIdem = idem ? idem + ':email' : ''
    if (deliveryIdem) {
      var existingDel = findByIdempotency(app, h.COLLECTIONS.notificationDeliveries, deliveryIdem)
      if (existingDel) {
        return { notification: notification, delivery: existingDel, duplicated: true }
      }
    }

    var dcol = app.findCollectionByNameOrId(h.COLLECTIONS.notificationDeliveries)
    delivery = new Record(dcol)
    if (notification) delivery.set('notification', notification.id)
    delivery.set('template', template.id)
    delivery.set('channel', 'email')
    delivery.set('recipient', email || '(invalid)')
    delivery.set('subject', title.slice(0, 300) || '系統通知')
    var emailBody = message
    // For email, missing critical vars: still send with empty placeholders; caller may soft-fail
    delivery.set('rendered_body', emailBody)
    delivery.set('provider', mail.getMailConfig().provider || 'none')
    delivery.set('attempt_count', 0)
    if (payload.applicationId) delivery.set('application', payload.applicationId)
    delivery.set('recipient_student', payload.studentId)
    if (deliveryIdem) delivery.set('idempotency_key', deliveryIdem)

    if (!mail.isValidEmail(email)) {
      delivery.set('status', 'skipped_invalid_recipient')
      delivery.set('error_code', 'INVALID_RECIPIENT')
      delivery.set('error_message', '學生聯絡 Email 無效或未設定')
      app.save(delivery)
    } else if (
      (mail.getMailConfig().provider || '').toLowerCase() === 'disabled' ||
      (mail.getMailConfig().provider || '').toLowerCase() === 'off'
    ) {
      delivery.set('status', 'skipped_provider_disabled')
      delivery.set('error_code', 'PROVIDER_DISABLED')
      delivery.set('error_message', '郵件功能已停用')
      app.save(delivery)
    } else {
      delivery.set('status', 'queued')
      delivery.set('next_retry_at', new Date().toISOString())
      app.save(delivery)
      try {
        h.writeAudit(app, {
          actor_type: 'system',
          action: 'EMAIL_QUEUED',
          target_type: 'hk_notification_deliveries',
          target_id: delivery.id,
          metadata: {
            template_code: templateCode,
            recipient_domain: email.split('@')[1] || '',
            application_id: payload.applicationId || null,
          },
        })
      } catch (_) {}
    }
  }

  return { notification: notification, delivery: delivery, duplicated: false }
}

function safeEmitNotificationEvent(app, h, eventType, payload) {
  try {
    return emitNotificationEvent(app, h, eventType, payload)
  } catch (err) {
    try {
      console.log(
        '[had] notification emit failed: ' +
          eventType +
          ' ' +
          String(err && err.message ? err.message : err),
      )
    } catch (_) {}
    return null
  }
}

function claimDelivery(app, record) {
  var leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MINUTES * 60 * 1000).toISOString()
  record.set('status', 'processing')
  record.set('processing_lease_until', leaseUntil)
  record.set('last_attempt_at', new Date().toISOString())
  var attempts = Number(record.get('attempt_count') || 0) + 1
  record.set('attempt_count', attempts)
  app.save(record)
  return attempts
}

function processNotificationQueue(app, h, limit) {
  var mail = loadMail()
  var render = loadRender()
  var n = Number(limit) || 20
  if (n < 1) n = 1
  if (n > 100) n = 100

  var nowIso = new Date().toISOString()
  var candidates = []
  try {
    candidates = app.findRecordsByFilter(
      h.COLLECTIONS.notificationDeliveries,
      '(status = "queued") || (status = "failed" && next_retry_at <= {:now}) || (status = "processing" && processing_lease_until <= {:now})',
      'created',
      n,
      0,
      { now: nowIso },
    )
  } catch (_) {
    candidates = []
  }

  var processed = 0
  var sent = 0
  var failed = 0

  for (var i = 0; i < candidates.length; i++) {
    var row = candidates[i]
    var attempts = 0
    try {
      attempts = claimDelivery(app, row)
    } catch (_) {
      continue
    }

    var to = row.getString('recipient')
    var subject = row.getString('subject')
    var text = row.getString('rendered_body') || ''
    var html = render.wrapEmailHtml(subject, render.textToSafeHtml(text))

    var result = mail.sendMail({ to: to, subject: subject, text: text, html: html })

    if (result.ok) {
      row.set('status', result.simulated ? 'sent_simulated' : 'sent')
      row.set('sent_at', new Date().toISOString())
      row.set('provider_message_id', result.messageId || '')
      row.set('error_code', '')
      row.set('error_message', '')
      row.set('next_retry_at', null)
      row.set('processing_lease_until', null)
      app.save(row)
      sent++
      processed++
      continue
    }

    var permanent =
      result.permanent ||
      result.code === 'PROVIDER_NOT_CONFIGURED' ||
      result.code === 'INVALID_RECIPIENT'
    row.set('error_code', result.code || 'SEND_FAILED')
    row.set('error_message', String(result.message || '寄送失敗').slice(0, 500))
    row.set('processing_lease_until', null)

    if (permanent || attempts >= MAX_ATTEMPTS) {
      row.set('status', 'failed')
      row.set('next_retry_at', null)
      failed++
    } else {
      var backoffIdx = Math.min(attempts, RETRY_BACKOFF_MINUTES.length - 1)
      var waitMin = RETRY_BACKOFF_MINUTES[backoffIdx]
      row.set('status', 'failed')
      row.set(
        'next_retry_at',
        new Date(Date.now() + waitMin * 60 * 1000).toISOString(),
      )
      failed++
    }
    app.save(row)
    processed++
  }

  return { processed: processed, sent: sent, failed: failed }
}

function dateMs(value) {
  if (!value) return NaN
  try {
    if (value.unixTime) return value.unixTime() * 1000
    if (value.time) return value.time().unix() * 1000
  } catch (_) {}
  return Date.parse(String(value))
}

function addMinutesToMs(ms, minutes) {
  return ms + Number(minutes) * 60 * 1000
}

function createScheduledIfAbsent(app, h, data) {
  var dedupe = data.dedupe_key
  try {
    var existing = app.findFirstRecordByData(h.COLLECTIONS.scheduledNotifications, 'dedupe_key', dedupe)
    if (existing) return { record: existing, created: false }
  } catch (_) {}
  try {
    var col = app.findCollectionByNameOrId(h.COLLECTIONS.scheduledNotifications)
    var rec = new Record(col)
    rec.set('rule', data.rule)
    rec.set('student', data.student)
    if (data.application) rec.set('application', data.application)
    if (data.task) rec.set('task', data.task)
    if (data.supplement) rec.set('supplement', data.supplement)
    rec.set('scheduled_for', data.scheduled_for)
    rec.set('status', 'pending')
    rec.set('dedupe_key', dedupe)
    if (data.payload) rec.set('payload', data.payload)
    app.save(rec)
    return { record: rec, created: true }
  } catch (err) {
    // unique race
    try {
      var again = app.findFirstRecordByData(h.COLLECTIONS.scheduledNotifications, 'dedupe_key', dedupe)
      if (again) return { record: again, created: false }
    } catch (_) {}
    throw err
  }
}

function scheduleReminders(app, h) {
  var rules = []
  try {
    rules = app.findRecordsByFilter(
      h.COLLECTIONS.reminderRules,
      'active = true',
      'offset_minutes',
      200,
      0,
    )
  } catch (_) {
    rules = []
  }

  var created = 0
  var scanned = 0

  // Follow-up due
  var followRules = []
  var eventRules = []
  var suppRules = []
  for (var r = 0; r < rules.length; r++) {
    var tt = rules[r].getString('target_type')
    if (tt === 'follow_up_due') followRules.push(rules[r])
    else if (tt === 'event_start') eventRules.push(rules[r])
    else if (tt === 'supplement_due') suppRules.push(rules[r])
  }

  var tasks = []
  try {
    tasks = app.findRecordsByFilter(
      h.COLLECTIONS.followUpTasks,
      'due_at != "" && status != "approved" && status != "waived" && status != "under_review" && status != "submitted"',
      '-created',
      500,
      0,
    )
  } catch (_) {
    tasks = []
  }

  for (var t = 0; t < tasks.length; t++) {
    var task = tasks[t]
    scanned++
    var dueMs = dateMs(task.get('due_at'))
    if (isNaN(dueMs)) continue
    for (var fr = 0; fr < followRules.length; fr++) {
      var rule = followRules[fr]
      var when = new Date(addMinutesToMs(dueMs, rule.getInt('offset_minutes') || 0)).toISOString()
      var dedupe =
        'fu:' + task.id + ':rule:' + rule.id + ':off:' + String(rule.getInt('offset_minutes') || 0)
      var res = createScheduledIfAbsent(app, h, {
        rule: rule.id,
        student: task.getString('student'),
        application: task.getString('application'),
        task: task.id,
        scheduled_for: when,
        dedupe_key: dedupe,
        payload: {
          event_type:
            (rule.getInt('offset_minutes') || 0) > 0 ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE_REMINDER',
          task_name: task.getString('name'),
        },
      })
      if (res.created) created++
    }
  }

  // Events
  var eventTasks = []
  try {
    eventTasks = app.findRecordsByFilter(
      h.COLLECTIONS.followUpTasks,
      'event_start_at != "" && status != "approved" && status != "waived"',
      '-created',
      500,
      0,
    )
  } catch (_) {
    eventTasks = []
  }
  for (var et = 0; et < eventTasks.length; et++) {
    var etask = eventTasks[et]
    scanned++
    var startMs = dateMs(etask.get('event_start_at'))
    if (isNaN(startMs)) continue
    for (var er = 0; er < eventRules.length; er++) {
      var erule = eventRules[er]
      var ewhen = new Date(
        addMinutesToMs(startMs, erule.getInt('offset_minutes') || 0),
      ).toISOString()
      var ededupe =
        'ev:' +
        etask.id +
        ':rule:' +
        erule.id +
        ':off:' +
        String(erule.getInt('offset_minutes') || 0)
      var eres = createScheduledIfAbsent(app, h, {
        rule: erule.id,
        student: etask.getString('student'),
        application: etask.getString('application'),
        task: etask.id,
        scheduled_for: ewhen,
        dedupe_key: ededupe,
        payload: {
          event_type: 'EVENT_UPCOMING',
          event_name: etask.getString('name'),
          event_start_at: String(etask.get('event_start_at') || ''),
          event_location: etask.getString('event_location') || '',
          event_note: etask.getString('event_note') || '',
        },
      })
      if (eres.created) created++
    }
  }

  // Pending supplements
  var supplements = []
  try {
    supplements = app.findRecordsByFilter(
      h.COLLECTIONS.supplementRequests,
      'status = "pending" && due_at != ""',
      '-created',
      500,
      0,
    )
  } catch (_) {
    supplements = []
  }
  for (var s = 0; s < supplements.length; s++) {
    var supp = supplements[s]
    scanned++
    var sMs = dateMs(supp.get('due_at'))
    if (isNaN(sMs)) continue
    var application = null
    try {
      application = app.findRecordById(h.COLLECTIONS.applications, supp.getString('application'))
    } catch (_) {}
    if (!application) continue
    for (var sr = 0; sr < suppRules.length; sr++) {
      var srule = suppRules[sr]
      var swhen = new Date(
        addMinutesToMs(sMs, srule.getInt('offset_minutes') || 0),
      ).toISOString()
      var sdedupe =
        'sup:' +
        supp.id +
        ':rule:' +
        srule.id +
        ':off:' +
        String(srule.getInt('offset_minutes') || 0)
      var sres = createScheduledIfAbsent(app, h, {
        rule: srule.id,
        student: application.getString('student'),
        application: application.id,
        supplement: supp.id,
        scheduled_for: swhen,
        dedupe_key: sdedupe,
        payload: {
          event_type: 'SUPPLEMENT_REQUESTED',
          student_message: supp.getString('message') || '',
          due_at: String(supp.get('due_at') || ''),
        },
      })
      if (sres.created) created++
    }
  }

  return { scanned: scanned, created: created }
}

function processDueReminders(app, h) {
  var nowIso = new Date().toISOString()
  var rows = []
  try {
    rows = app.findRecordsByFilter(
      h.COLLECTIONS.scheduledNotifications,
      'status = "pending" && scheduled_for <= {:now}',
      'scheduled_for',
      100,
      0,
      { now: nowIso },
    )
  } catch (_) {
    rows = []
  }

  var sent = 0
  var skipped = 0

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    var payload = {}
    try {
      var raw = row.get('payload')
      if (typeof raw === 'string') payload = JSON.parse(raw)
      else if (raw && typeof raw === 'object') payload = raw
    } catch (_) {
      payload = {}
    }

    var eventType = payload.event_type || 'FOLLOW_UP_DUE_REMINDER'
    var task = null
    var application = null
    var studentId = row.getString('student')

    if (row.getString('task')) {
      try {
        task = app.findRecordById(h.COLLECTIONS.followUpTasks, row.getString('task'))
        var st = task.getString('status')
        if (st === 'approved' || st === 'waived' || st === 'under_review' || st === 'submitted') {
          row.set('status', 'skipped')
          app.save(row)
          skipped++
          continue
        }
      } catch (_) {}
    }
    if (row.getString('supplement')) {
      try {
        var supp = app.findRecordById(h.COLLECTIONS.supplementRequests, row.getString('supplement'))
        if (supp.getString('status') !== 'pending') {
          row.set('status', 'skipped')
          app.save(row)
          skipped++
          continue
        }
      } catch (_) {}
    }
    if (row.getString('application')) {
      try {
        application = app.findRecordById(h.COLLECTIONS.applications, row.getString('application'))
      } catch (_) {}
    }

    var vars = Object.assign({}, payload)
    if (task) {
      vars.task_name = vars.task_name || task.getString('name')
      vars.task_description = task.getString('description') || ''
      vars.due_at = task.get('due_at') ? String(task.get('due_at')) : ''
      vars.event_name = vars.event_name || task.getString('name')
      vars.event_start_at = task.get('event_start_at') ? String(task.get('event_start_at')) : ''
      vars.event_location = task.getString('event_location') || ''
      vars.event_note = task.getString('event_note') || ''
    }
    if (application) {
      vars.application_number = application.getString('application_number') || ''
      try {
        var cat = app.findRecordById(
          h.COLLECTIONS.applicationCategories,
          application.getString('category'),
        )
        vars.category_name = cat.getString('name') || ''
      } catch (_) {}
    }

    try {
      emitNotificationEvent(app, h, eventType, {
        studentId: studentId,
        applicationId: row.getString('application') || undefined,
        taskId: row.getString('task') || undefined,
        supplementId: row.getString('supplement') || undefined,
        variables: vars,
        idempotencyKey: 'sched:' + row.id,
        isReminder: true,
        actionUrl: row.getString('application')
          ? '/student/applications/' + row.getString('application')
          : undefined,
      })
      row.set('status', 'sent')
      app.save(row)
      sent++
    } catch (err) {
      try {
        console.log('[had] reminder emit failed: ' + String(err.message || err))
      } catch (_) {}
      row.set('status', 'skipped')
      app.save(row)
      skipped++
    }
  }

  return { sent: sent, skipped: skipped, processed: sent + skipped }
}

function cancelRemindersForTask(app, h, taskId) {
  if (!taskId) return { cancelled: 0 }
  var rows = []
  try {
    rows = app.findRecordsByFilter(
      h.COLLECTIONS.scheduledNotifications,
      'task = {:tid} && status = "pending"',
      '',
      200,
      0,
      { tid: taskId },
    )
  } catch (_) {
    rows = []
  }
  var n = 0
  for (var i = 0; i < rows.length; i++) {
    rows[i].set('status', 'cancelled')
    app.save(rows[i])
    n++
  }
  return { cancelled: n }
}

function cancelRemindersForSupplement(app, h, supplementId) {
  if (!supplementId) return { cancelled: 0 }
  var rows = []
  try {
    rows = app.findRecordsByFilter(
      h.COLLECTIONS.scheduledNotifications,
      'supplement = {:sid} && status = "pending"',
      '',
      200,
      0,
      { sid: supplementId },
    )
  } catch (_) {
    rows = []
  }
  var n = 0
  for (var i = 0; i < rows.length; i++) {
    rows[i].set('status', 'cancelled')
    app.save(rows[i])
    n++
  }
  return { cancelled: n }
}

function markNotificationRead(app, h, notificationId, studentId) {
  var rec = app.findRecordById(h.COLLECTIONS.notifications, notificationId)
  if (studentId && rec.getString('recipient_student') !== studentId) {
    throw new ForbiddenError('無權限')
  }
  if (!rec.get('read_at')) {
    rec.set('read_at', new Date().toISOString())
    app.save(rec)
  }
  return rec
}

function markAllRead(app, h, studentId) {
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.notifications,
    'recipient_student = {:sid} && read_at = "" && status = "active"',
    '-created',
    500,
    0,
    { sid: studentId },
  )
  var now = new Date().toISOString()
  var n = 0
  for (var i = 0; i < rows.length; i++) {
    rows[i].set('read_at', now)
    app.save(rows[i])
    n++
  }
  return { updated: n }
}

function resendDelivery(app, h, deliveryId) {
  var old = app.findRecordById(h.COLLECTIONS.notificationDeliveries, deliveryId)
  var col = app.findCollectionByNameOrId(h.COLLECTIONS.notificationDeliveries)
  var neu = new Record(col)
  if (old.getString('notification')) neu.set('notification', old.getString('notification'))
  if (old.getString('template')) neu.set('template', old.getString('template'))
  neu.set('channel', 'email')
  neu.set('recipient', old.getString('recipient'))
  neu.set('subject', old.getString('subject'))
  neu.set('rendered_body', old.getString('rendered_body'))
  neu.set('provider', loadMail().getMailConfig().provider || 'none')
  neu.set('status', 'queued')
  neu.set('attempt_count', 0)
  neu.set('next_retry_at', new Date().toISOString())
  if (old.getString('application')) neu.set('application', old.getString('application'))
  if (old.getString('recipient_student')) {
    neu.set('recipient_student', old.getString('recipient_student'))
  }
  neu.set(
    'idempotency_key',
    'resend:' + old.id + ':' + String(Date.now()),
  )
  app.save(neu)

  try {
    h.writeAudit(app, {
      actor_type: 'system',
      action: 'EMAIL_RESEND_QUEUED',
      target_type: 'hk_notification_deliveries',
      target_id: neu.id,
      metadata: { previous_delivery_id: old.id },
    })
  } catch (_) {}

  return neu
}

function notificationToPlain(record) {
  return {
    id: record.id,
    recipient_student: record.getString('recipient_student') || null,
    recipient_staff: record.getString('recipient_staff') || null,
    notification_type: record.getString('notification_type'),
    title: record.getString('title'),
    message: record.getString('message'),
    application: record.getString('application') || null,
    follow_up_task: record.getString('follow_up_task') || null,
    supplement_request: record.getString('supplement_request') || null,
    action_url: record.getString('action_url') || null,
    read_at: record.get('read_at') ? String(record.get('read_at')) : null,
    status: record.getString('status'),
    ui_category: record.getString('ui_category') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function deliveryToPlain(record, includeBody) {
  var plain = {
    id: record.id,
    notification: record.getString('notification') || null,
    template: record.getString('template') || null,
    channel: record.getString('channel'),
    recipient: record.getString('recipient'),
    subject: record.getString('subject'),
    provider: record.getString('provider') || null,
    provider_message_id: record.getString('provider_message_id') || null,
    status: record.getString('status'),
    attempt_count: Number(record.get('attempt_count') || 0),
    last_attempt_at: record.get('last_attempt_at') ? String(record.get('last_attempt_at')) : null,
    sent_at: record.get('sent_at') ? String(record.get('sent_at')) : null,
    next_retry_at: record.get('next_retry_at') ? String(record.get('next_retry_at')) : null,
    error_code: record.getString('error_code') || null,
    error_message: record.getString('error_message') || null,
    application: record.getString('application') || null,
    recipient_student: record.getString('recipient_student') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
  if (includeBody) plain.rendered_body = record.getString('rendered_body') || null
  return plain
}

function templateToPlain(record) {
  return {
    id: record.id,
    code: record.getString('code'),
    name: record.getString('name'),
    channel: record.getString('channel'),
    subject_template: record.getString('subject_template') || null,
    body_template: record.getString('body_template'),
    active: record.getBool('active'),
    category: record.getString('category'),
    version: record.getInt('version') || 1,
    is_critical: record.getBool('is_critical'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function preferencesToPlain(record) {
  return {
    id: record.id,
    student: record.getString('student'),
    email_enabled: record.getBool('email_enabled'),
    in_app_enabled: record.getBool('in_app_enabled'),
    event_reminders: record.getBool('event_reminders'),
    follow_up_reminders: record.getBool('follow_up_reminders'),
    system_critical_email: record.getBool('system_critical_email'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

module.exports = {
  EVENT_TEMPLATE_MAP: EVENT_TEMPLATE_MAP,
  mapEventToTemplateCode: mapEventToTemplateCode,
  emitNotificationEvent: emitNotificationEvent,
  safeEmitNotificationEvent: safeEmitNotificationEvent,
  processNotificationQueue: processNotificationQueue,
  scheduleReminders: scheduleReminders,
  processDueReminders: processDueReminders,
  cancelRemindersForTask: cancelRemindersForTask,
  cancelRemindersForSupplement: cancelRemindersForSupplement,
  markNotificationRead: markNotificationRead,
  markAllRead: markAllRead,
  resendDelivery: resendDelivery,
  getOrCreatePreferences: getOrCreatePreferences,
  notificationToPlain: notificationToPlain,
  deliveryToPlain: deliveryToPlain,
  templateToPlain: templateToPlain,
  preferencesToPlain: preferencesToPlain,
  loadStudentName: loadStudentName,
  loadStudentProfileEmail: loadStudentProfileEmail,
}
