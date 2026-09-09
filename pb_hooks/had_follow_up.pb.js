/// <reference path="../pb_data/types.d.ts" />

/**
 * Phase 8: Follow-up task templates, category assignments, student/staff task flows.
 * Shared ensureFollowUpTasksForApplication lives in had_follow_up_lib.js.
 */

function requireStudent(e, h) {
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }
  if (!e.auth.getBool('active')) throw new ForbiddenError('帳號未啟用')
  return e.auth
}

function actorTypeOfStaff(staff) {
  return staff.getBool('is_admin') ? 'admin' : 'staff'
}

function readRawBody(e) {
  try {
    var info = e.requestInfo()
    if (info && info.body && typeof info.body === 'object') return info.body
  } catch (_) {}
  return {}
}

function parseIdList(value) {
  if (value == null) return []
  if (Array.isArray(value)) {
    var out = []
    for (var i = 0; i < value.length; i++) {
      var id = String(value[i] || '').trim()
      if (id) out.push(id)
    }
    return out
  }
  if (typeof value === 'string') {
    var t = value.trim()
    if (!t) return []
    try {
      var parsed = JSON.parse(t)
      if (Array.isArray(parsed)) return parseIdList(parsed)
    } catch (_) {}
    return t.split(',').map(function (s) {
      return s.trim()
    }).filter(Boolean)
  }
  return []
}

function listTaskAttachments(app, h, taskId) {
  return app.findRecordsByFilter(
    h.COLLECTIONS.attachments,
    'follow_up_task = {:tid} && status = "active"',
    '-created',
    50,
    0,
    { tid: taskId },
  )
}

function attachmentBrief(record) {
  return {
    id: record.id,
    original_filename: record.getString('original_filename'),
    mime_type: record.getString('mime_type'),
    extension: record.getString('extension'),
    size_bytes: Number(record.get('size_bytes') || 0),
    status: record.getString('status'),
  }
}

