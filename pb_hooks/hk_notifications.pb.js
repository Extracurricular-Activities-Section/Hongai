/// <reference path="../pb_data/types.d.ts" />

/**
 * Phase 9: Student + admin notification APIs + internal scheduler endpoints.
 */

function requireStudent(e, h) {
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }
  if (!e.auth.getBool('active')) throw new ForbiddenError('帳號未啟用')
  return e.auth
}

function requireSchedulerSecret(e) {
  var expected = ''
  try {
    expected = ($os.getenv('HK_SCHEDULER_SECRET') || '').trim()
  } catch (_) {
    expected = ''
  }
  if (!expected) {
    throw new ForbiddenError('排程密鑰未設定')
  }
  var got = ''
  try {
    got = (e.request.header.get('X-HAD-Scheduler-Secret') || '').trim()
  } catch (_) {
    got = ''
  }
  if (!got || got !== expected) {
    throw new ForbiddenError('排程驗證失敗')
  }
}

function queryParam(e, name) {
  try {
    return (e.request.url.query().get(name) || '').trim()
  } catch (_) {
    return ''
  }
}

function readRawBody(e) {
  try {
    var info = e.requestInfo()
    if (info && info.body && typeof info.body === 'object') return info.body
  } catch (_) {}
  return {}
}

function samplePreviewVars() {
  return {
    student_name: '測試同學',
    category_name: '學術學習',
    application_number: 'HAD-TEST-0001',
    approved_amount: '10000',
    student_message: '（範例學生可見訊息）',
    due_at: '2026-12-31T23:59:00.000Z',
    task_name: '成果報告繳交',
    task_description: '請上傳成果報告 PDF。',
    event_name: '成果發表會',
    event_start_at: '2026-06-01T09:00:00.000Z',
    event_location: '活動中心',
    event_note: '請準時出席。',
    reset_status_label: '已核准',
  }
}

// ---------------------------------------------------------------------------
// Student routes
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/notifications',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const student = requireStudent(e, h)

    var filter = queryParam(e, 'filter') || 'all'
    var category = queryParam(e, 'category')

    var parts = ['recipient_student = {:sid}', 'status = "active"']
    var params = { sid: student.id }
    if (filter === 'unread') parts.push('read_at = ""')
    if (category) {
      parts.push('ui_category = {:cat}')
      params.cat = category
    }

    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.notifications,
      parts.join(' && '),
      '-created',
      100,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(svc.notificationToPlain(rows[i]))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_students'),
)

routerAdd(
  'GET',
  '/api/hk/notifications/unread-count',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const student = requireStudent(e, h)
    var count = 0
    try {
      const rows = e.app.findRecordsByFilter(
        h.COLLECTIONS.notifications,
        'recipient_student = {:sid} && status = "active" && read_at = ""',
        '-created',
        500,
        0,
        { sid: student.id },
      )
      count = rows.length
    } catch (_) {
      count = 0
    }
    return e.json(200, { count: count })
  },
  $apis.requireAuth('hk_students'),
)

routerAdd(
  'POST',
  '/api/hk/notifications/{id}/read',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const student = requireStudent(e, h)
    const id = e.request.pathValue('id')
    const rec = svc.markNotificationRead(e.app, h, id, student.id)
    return e.json(200, { notification: svc.notificationToPlain(rec), message: '已標示為已讀' })
  },
  $apis.requireAuth('hk_students'),
)

routerAdd(
  'POST',
  '/api/hk/notifications/read-all',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const student = requireStudent(e, h)
    const result = svc.markAllRead(e.app, h, student.id)
    return e.json(200, { updated: result.updated, message: '已全部標示為已讀' })
  },
  $apis.requireAuth('hk_students'),
)

routerAdd(
  'GET',
  '/api/hk/notifications/preferences',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const student = requireStudent(e, h)
    const prefs = svc.getOrCreatePreferences(e.app, h, student.id)
    return e.json(200, { preferences: svc.preferencesToPlain(prefs) })
  },
  $apis.requireAuth('hk_students'),
)

routerAdd(
  'POST',
  '/api/hk/notifications/preferences',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const student = requireStudent(e, h)
    const raw = readRawBody(e)
    const prefs = svc.getOrCreatePreferences(e.app, h, student.id)

    if (raw.email_enabled != null) prefs.set('email_enabled', !!raw.email_enabled)
    if (raw.in_app_enabled != null) prefs.set('in_app_enabled', !!raw.in_app_enabled)
    if (raw.event_reminders != null) prefs.set('event_reminders', !!raw.event_reminders)
    if (raw.follow_up_reminders != null) prefs.set('follow_up_reminders', !!raw.follow_up_reminders)
    // Critical email cannot be fully disabled for safety — keep true
    prefs.set('system_critical_email', true)
    e.app.save(prefs)

    return e.json(200, {
      preferences: svc.preferencesToPlain(prefs),
      message: '偏好設定已更新',
    })
  },
  $apis.requireAuth('hk_students'),
)

