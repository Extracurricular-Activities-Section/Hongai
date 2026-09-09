/**
 * Follow-up task helpers (requireable; not auto-loaded as routes).
 */

function parseJsonMaybe(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch (_) {
    return null
  }
}

function addDaysIso(days) {
  var n = Number(days)
  if (isNaN(n)) n = 0
  return new Date(Date.now() + n * 86400000).toISOString()
}

function resolveDueAt(template, assignment) {
  var offset = null
  var dueRule = null
  if (assignment) {
    dueRule = parseJsonMaybe(assignment.get('due_rule'))
  }
  if (dueRule && dueRule.offset_days != null) {
    offset = Number(dueRule.offset_days)
  } else if (template && template.get('default_due_offset_days') != null) {
    offset = Number(template.get('default_due_offset_days'))
  }
  if (offset == null || isNaN(offset)) return null
  return addDaysIso(offset)
}

function resolveRequiresReview(template, assignment) {
  var requiresReview = template ? !!template.getBool('requires_review') : false
  if (!assignment) return requiresReview
  // bool override: if assignment explicitly sets requires_review_override=true → force true
  // if due_rule.requires_review is boolean, prefer that
  var dueRule = parseJsonMaybe(assignment.get('due_rule'))
  if (dueRule && typeof dueRule.requires_review === 'boolean') {
    return dueRule.requires_review
  }
  if (assignment.getBool('requires_review_override')) {
    return true
  }
  return requiresReview
}

function resolveRequired(template, assignment) {
  if (assignment && assignment.get('required') != null) {
    return !!assignment.getBool('required')
  }
  return template ? !!template.getBool('required') : false
}

function isTaskOverdue(taskRecord, nowMs) {
  var status = taskRecord.getString('status')
  if (status === 'approved' || status === 'waived' || status === 'rejected') return false
  var due = taskRecord.get('due_at')
  if (!due) return false
  var dueMs = NaN
  try {
    if (due.unixTime) dueMs = due.unixTime() * 1000
    else if (due.time) dueMs = due.time().unix() * 1000
    else dueMs = Date.parse(String(due))
  } catch (_) {
    dueMs = Date.parse(String(due))
  }
  if (isNaN(dueMs)) return false
  return nowMs > dueMs
}