// ---------------------------------------------------------------------------
// Admin: templates CRUD
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/had/admin/follow-up/templates',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    h.requireAdminAuth(e)
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpTaskTemplates,
      'id != ""',
      'code',
      200,
      0,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(lib.templateToPlain(rows[i]))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/templates',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)
    const raw = readRawBody(e)
    const data = new DynamicModel({
      name: '',
      code: '',
      description: '',
      task_type: 'file_upload',
      allowed_extensions: [],
      max_files: 0,
      max_file_size_mb: 0,
      requires_review: false,
      required: false,
      default_due_offset_days: 0,
      active: true,
      student_instructions: '',
      review_instructions: '',
    })
    e.bindBody(data)

    const name = h.trimStr(data.name || raw.name)
    const code = h.trimStr(data.code || raw.code)
    const taskType = h.trimStr(data.task_type || raw.task_type) || 'file_upload'
    if (!name || !code) throw new BadRequestError('名稱與代碼必填')
    const allowedTypes = [
      'file_upload',
      'text',
      'file_and_text',
      'event_attendance',
      'confirmation',
      'other',
    ]
    if (allowedTypes.indexOf(taskType) < 0) throw new BadRequestError('task_type 無效')

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.followUpTaskTemplates)
    const record = new Record(col)
    record.set('name', name)
    record.set('code', code)
    if (h.trimStr(data.description || raw.description)) {
      record.set('description', h.trimStr(data.description || raw.description))
    }
    record.set('task_type', taskType)
    var allowed = raw.allowed_extensions != null ? raw.allowed_extensions : data.allowed_extensions
    if (allowed) record.set('allowed_extensions', allowed)
    var maxFiles = Number(raw.max_files != null ? raw.max_files : data.max_files)
    if (!isNaN(maxFiles) && maxFiles > 0) record.set('max_files', maxFiles)
    var maxMb = Number(raw.max_file_size_mb != null ? raw.max_file_size_mb : data.max_file_size_mb)
    if (!isNaN(maxMb) && maxMb > 0) record.set('max_file_size_mb', maxMb)
    record.set(
      'requires_review',
      raw.requires_review === true || data.requires_review === true,
    )
    record.set('required', raw.required === true || data.required === true)
    var offset = Number(
      raw.default_due_offset_days != null
        ? raw.default_due_offset_days
        : data.default_due_offset_days,
    )
    if (!isNaN(offset) && offset !== 0) record.set('default_due_offset_days', offset)
    record.set('active', raw.active !== false && data.active !== false)
    if (h.trimStr(data.student_instructions || raw.student_instructions)) {
      record.set(
        'student_instructions',
        h.trimStr(data.student_instructions || raw.student_instructions),
      )
    }
    if (h.trimStr(data.review_instructions || raw.review_instructions)) {
      record.set(
        'review_instructions',
        h.trimStr(data.review_instructions || raw.review_instructions),
      )
    }
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'FOLLOW_UP_TEMPLATE_CREATED',
        target_type: 'had_follow_up_task_templates',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { template: lib.templateToPlain(record) })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/templates/{id}',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)
    const id = e.request.pathValue('id')
    const record = e.app.findRecordById(h.COLLECTIONS.followUpTaskTemplates, id)
    const raw = readRawBody(e)

    if (raw.name != null) record.set('name', h.trimStr(raw.name))
    if (raw.description != null) record.set('description', h.trimStr(raw.description))
    if (raw.task_type != null) record.set('task_type', h.trimStr(raw.task_type))
    if (raw.allowed_extensions != null) record.set('allowed_extensions', raw.allowed_extensions)
    if (raw.max_files != null) record.set('max_files', Number(raw.max_files) || 0)
    if (raw.max_file_size_mb != null) {
      record.set('max_file_size_mb', Number(raw.max_file_size_mb) || 0)
    }
    if (raw.requires_review != null) record.set('requires_review', !!raw.requires_review)
    if (raw.required != null) record.set('required', !!raw.required)
    if (raw.default_due_offset_days != null) {
      record.set('default_due_offset_days', Number(raw.default_due_offset_days) || 0)
    }
    if (raw.active != null) record.set('active', !!raw.active)
    if (raw.student_instructions != null) {
      record.set('student_instructions', h.trimStr(raw.student_instructions))
    }
    if (raw.review_instructions != null) {
      record.set('review_instructions', h.trimStr(raw.review_instructions))
    }
    // code is immutable after create (mass-assignment safe)
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'FOLLOW_UP_TEMPLATE_UPDATED',
        target_type: 'had_follow_up_task_templates',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { template: lib.templateToPlain(record) })
  },
  $apis.requireAuth('had_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin: category template assignments
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/had/admin/follow-up/category-templates',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    h.requireAdminAuth(e)
    var categoryId = ''
    try {
      categoryId = (e.request.url.query().get('category_id') || '').trim()
    } catch (_) {}
    var filter = 'id != ""'
    var params = {}
    if (categoryId) {
      filter = 'category = {:cid}'
      params = { cid: categoryId }
    }
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.categoryFollowUpTemplates,
      filter,
      'sort_order',
      200,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(lib.categoryTemplateToPlain(rows[i]))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/category-templates',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)
    const raw = readRawBody(e)
    const categoryId = h.trimStr(raw.category_id || raw.category)
    const templateId = h.trimStr(raw.task_template_id || raw.task_template)
    if (!categoryId || !templateId) throw new BadRequestError('請提供類別與範本')

    e.app.findRecordById(h.COLLECTIONS.applicationCategories, categoryId)
    e.app.findRecordById(h.COLLECTIONS.followUpTaskTemplates, templateId)

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.categoryFollowUpTemplates)
    const record = new Record(col)
    record.set('category', categoryId)
    record.set('task_template', templateId)
    record.set('required', !!raw.required)
    record.set('requires_review_override', !!raw.requires_review_override)
    if (raw.due_rule != null) record.set('due_rule', raw.due_rule)
    record.set('sort_order', Number(raw.sort_order) || 0)
    record.set('active', raw.active !== false)
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'FOLLOW_UP_CATEGORY_TEMPLATE_ASSIGNED',
        target_type: 'had_category_follow_up_templates',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { assignment: lib.categoryTemplateToPlain(record) })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/category-templates/{id}',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    h.requireAdminAuth(e)
    const id = e.request.pathValue('id')
    const record = e.app.findRecordById(h.COLLECTIONS.categoryFollowUpTemplates, id)
    const raw = readRawBody(e)
    if (raw.required != null) record.set('required', !!raw.required)
    if (raw.requires_review_override != null) {
      record.set('requires_review_override', !!raw.requires_review_override)
    }
    if (raw.due_rule != null) record.set('due_rule', raw.due_rule)
    if (raw.sort_order != null) record.set('sort_order', Number(raw.sort_order) || 0)
    if (raw.active != null) record.set('active', !!raw.active)
    e.app.save(record)
    return e.json(200, { assignment: lib.categoryTemplateToPlain(record) })
  },
  $apis.requireAuth('had_staff_users'),
)