// ---------------------------------------------------------------------------
// Staff / Admin routes
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/notifications',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const staff = h.requireStaffAuth(e)

    var studentId = queryParam(e, 'student_id')
    var applicationId = queryParam(e, 'application_id')
    var category = queryParam(e, 'category')

    var parts = ['status = "active"']
    var params = {}
    if (studentId) {
      parts.push('recipient_student = {:sid}')
      params.sid = studentId
    }
    if (applicationId) {
      if (!staff.getBool('is_admin')) {
        workflow.assertStaffCanAccessApplication(e.app, h, staff, applicationId)
      }
      parts.push('application = {:aid}')
      params.aid = applicationId
    }
    if (category) {
      parts.push('ui_category = {:cat}')
      params.cat = category
    }

    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.notifications,
      parts.join(' && '),
      '-created',
      100,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) {
      if (!staff.getBool('is_admin') && rows[i].getString('application')) {
        try {
          workflow.assertStaffCanAccessApplication(
            e.app,
            h,
            staff,
            rows[i].getString('application'),
          )
        } catch (_) {
          continue
        }
      }
      items.push(svc.notificationToPlain(rows[i]))
    }
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'GET',
  '/api/hk/admin/notifications/unread-count',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const staff = h.requireStaffAuth(e)
    var count = 0
    try {
      const rows = e.app.findRecordsByFilter(
        h.COLLECTIONS.notifications,
        'recipient_staff = {:sid} && status = "active" && read_at = ""',
        '-created',
        200,
        0,
        { sid: staff.id },
      )
      count = rows.length
    } catch (_) {
      count = 0
    }
    return e.json(200, { unread: count })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'GET',
  '/api/hk/admin/notifications/deliveries',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    h.requireStaffAuth(e)

    var status = queryParam(e, 'status')
    var applicationId = queryParam(e, 'application_id')
    var parts = ['id != ""']
    var params = {}
    if (status) {
      parts.push('status = {:st}')
      params.st = status
    }
    if (applicationId) {
      parts.push('application = {:aid}')
      params.aid = applicationId
    }

    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.notificationDeliveries,
      parts.join(' && '),
      '-created',
      100,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(svc.deliveryToPlain(rows[i], false))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'GET',
  '/api/hk/admin/notifications/deliveries/{id}',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const rec = e.app.findRecordById(h.COLLECTIONS.notificationDeliveries, id)
    return e.json(200, { delivery: svc.deliveryToPlain(rec, true) })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/notifications/deliveries/{id}/resend',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const neu = svc.resendDelivery(e.app, h, id)
    try {
      h.writeAudit(e.app, {
        actor_type: staff.getBool('is_admin') ? 'admin' : 'staff',
        actor_staff: staff.id,
        action: 'EMAIL_RESEND_REQUESTED',
        target_type: 'hk_notification_deliveries',
        target_id: neu.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { previous_delivery_id: id },
      })
    } catch (_) {}
    return e.json(200, {
      delivery: svc.deliveryToPlain(neu, false),
      message: '已重新排入寄送佇列',
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'GET',
  '/api/hk/admin/notifications/templates',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    h.requireAdminAuth(e)
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.notificationTemplates,
      'id != ""',
      'code',
      200,
      0,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(svc.templateToPlain(rows[i]))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/notifications/templates',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const svc = require(`${__hooks}/hk_notification_service.js`)
    const admin = h.requireAdminAuth(e)
    const raw = readRawBody(e)
    const code = h.trimStr(raw.code)
    if (!code) throw new BadRequestError('請提供 code')

    var existing = null
    try {
      existing = e.app.findFirstRecordByData(h.COLLECTIONS.notificationTemplates, 'code', code)
    } catch (_) {}

    var record = existing
    if (!record) {
      const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.notificationTemplates)
      record = new Record(col)
      record.set('code', code)
      record.set('version', 1)
    } else {
      record.set('version', (record.getInt('version') || 1) + 1)
    }

    if (raw.name != null) record.set('name', h.trimStr(raw.name))
    if (raw.channel != null) record.set('channel', h.trimStr(raw.channel) || 'both')
    if (raw.subject_template != null) record.set('subject_template', String(raw.subject_template))
    if (raw.body_template != null) record.set('body_template', String(raw.body_template))
    if (raw.category != null) record.set('category', h.trimStr(raw.category))
    if (raw.active != null) record.set('active', !!raw.active)
    if (raw.is_critical != null) record.set('is_critical', !!raw.is_critical)
    record.set('updated_by', admin.id)
    if (!existing) record.set('created_by', admin.id)
    if (!record.getString('name')) throw new BadRequestError('請提供名稱')
    if (!record.getString('body_template')) throw new BadRequestError('請提供本文範本')
    if (!record.getString('category')) record.set('category', 'system')
    if (!record.getString('channel')) record.set('channel', 'both')
    if (record.get('active') == null) record.set('active', true)

    e.app.save(record)
    return e.json(200, {
      template: svc.templateToPlain(record),
      message: existing ? '範本已更新' : '範本已建立',
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/notifications/templates/preview',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const render = require(`${__hooks}/hk_notification_render.js`)
    h.requireAdminAuth(e)
    const raw = readRawBody(e)

    var subjectTpl = ''
    var bodyTpl = ''
    if (raw.template_id) {
      const tpl = e.app.findRecordById(
        h.COLLECTIONS.notificationTemplates,
        h.trimStr(raw.template_id),
      )
      subjectTpl = tpl.getString('subject_template') || ''
      bodyTpl = tpl.getString('body_template') || ''
    } else {
      subjectTpl = String(raw.subject_template || '')
      bodyTpl = String(raw.body_template || '')
    }

    const vars = Object.assign(samplePreviewVars(), raw.variables || {})
    // Fake student marker — never a real identity number
    vars.student_name = vars.student_name || '測試同學'
    vars.student_no = 'U0000000'

    const subject = render.renderTemplate(subjectTpl, vars)
    const body = render.renderTemplate(bodyTpl, vars)
    const html = render.wrapEmailHtml(subject.text, render.textToSafeHtml(body.text))

    return e.json(200, {
      subject: subject,
      body: body,
      html: html,
      sample_student_no: 'U0000000',
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'GET',
  '/api/hk/admin/notifications/mail-status',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const mail = require(`${__hooks}/hk_mail_provider.js`)
    h.requireStaffAuth(e)
    return e.json(200, { status: mail.getProviderStatus() })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'GET',
  '/api/hk/admin/notifications/dashboard',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    h.requireStaffAuth(e)

    function countFilter(collection, filter) {
      try {
        return e.app.findRecordsByFilter(collection, filter, '', 500, 0).length
      } catch (_) {
        return 0
      }
    }

    return e.json(200, {
      summary: {
        notifications_active: countFilter(h.COLLECTIONS.notifications, 'status = "active"'),
        notifications_unread: countFilter(
          h.COLLECTIONS.notifications,
          'status = "active" && read_at = ""',
        ),
        deliveries_queued: countFilter(
          h.COLLECTIONS.notificationDeliveries,
          'status = "queued"',
        ),
        deliveries_failed: countFilter(
          h.COLLECTIONS.notificationDeliveries,
          'status = "failed"',
        ),
        deliveries_sent: countFilter(
          h.COLLECTIONS.notificationDeliveries,
          'status = "sent" || status = "sent_simulated"',
        ),
        reminders_pending: countFilter(
          h.COLLECTIONS.scheduledNotifications,
          'status = "pending"',
        ),
      },
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/notifications/seed',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    h.requireAdminAuth(e)
    const seed = require(`${__hooks}/hk_notification_templates_seed.js`)
    const result = seed.ensureNotificationSeeds(e.app)
    return e.json(200, { result: result, message: '種子資料已確保' })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Internal scheduler
// ---------------------------------------------------------------------------

routerAdd('POST', '/api/hk/internal/notifications/schedule', (e) => {
  requireSchedulerSecret(e)
  const h = require(`${__hooks}/hk_helpers.js`)
  const svc = require(`${__hooks}/hk_notification_service.js`)
  const result = svc.scheduleReminders(e.app, h)
  return e.json(200, { ok: true, result: result })
})

routerAdd('POST', '/api/hk/internal/notifications/process', (e) => {
  requireSchedulerSecret(e)
  const h = require(`${__hooks}/hk_helpers.js`)
  const svc = require(`${__hooks}/hk_notification_service.js`)
  var limit = 20
  try {
    var raw = readRawBody(e)
    if (raw.limit != null) limit = Number(raw.limit) || 20
  } catch (_) {}
  const result = svc.processNotificationQueue(e.app, h, limit)
  return e.json(200, { ok: true, result: result })
})

routerAdd('POST', '/api/hk/internal/notifications/process-reminders', (e) => {
  requireSchedulerSecret(e)
  const h = require(`${__hooks}/hk_helpers.js`)
  const svc = require(`${__hooks}/hk_notification_service.js`)
  const result = svc.processDueReminders(e.app, h)
  return e.json(200, { ok: true, result: result })
})