function taskToPlain(record, options) {
  options = options || {}
  var nowMs = options.nowMs != null ? options.nowMs : Date.now()
  var plain = {
    id: record.id,
    application: record.getString('application'),
    student: record.getString('student'),
    template: record.getString('template') || null,
    name: record.getString('name'),
    task_type: record.getString('task_type'),
    description: record.getString('description') || null,
    required: record.getBool('required'),
    requires_review: record.getBool('requires_review'),
    due_at: record.get('due_at') ? String(record.get('due_at')) : null,
    status: record.getString('status'),
    completed_at: record.get('completed_at') ? String(record.get('completed_at')) : null,
    created_by: record.getString('created_by') || null,
    student_instructions: record.getString('student_instructions') || null,
    event_start_at: record.get('event_start_at') ? String(record.get('event_start_at')) : null,
    event_end_at: record.get('event_end_at') ? String(record.get('event_end_at')) : null,
    event_location: record.getString('event_location') || null,
    event_note: record.getString('event_note') || null,
    allow_resubmit: record.getBool('allow_resubmit'),
    waive_reason: options.includeInternal ? record.getString('waive_reason') || null : undefined,
    max_files: record.get('max_files') != null ? Number(record.get('max_files')) : null,
    max_file_size_mb: record.get('max_file_size_mb') != null ? Number(record.get('max_file_size_mb')) : null,
    allowed_extensions: parseJsonMaybe(record.get('allowed_extensions')),
    is_overdue: isTaskOverdue(record, nowMs),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
  if (!options.includeInternal) delete plain.waive_reason
  return plain
}

function templateToPlain(record) {
  return {
    id: record.id,
    name: record.getString('name'),
    code: record.getString('code'),
    description: record.getString('description') || null,
    task_type: record.getString('task_type'),
    allowed_extensions: parseJsonMaybe(record.get('allowed_extensions')),
    max_files: record.get('max_files') != null ? Number(record.get('max_files')) : null,
    max_file_size_mb: record.get('max_file_size_mb') != null ? Number(record.get('max_file_size_mb')) : null,
    requires_review: record.getBool('requires_review'),
    required: record.getBool('required'),
    default_due_offset_days:
      record.get('default_due_offset_days') != null
        ? Number(record.get('default_due_offset_days'))
        : null,
    active: record.getBool('active'),
    student_instructions: record.getString('student_instructions') || null,
    review_instructions: record.getString('review_instructions') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function categoryTemplateToPlain(record) {
  return {
    id: record.id,
    category: record.getString('category'),
    task_template: record.getString('task_template'),
    required: record.getBool('required'),
    requires_review_override: record.getBool('requires_review_override'),
    due_rule: parseJsonMaybe(record.get('due_rule')),
    sort_order: record.getInt('sort_order') || 0,
    active: record.getBool('active'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function submissionToPlain(record) {
  return {
    id: record.id,
    task: record.getString('task'),
    student: record.getString('student'),
    submission_version: record.getInt('submission_version'),
    text_content: record.getString('text_content') || null,
    status: record.getString('status'),
    submitted_at: record.get('submitted_at') ? String(record.get('submitted_at')) : null,
    is_overdue_at_submit: record.getBool('is_overdue_at_submit'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function reviewToPlain(record) {
  return {
    id: record.id,
    task: record.getString('task'),
    submission: record.getString('submission'),
    reviewer: record.getString('reviewer'),
    decision: record.getString('decision'),
    internal_note: record.getString('internal_note') || null,
    student_message: record.getString('student_message') || null,
    allow_resubmit: record.getBool('allow_resubmit'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function createTaskFromTemplate(app, h, application, template, assignment, createdByStaffId) {
  var existing = []
  if (template) {
    existing = app.findRecordsByFilter(
      h.COLLECTIONS.followUpTasks,
      'application = {:aid} && template = {:tid}',
      '-created',
      1,
      0,
      { aid: application.id, tid: template.id },
    )
    if (existing.length) return existing[0]
  }

  var col = app.findCollectionByNameOrId(h.COLLECTIONS.followUpTasks)
  var record = new Record(col)
  record.set('application', application.id)
  record.set('student', application.getString('student'))
  if (template) record.set('template', template.id)
  record.set('name', template ? template.getString('name') : '追蹤任務')
  record.set(
    'task_type',
    template ? template.getString('task_type') : 'other',
  )
  if (template && template.getString('description')) {
    record.set('description', template.getString('description'))
  }
  record.set('required', resolveRequired(template, assignment))
  record.set('requires_review', resolveRequiresReview(template, assignment))
  var dueAt = resolveDueAt(template, assignment)
  if (dueAt) record.set('due_at', dueAt)
  record.set('status', 'pending')
  if (createdByStaffId) record.set('created_by', createdByStaffId)
  if (template) {
    var allowed = parseJsonMaybe(template.get('allowed_extensions'))
    if (allowed) record.set('allowed_extensions', allowed)
    if (template.get('max_files') != null) record.set('max_files', template.get('max_files'))
    if (template.get('max_file_size_mb') != null) {
      record.set('max_file_size_mb', template.get('max_file_size_mb'))
    }
    if (template.getString('student_instructions')) {
      record.set('student_instructions', template.getString('student_instructions'))
    }
  }
  record.set('allow_resubmit', false)
  app.save(record)
  return record
}

/**
 * Idempotent: respects follow_up_tasks_seeded + unique application+template.
 */
function ensureFollowUpTasksForApplication(app, h, applicationId) {
  var application = app.findRecordById(h.COLLECTIONS.applications, applicationId)
  if (application.getBool('follow_up_tasks_seeded')) {
    return { seeded: true, created: 0, tasks: [] }
  }

  var categoryId = application.getString('category')
  var assignments = app.findRecordsByFilter(
    h.COLLECTIONS.categoryFollowUpTemplates,
    'category = {:cid} && active = true',
    'sort_order',
    100,
    0,
    { cid: categoryId },
  )

  var created = 0
  var tasks = []
  for (var i = 0; i < assignments.length; i++) {
    var assign = assignments[i]
    var templateId = assign.getString('task_template')
    var template = null
    try {
      template = app.findRecordById(h.COLLECTIONS.followUpTaskTemplates, templateId)
    } catch (_) {
      continue
    }
    if (!template.getBool('active')) continue
    var before = app.findRecordsByFilter(
      h.COLLECTIONS.followUpTasks,
      'application = {:aid} && template = {:tid}',
      '-created',
      1,
      0,
      { aid: applicationId, tid: template.id },
    )
    var task = createTaskFromTemplate(app, h, application, template, assign, null)
    if (!before.length) {
      created++
      try {
        var notif = require(`${__hooks}/had_notification_service.js`)
        var catName = ''
        try {
          catName = app
            .findRecordById(h.COLLECTIONS.applicationCategories, application.getString('category'))
            .getString('name')
        } catch (_) {}
        notif.safeEmitNotificationEvent(app, h, 'FOLLOW_UP_CREATED', {
          studentId: application.getString('student'),
          applicationId: applicationId,
          taskId: task.id,
          idempotencyKey: 'follow_up_created:' + task.id,
          actionUrl: '/student/follow-up/' + task.id,
          variables: {
            student_name: notif.loadStudentName(app, h, application.getString('student')),
            category_name: catName,
            application_number: application.getString('application_number'),
            task_name: task.getString('name'),
            task_description: task.getString('description') || task.getString('student_instructions') || '',
            due_at: task.get('due_at') ? String(task.get('due_at')) : '',
          },
        })
      } catch (_) {}
    }
    tasks.push(task)
  }

  application.set('follow_up_tasks_seeded', true)
  app.save(application)

  return { seeded: true, created: created, tasks: tasks }
}

function requiredFollowUpIncomplete(app, h, applicationId) {
  var tasks = app.findRecordsByFilter(
    h.COLLECTIONS.followUpTasks,
    'application = {:aid} && required = true',
    'created',
    200,
    0,
    { aid: applicationId },
  )
  var incomplete = []
  for (var i = 0; i < tasks.length; i++) {
    var status = tasks[i].getString('status')
    if (status !== 'approved' && status !== 'waived') {
      incomplete.push(tasks[i])
    }
  }
  return incomplete
}

function assertRequiredFollowUpsComplete(app, h, applicationId) {
  var incomplete = requiredFollowUpIncomplete(app, h, applicationId)
  if (incomplete.length) {
    throw new BadRequestError(
      '尚有 ' + incomplete.length + ' 項必要追蹤任務未完成（需已核准或已豁免）後方可結案',
    )
  }
}

module.exports = {
  parseJsonMaybe: parseJsonMaybe,
  taskToPlain: taskToPlain,
  templateToPlain: templateToPlain,
  categoryTemplateToPlain: categoryTemplateToPlain,
  submissionToPlain: submissionToPlain,
  reviewToPlain: reviewToPlain,
  isTaskOverdue: isTaskOverdue,
  createTaskFromTemplate: createTaskFromTemplate,
  ensureFollowUpTasksForApplication: ensureFollowUpTasksForApplication,
  requiredFollowUpIncomplete: requiredFollowUpIncomplete,
  assertRequiredFollowUpsComplete: assertRequiredFollowUpsComplete,
}