// ---------------------------------------------------------------------------
// Student: tasks
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/had/follow-up/tasks',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const student = requireStudent(e, h)
    var applicationId = ''
    try {
      applicationId = (e.request.url.query().get('application_id') || '').trim()
    } catch (_) {}
    var filter = 'student = {:sid}'
    var params = { sid: student.id }
    if (applicationId) {
      filter += ' && application = {:aid}'
      params.aid = applicationId
    }
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpTasks,
      filter,
      'due_at',
      200,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) {
      items.push(lib.taskToPlain(rows[i], { includeInternal: false }))
    }
    return e.json(200, { items: items })
  },
  $apis.requireAuth('had_students'),
)

routerAdd(
  'GET',
  '/api/had/follow-up/tasks/{id}',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const student = requireStudent(e, h)
    const id = e.request.pathValue('id')
    const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, id)
    if (task.getString('student') !== student.id) throw new ForbiddenError('無權限')

    const subs = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpSubmissions,
      'task = {:tid}',
      '-submission_version',
      20,
      0,
      { tid: id },
    )
    const submissionItems = []
    for (var i = 0; i < subs.length; i++) {
      submissionItems.push(lib.submissionToPlain(subs[i]))
    }
    const atts = listTaskAttachments(e.app, h, id)
    const attachmentItems = []
    for (var a = 0; a < atts.length; a++) attachmentItems.push(attachmentBrief(atts[a]))

    const reviews = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpReviews,
      'task = {:tid}',
      '-created',
      20,
      0,
      { tid: id },
    )
    const reviewItems = []
    for (var r = 0; r < reviews.length; r++) {
      var plain = lib.reviewToPlain(reviews[r])
      delete plain.internal_note
      reviewItems.push(plain)
    }

    return e.json(200, {
      task: lib.taskToPlain(task, { includeInternal: false }),
      submissions: submissionItems,
      attachments: attachmentItems,
      reviews: reviewItems,
    })
  },
  $apis.requireAuth('had_students'),
)

routerAdd(
  'POST',
  '/api/had/follow-up/tasks/{id}/submit',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const meta = h.requestMeta(e)
    const student = requireStudent(e, h)
    const id = e.request.pathValue('id')
    const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, id)
    if (task.getString('student') !== student.id) throw new ForbiddenError('無權限')

    const status = task.getString('status')
    const canSubmit =
      status === 'pending' ||
      status === 'supplement_required' ||
      status === 'rejected' ||
      (status === 'submitted' && task.getBool('allow_resubmit')) ||
      (status === 'under_review' && task.getBool('allow_resubmit'))
    if (!canSubmit) throw new BadRequestError('目前狀態不可繳交')

    const raw = readRawBody(e)
    const data = new DynamicModel({ text_content: '', attachment_ids: [] })
    e.bindBody(data)
    const textContent = h.trimStr(data.text_content || raw.text_content)
    const attachmentIds = parseIdList(
      raw.attachment_ids != null ? raw.attachment_ids : data.attachment_ids,
    )

    const taskType = task.getString('task_type')
    if ((taskType === 'text' || taskType === 'file_and_text') && !textContent) {
      throw new BadRequestError('請填寫文字內容')
    }
    if ((taskType === 'file_upload' || taskType === 'file_and_text') && !attachmentIds.length) {
      throw new BadRequestError('請上傳至少一個附件')
    }

    // Validate attachments ownership + link to task
    for (var i = 0; i < attachmentIds.length; i++) {
      const att = e.app.findRecordById(h.COLLECTIONS.attachments, attachmentIds[i])
      if (att.getString('owner_student') !== student.id) throw new ForbiddenError('附件無權限')
      if (att.getString('status') !== 'active') throw new BadRequestError('附件狀態不可用')
      if (!att.getString('follow_up_task')) {
        att.set('follow_up_task', id)
        att.set('attachment_type', 'follow_up')
        e.app.save(att)
      } else if (att.getString('follow_up_task') !== id) {
        throw new BadRequestError('附件已綁定其他任務')
      }
    }

    // Supersede previous submissions
    const prev = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpSubmissions,
      'task = {:tid} && status = "submitted"',
      '-submission_version',
      50,
      0,
      { tid: id },
    )
    var nextVersion = 1
    if (prev.length) {
      nextVersion = (prev[0].getInt('submission_version') || 0) + 1
      for (var p = 0; p < prev.length; p++) {
        prev[p].set('status', 'superseded')
        e.app.save(prev[p])
      }
    }

    const overdue = lib.isTaskOverdue(task, Date.now())
    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.followUpSubmissions)
    const sub = new Record(col)
    sub.set('task', id)
    sub.set('student', student.id)
    sub.set('submission_version', nextVersion)
    if (textContent) sub.set('text_content', textContent)
    sub.set('status', 'submitted')
    sub.set('submitted_at', h.nowIso())
    sub.set('is_overdue_at_submit', overdue)
    e.app.save(sub)

    if (task.getBool('requires_review')) {
      task.set('status', 'under_review')
    } else {
      task.set('status', 'approved')
      task.set('completed_at', h.nowIso())
    }
    task.set('allow_resubmit', false)
    e.app.save(task)

    try {
      const notif = require(`${__hooks}/had_notification_service.js`)
      if (task.getString('status') === 'approved' || !task.getBool('requires_review')) {
        notif.cancelRemindersForTask(e.app, h, id)
      } else if (task.getString('status') === 'under_review') {
        notif.cancelRemindersForTask(e.app, h, id)
      }
    } catch (_) {}

    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'FOLLOW_UP_TASK_SUBMITTED',
        target_type: 'had_follow_up_tasks',
        target_id: id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          submission_id: sub.id,
          requires_review: task.getBool('requires_review'),
          is_overdue_at_submit: overdue,
        },
      })
    } catch (_) {}

    return e.json(200, {
      task: lib.taskToPlain(task, { includeInternal: false }),
      submission: lib.submissionToPlain(sub),
      message: task.getBool('requires_review') ? '已繳交，待審核' : '已繳交並自動核准',
    })
  },
  $apis.requireAuth('had_students'),
)

// ---------------------------------------------------------------------------
// Staff: tasks
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/had/admin/follow-up/tasks',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const staff = h.requireStaffAuth(e)

    var applicationId = ''
    var statusFilter = ''
    try {
      applicationId = (e.request.url.query().get('application_id') || '').trim()
      statusFilter = (e.request.url.query().get('status') || '').trim()
    } catch (_) {}

    var filterParts = []
    var params = {}
    if (applicationId) {
      workflow.assertStaffCanAccessApplication(e.app, h, staff, applicationId)
      filterParts.push('application = {:aid}')
      params.aid = applicationId
    }
    if (statusFilter) {
      filterParts.push('status = {:st}')
      params.st = statusFilter
    }
    var filter = filterParts.length ? filterParts.join(' && ') : 'id != ""'

    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpTasks,
      filter,
      '-updated',
      200,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) {
      if (!staff.getBool('is_admin')) {
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
      items.push(lib.taskToPlain(rows[i], { includeInternal: true }))
    }
    return e.json(200, { items: items })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'GET',
  '/api/had/admin/follow-up/tasks/{id}',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, id)
    workflow.assertStaffCanAccessApplication(e.app, h, staff, task.getString('application'))

    const subs = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpSubmissions,
      'task = {:tid}',
      '-submission_version',
      50,
      0,
      { tid: id },
    )
    const submissionItems = []
    for (var i = 0; i < subs.length; i++) submissionItems.push(lib.submissionToPlain(subs[i]))

    const reviews = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpReviews,
      'task = {:tid}',
      '-created',
      50,
      0,
      { tid: id },
    )
    const reviewItems = []
    for (var r = 0; r < reviews.length; r++) reviewItems.push(lib.reviewToPlain(reviews[r]))

    const atts = listTaskAttachments(e.app, h, id)
    const attachmentItems = []
    for (var a = 0; a < atts.length; a++) attachmentItems.push(attachmentBrief(atts[a]))

    return e.json(200, {
      task: lib.taskToPlain(task, { includeInternal: true }),
      submissions: submissionItems,
      reviews: reviewItems,
      attachments: attachmentItems,
    })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/tasks/{id}/review',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, id)
    workflow.assertStaffCanAccessApplication(e.app, h, staff, task.getString('application'))

    const raw = readRawBody(e)
    const decision = h.trimStr(raw.decision)
    if (['approved', 'supplement_required', 'rejected'].indexOf(decision) < 0) {
      throw new BadRequestError('decision 無效')
    }
    if (task.getString('status') !== 'under_review' && task.getString('status') !== 'submitted') {
      throw new BadRequestError('目前狀態不可審核')
    }

    const latest = e.app.findRecordsByFilter(
      h.COLLECTIONS.followUpSubmissions,
      'task = {:tid} && status = "submitted"',
      '-submission_version',
      1,
      0,
      { tid: id },
    )
    if (!latest.length) throw new BadRequestError('找不到繳交紀錄')

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.followUpReviews)
    const review = new Record(col)
    review.set('task', id)
    review.set('submission', latest[0].id)
    review.set('reviewer', staff.id)
    review.set('decision', decision)
    if (raw.internal_note) review.set('internal_note', h.trimStr(raw.internal_note))
    if (raw.student_message) review.set('student_message', h.trimStr(raw.student_message))
    const allowResubmit = raw.allow_resubmit === true
    review.set('allow_resubmit', allowResubmit)
    e.app.save(review)

    task.set('status', decision)
    if (decision === 'approved') {
      task.set('completed_at', h.nowIso())
      task.set('allow_resubmit', false)
    } else {
      task.set('allow_resubmit', allowResubmit || decision === 'supplement_required')
      if (decision === 'supplement_required') {
        task.set('status', 'supplement_required')
      }
    }
    e.app.save(task)

    try {
      const notif = require(`${__hooks}/had_notification_service.js`)
      var appNumber = ''
      try {
        appNumber = e.app
          .findRecordById(h.COLLECTIONS.applications, task.getString('application'))
          .getString('application_number')
      } catch (_) {}
      var baseVars = {
        student_name: notif.loadStudentName(e.app, h, task.getString('student')),
        application_number: appNumber,
        task_name: task.getString('name'),
        student_message: h.trimStr(raw.student_message),
      }
      if (decision === 'approved') {
        notif.cancelRemindersForTask(e.app, h, id)
        notif.safeEmitNotificationEvent(e.app, h, 'FOLLOW_UP_APPROVED', {
          studentId: task.getString('student'),
          applicationId: task.getString('application'),
          taskId: id,
          idempotencyKey: 'follow_up_approved:' + id + ':' + review.id,
          actionUrl: '/student/follow-up/' + id,
          variables: baseVars,
        })
      } else if (decision === 'supplement_required') {
        notif.safeEmitNotificationEvent(e.app, h, 'FOLLOW_UP_SUPPLEMENT', {
          studentId: task.getString('student'),
          applicationId: task.getString('application'),
          taskId: id,
          idempotencyKey: 'follow_up_supplement:' + id + ':' + review.id,
          actionUrl: '/student/follow-up/' + id,
          variables: baseVars,
        })
      }
    } catch (_) {}

    try {
      h.writeAudit(e.app, {
        actor_type: actorTypeOfStaff(staff),
        actor_staff: staff.id,
        action: 'FOLLOW_UP_TASK_REVIEWED',
        target_type: 'had_follow_up_tasks',
        target_id: id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { decision: decision },
      })
    } catch (_) {}

    return e.json(200, {
      task: lib.taskToPlain(task, { includeInternal: true }),
      review: lib.reviewToPlain(review),
      message: '審核完成',
    })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/tasks/{id}/waive',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, id)
    workflow.assertStaffCanAccessApplication(e.app, h, staff, task.getString('application'))

    const raw = readRawBody(e)
    const reason = h.trimStr(raw.waive_reason || raw.reason)
    if (!reason) throw new BadRequestError('請填寫豁免原因')

    task.set('status', 'waived')
    task.set('waive_reason', reason)
    task.set('completed_at', h.nowIso())
    e.app.save(task)

    try {
      const notif = require(`${__hooks}/had_notification_service.js`)
      notif.cancelRemindersForTask(e.app, h, id)
    } catch (_) {}

    try {
      h.writeAudit(e.app, {
        actor_type: actorTypeOfStaff(staff),
        actor_staff: staff.id,
        action: 'FOLLOW_UP_TASK_WAIVED',
        target_type: 'had_follow_up_tasks',
        target_id: id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason_present: true },
      })
    } catch (_) {}

    return e.json(200, {
      task: lib.taskToPlain(task, { includeInternal: true }),
      message: '已豁免',
    })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/tasks/{id}/due-at',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, id)
    workflow.assertStaffCanAccessApplication(e.app, h, staff, task.getString('application'))

    const raw = readRawBody(e)
    const dueAt = h.trimStr(raw.due_at)
    if (!dueAt) throw new BadRequestError('請提供 due_at')
    task.set('due_at', dueAt)
    e.app.save(task)
    try {
      const notif = require(`${__hooks}/had_notification_service.js`)
      // Cancel pending reminders; next schedule run will recreate with new due_at
      notif.cancelRemindersForTask(e.app, h, id)
    } catch (_) {}
    // Do NOT permanently overwrite status to overdue — is_overdue is derived in API
    return e.json(200, {
      task: lib.taskToPlain(task, { includeInternal: true }),
      message: '截止日期已更新',
    })
  },
  $apis.requireAuth('had_staff_users'),
)

routerAdd(
  'POST',
  '/api/had/admin/follow-up/tasks',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const raw = readRawBody(e)

    const applicationId = h.trimStr(raw.application_id)
    if (!applicationId) throw new BadRequestError('缺少 application_id')
    workflow.assertStaffCanAccessApplication(e.app, h, staff, applicationId)
    const application = e.app.findRecordById(h.COLLECTIONS.applications, applicationId)

    const name = h.trimStr(raw.name)
    const taskType = h.trimStr(raw.task_type) || 'other'
    if (!name) throw new BadRequestError('請填寫任務名稱')

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.followUpTasks)
    const record = new Record(col)
    record.set('application', applicationId)
    record.set('student', application.getString('student'))
    if (raw.template_id) record.set('template', h.trimStr(raw.template_id))
    record.set('name', name)
    record.set('task_type', taskType)
    if (raw.description) record.set('description', h.trimStr(raw.description))
    record.set('required', raw.required === true)
    record.set('requires_review', raw.requires_review !== false)
    if (raw.due_at) record.set('due_at', h.trimStr(raw.due_at))
    record.set('status', 'pending')
    record.set('created_by', staff.id)
    if (raw.student_instructions) {
      record.set('student_instructions', h.trimStr(raw.student_instructions))
    }
    if (raw.allowed_extensions) record.set('allowed_extensions', raw.allowed_extensions)
    if (raw.max_files != null) record.set('max_files', Number(raw.max_files) || 0)
    if (raw.max_file_size_mb != null) {
      record.set('max_file_size_mb', Number(raw.max_file_size_mb) || 0)
    }
    if (raw.event_start_at) record.set('event_start_at', h.trimStr(raw.event_start_at))
    if (raw.event_end_at) record.set('event_end_at', h.trimStr(raw.event_end_at))
    if (raw.event_location) record.set('event_location', h.trimStr(raw.event_location))
    if (raw.event_note) record.set('event_note', h.trimStr(raw.event_note))
    record.set('allow_resubmit', false)
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: actorTypeOfStaff(staff),
        actor_staff: staff.id,
        action: 'FOLLOW_UP_TASK_CREATED',
        target_type: 'had_follow_up_tasks',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    try {
      const notif = require(`${__hooks}/had_notification_service.js`)
      notif.safeEmitNotificationEvent(e.app, h, 'FOLLOW_UP_CREATED', {
        studentId: application.getString('student'),
        applicationId: applicationId,
        taskId: record.id,
        idempotencyKey: 'follow_up_created:' + record.id,
        actionUrl: '/student/follow-up/' + record.id,
        variables: {
          student_name: notif.loadStudentName(e.app, h, application.getString('student')),
          application_number: application.getString('application_number'),
          category_name: '',
          task_name: record.getString('name'),
          task_description:
            record.getString('description') || record.getString('student_instructions') || '',
          due_at: record.get('due_at') ? String(record.get('due_at')) : '',
        },
      })
    } catch (_) {}

    return e.json(200, {
      task: lib.taskToPlain(record, { includeInternal: true }),
      message: '已建立追蹤任務',
    })
  },
  $apis.requireAuth('had_staff_users'),
)

// Re-seed helper endpoint (admin) — safe idempotent call
routerAdd(
  'POST',
  '/api/had/admin/applications/{id}/ensure-follow-up-tasks',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const lib = require(`${__hooks}/had_follow_up_lib.js`)
    const workflow = require(`${__hooks}/had_application_workflow.js`)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    workflow.assertStaffCanAccessApplication(e.app, h, staff, id)
    // Allow force re-check: if already seeded, still return existing
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    var result
    if (application.getBool('follow_up_tasks_seeded')) {
      const existing = e.app.findRecordsByFilter(
        h.COLLECTIONS.followUpTasks,
        'application = {:aid}',
        'created',
        200,
        0,
        { aid: id },
      )
      result = { seeded: true, created: 0, tasks: existing }
    } else {
      result = lib.ensureFollowUpTasksForApplication(e.app, h, id)
    }
    const items = []
    for (var i = 0; i < result.tasks.length; i++) {
      items.push(lib.taskToPlain(result.tasks[i], { includeInternal: true }))
    }
    return e.json(200, { seeded: result.seeded, created: result.created, items: items })
  },
  $apis.requireAuth('had_staff_users'),
)
