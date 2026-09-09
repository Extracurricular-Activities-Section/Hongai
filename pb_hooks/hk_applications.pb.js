/// <reference path="../pb_data/types.d.ts" />

/**
 * Phase 7: Applications workflow — student submit/list/detail + staff/admin backoffice.
 * Collections are deny-by-default; all access via these custom routes.
 */

function requireStudent(e, h) {
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }
  if (!e.auth.getBool('active')) throw new ForbiddenError('帳號未啟用')
  return e.auth
}

function parseJsonMaybe(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch (_) {
    return null
  }
}

function actorTypeOfStaff(staff) {
  return staff.getBool('is_admin') ? 'admin' : 'staff'
}

function queryInt(e, name, fallback) {
  var raw = ''
  try {
    raw = e.request.url.query().get(name) || ''
  } catch (_) {}
  var n = parseInt(String(raw), 10)
  return isNaN(n) ? fallback : n
}

function queryStr(e, name) {
  try {
    return (e.request.url.query().get(name) || '').trim()
  } catch (_) {
    return ''
  }
}

function padSerial6(n) {
  return ('000000' + String(n)).slice(-6)
}

function applicationToPlain(record, options) {
  options = options || {}
  var plain = {
    id: record.id,
    student: record.getString('student'),
    period: record.getString('period'),
    category: record.getString('category'),
    submission: record.getString('submission'),
    submission_version: record.getString('submission_version'),
    pdf_document: record.getString('pdf_document'),
    signed_document: record.getString('signed_document') || null,
    application_number: record.getString('application_number'),
    status: record.getString('status'),
    submitted_at: record.get('submitted_at') ? String(record.get('submitted_at')) : null,
    current_staff: record.getString('current_staff') || null,
    current_department: record.getString('current_department') || null,
    eligibility_status: record.getString('eligibility_status'),
    requested_amount: record.get('requested_amount') != null ? Number(record.get('requested_amount')) : null,
    approved_amount: record.get('approved_amount') != null ? Number(record.get('approved_amount')) : null,
    latest_reviewed_at: record.get('latest_reviewed_at')
      ? String(record.get('latest_reviewed_at'))
      : null,
    closed_at: record.get('closed_at') ? String(record.get('closed_at')) : null,
    edit_override_until: record.get('edit_override_until')
      ? String(record.get('edit_override_until'))
      : null,
    supplement_message: record.getString('supplement_message') || null,
    supplement_due_at: record.get('supplement_due_at')
      ? String(record.get('supplement_due_at'))
      : null,
    return_reason: record.getString('return_reason') || null,
    reject_reason: record.getString('reject_reason') || null,
    notification_pending: record.getBool('notification_pending'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
  if (options.category_name) plain.category_name = options.category_name
  if (options.category_code) plain.category_code = options.category_code
  if (options.period_name) plain.period_name = options.period_name
  if (options.status_label) plain.status_label = options.status_label
  if (options.eligibility_label) plain.eligibility_label = options.eligibility_label
  if (options.student_no) plain.student_no = options.student_no
  if (options.student_name) plain.student_name = options.student_name
  if (options.identity_masked) plain.identity_masked = options.identity_masked
  if (options.identity_number) plain.identity_number = options.identity_number
  if (options.department_name) plain.department_name = options.department_name
  if (options.omit_internal) {
    // student-safe: keep reject/return/supplement messages, drop nothing else here
  }
  return plain
}

function writeStatusHistory(app, h, payload) {
  var col = app.findCollectionByNameOrId(h.COLLECTIONS.applicationStatusHistory)
  var record = new Record(col)
  record.set('application', payload.application)
  if (payload.from_status) record.set('from_status', payload.from_status)
  record.set('to_status', payload.to_status)
  record.set('changed_by_type', payload.changed_by_type || 'system')
  if (payload.changed_by_student) record.set('changed_by_student', payload.changed_by_student)
  if (payload.changed_by_staff) record.set('changed_by_staff', payload.changed_by_staff)
  if (payload.reason) record.set('reason', payload.reason)
  if (payload.metadata) record.set('metadata', payload.metadata)
  app.save(record)
  return record
}

function generateApplicationNumber(app, h, period, categoryCode) {
  var funding = require(`${__hooks}/hk_funding_config.js`)
  var year = period.getInt('academic_year')
  var sem = period.getString('semester') || '1'
  var short = funding.getCategoryShortCode(categoryCode)
  var prefix = 'HAD-A-' + String(year) + String(sem) + '-' + short + '-'

  var max = 0
  try {
    var records = app.findRecordsByFilter(
      h.COLLECTIONS.applications,
      'application_number ~ {:prefix}',
      '-created',
      500,
      0,
      { prefix: prefix },
    )
    for (var i = 0; i < records.length; i++) {
      var num = records[i].getString('application_number')
      var part = num.slice(prefix.length)
      var n = parseInt(part, 10)
      if (!isNaN(n) && n > max) max = n
    }
  } catch (_) {}

  for (var attempt = 0; attempt < 25; attempt++) {
    var candidate = prefix + padSerial6(max + 1 + attempt)
    try {
      app.findFirstRecordByFilter(
        h.COLLECTIONS.applications,
        'application_number = {:num}',
        { num: candidate },
      )
    } catch (_) {
      return candidate
    }
  }
  throw new BadRequestError('無法產生唯一申請編號，請稍後再試')
}

function findValidPdf(app, h, submissionId) {
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.pdfDocuments,
    'submission = {:sid} && status = "valid"',
    '-document_version',
    1,
    0,
    { sid: submissionId },
  )
  if (!rows.length) return null
  return rows[0]
}

function findLatestCompletedVersion(app, h, submissionId) {
  var versions = app.findRecordsByFilter(
    h.COLLECTIONS.formSubmissionVersions,
    'submission = {:sid} && reason = "completed"',
    '-version_number',
    20,
    0,
    { sid: submissionId },
  )
  if (versions.length) return versions[0]
  var any = app.findRecordsByFilter(
    h.COLLECTIONS.formSubmissionVersions,
    'submission = {:sid}',
    '-version_number',
    1,
    0,
    { sid: submissionId },
  )
  return any.length ? any[0] : null
}

function findExistingApplication(app, h, studentId, periodId, categoryId) {
  try {
    return app.findFirstRecordByFilter(
      h.COLLECTIONS.applications,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: studentId, pid: periodId, cid: categoryId },
    )
  } catch (_) {
    return null
  }
}

function loadSnapshot(versionRecord) {
  return parseJsonMaybe(versionRecord.get('snapshot'))
}

function validateSnapshotFileAttachments(app, h, studentId, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return
  var schema = snapshot.schema
  var answers = snapshot.answers || {}
  if (!schema || !Array.isArray(schema.sections)) return
  for (var s = 0; s < schema.sections.length; s++) {
    var fields = schema.sections[s].fields || []
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f]
      if (!field || field.field_type !== 'file') continue
      var value = answers[field.code]
      if (value == null || value === '') continue
      if (!Array.isArray(value)) {
        throw new BadRequestError('檔案欄位「' + (field.label || field.code) + '」格式無效')
      }
      for (var i = 0; i < value.length; i++) {
        var attId = String(value[i] || '').trim()
        if (!attId) throw new BadRequestError('檔案欄位含空白附件 ID')
        var att = app.findRecordById(h.COLLECTIONS.attachments, attId)
        if (att.getString('owner_student') !== studentId) {
          throw new ForbiddenError('附件不屬於目前學生')
        }
        if (att.getString('status') !== 'active') {
          throw new BadRequestError('附件「' + att.getString('original_filename') + '」不可用')
        }
      }
    }
  }
}

function findActiveSignedDocument(app, h, applicationId) {
  if (!applicationId) return null
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.signedDocuments,
    'application = {:aid} && status = "active"',
    '-version_number',
    1,
    0,
    { aid: applicationId },
  )
  return rows.length ? rows[0] : null
}

function findSignedAttachmentForSubmission(app, h, studentId, submissionId) {
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.attachments,
    'owner_student = {:sid} && submission = {:sub} && attachment_type = "signed_document" && status = "active"',
    '-created',
    5,
    0,
    { sid: studentId, sub: submissionId },
  )
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].getString('extension') === 'pdf') return rows[i]
  }
  return null
}

function createSignedDocumentFromAttachment(app, h, application, pdf, attachment, studentNote) {
  var applicationId = application.id
  var existing = app.findRecordsByFilter(
    h.COLLECTIONS.signedDocuments,
    'application = {:aid}',
    '-version_number',
    1,
    0,
    { aid: applicationId },
  )
  var nextVersion = existing.length ? (existing[0].getInt('version_number') || 0) + 1 : 1

  var previous = app.findRecordsByFilter(
    h.COLLECTIONS.signedDocuments,
    'application = {:aid} && status = "active"',
    '-version_number',
    50,
    0,
    { aid: applicationId },
  )
  for (var i = 0; i < previous.length; i++) {
    previous[i].set('status', 'superseded')
    app.save(previous[i])
  }

  if (!attachment.getString('application')) {
    attachment.set('application', applicationId)
    app.save(attachment)
  }

  var col = app.findCollectionByNameOrId(h.COLLECTIONS.signedDocuments)
  var record = new Record(col)
  record.set('application', applicationId)
  record.set('student', application.getString('student'))
  record.set('source_pdf', pdf.id)
  record.set('attachment', attachment.id)
  record.set('version_number', nextVersion)
  record.set('status', 'active')
  record.set('uploaded_at', h.nowIso())
  if (studentNote) record.set('student_note', studentNote)
  app.save(record)
  return record
}

function isSupplementOverdue(requestRecord, nowMs) {
  var due = requestRecord.get('due_at')
  if (!due) {
    // fall back checked by caller via application.supplement_due_at
    return false
  }
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

function findPrimaryCategoryDepartment(app, h, categoryId) {
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.categoryDepartmentAssignments,
    'category = {:cid} && assignment_type = "primary" && active = true',
    '-created',
    1,
    0,
    { cid: categoryId },
  )
  return rows.length ? rows[0] : null
}

function enrichApplicationLabels(app, h, workflow, record) {
  var categoryName = ''
  var categoryCode = ''
  var periodName = ''
  try {
    var cat = app.findRecordById(h.COLLECTIONS.applicationCategories, record.getString('category'))
    categoryName = cat.getString('name')
    categoryCode = cat.getString('code')
  } catch (_) {}
  try {
    periodName = app
      .findRecordById(h.COLLECTIONS.applicationPeriods, record.getString('period'))
      .getString('name')
  } catch (_) {}
  return {
    category_name: categoryName,
    category_code: categoryCode,
    period_name: periodName,
    status_label: workflow.STATUS_LABELS[record.getString('status')] || record.getString('status'),
    eligibility_label:
      workflow.ELIGIBILITY_LABELS[record.getString('eligibility_status')] ||
      record.getString('eligibility_status'),
  }
}

function loadStudentIdentity(app, h, studentId, full) {
  var student = app.findRecordById(h.COLLECTIONS.students, studentId)
  var profile = null
  try {
    profile = app.findFirstRecordByFilter(h.COLLECTIONS.studentProfiles, 'student = {:sid}', {
      sid: studentId,
    })
  } catch (_) {}
  var out = {
    student_no: student.getString('student_no'),
    student_name: profile ? profile.getString('name') : '',
    department_name: profile ? profile.getString('department_name') : '',
    identity_masked: profile
      ? h.maskIdentityNumber(profile.getString('identity_number'))
      : '****',
  }
  if (full && profile) {
    out.identity_number = profile.getString('identity_number')
    out.email = profile.getString('email') || null
    out.phone = profile.getString('phone') || null
    out.grade = profile.getString('grade') || null
    out.gender = profile.getString('gender') || null
    out.profile = {
      name: profile.getString('name'),
      email: profile.getString('email') || null,
      phone: profile.getString('phone') || null,
      department_name: profile.getString('department_name') || null,
      grade: profile.getString('grade') || null,
      gender: profile.getString('gender') || null,
      program_type: profile.getString('program_type') || null,
      division: profile.getString('division') || null,
      line_id: profile.getString('line_id') || null,
      bank_account_registered: profile.getBool('bank_account_registered'),
      bank_account_note: profile.getString('bank_account_note') || null,
      identity_number: profile.getString('identity_number'),
      identity_masked: h.maskIdentityNumber(profile.getString('identity_number')),
    }
  }
  return out
}

function annualFundingSummary(app, h, studentId, academicYear) {
  var apps = app.findRecordsByFilter(
    h.COLLECTIONS.applications,
    'student = {:sid}',
    '-created',
    500,
    0,
    { sid: studentId },
  )
  var totalApproved = 0
  var totalRequested = 0
  var items = []
  for (var i = 0; i < apps.length; i++) {
    var application = apps[i]
    var period = null
    try {
      period = app.findRecordById(h.COLLECTIONS.applicationPeriods, application.getString('period'))
    } catch (_) {
      continue
    }
    if (period.getInt('academic_year') !== academicYear) continue
    totalRequested += Number(application.get('requested_amount') || 0)
    var decisions = app.findRecordsByFilter(
      h.COLLECTIONS.fundingDecisions,
      'application = {:aid} && status = "final"',
      '-decision_version',
      1,
      0,
      { aid: application.id },
    )
    var approved = 0
    if (decisions.length) {
      approved = Number(decisions[0].get('approved_total') || 0)
      totalApproved += approved
    } else if (application.get('approved_amount') != null) {
      approved = Number(application.get('approved_amount') || 0)
      totalApproved += approved
    }
    items.push({
      application_id: application.id,
      application_number: application.getString('application_number'),
      category: application.getString('category'),
      status: application.getString('status'),
      requested_amount: Number(application.get('requested_amount') || 0),
      approved_amount: approved,
    })
  }
  return {
    academic_year: academicYear,
    total_requested: totalRequested,
    total_approved: totalApproved,
    applications: items,
  }
}

function checkFundingRules(app, h, studentId, periodId, categoryId, proposedApprovedTotal) {
  var warnings = []
  var period = app.findRecordById(h.COLLECTIONS.applicationPeriods, periodId)
  var academicYear = period.getInt('academic_year')
  var summary = annualFundingSummary(app, h, studentId, academicYear)
  var projectedAnnual = summary.total_approved + Number(proposedApprovedTotal || 0)

  var rules = []
  try {
    rules = app.findRecordsByFilter(
      h.COLLECTIONS.fundingRules,
      'active = true',
      '-created',
      100,
      0,
    )
  } catch (_) {}

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i]
    var rulePeriod = rule.getString('period')
    if (rulePeriod && rulePeriod !== periodId) continue
    var ruleYear = rule.get('academic_year')
    if (ruleYear != null && Number(ruleYear) && Number(ruleYear) !== academicYear) continue

    var ruleType = rule.getString('rule_type')
    var limit = Number(rule.get('limit_amount') || 0)
    if (!limit) continue
    var warningOnly = rule.getBool('warning_only')

    if (ruleType === 'annual_total_limit') {
      if (projectedAnnual > limit) {
        var msg =
          '年度補助合計（含本次）' +
          projectedAnnual +
          ' 超過規則上限 ' +
          limit
        if (!warningOnly) {
          throw new BadRequestError(msg)
        }
        warnings.push({
          rule_type: ruleType,
          message: msg,
          limit_amount: limit,
          projected: projectedAnnual,
        })
      }
    } else if (ruleType === 'category_limit') {
      var ruleCat = rule.getString('category')
      if (ruleCat && ruleCat !== categoryId) continue
      if (Number(proposedApprovedTotal || 0) > limit) {
        var cmsg =
          '本案核定金額 ' + Number(proposedApprovedTotal || 0) + ' 超過類別上限 ' + limit
        if (!warningOnly) {
          throw new BadRequestError(cmsg)
        }
        warnings.push({
          rule_type: ruleType,
          message: cmsg,
          limit_amount: limit,
          projected: Number(proposedApprovedTotal || 0),
        })
      }
    }
  }
  return warnings
}

function createReviewRecord(app, h, payload) {
  var col = app.findCollectionByNameOrId(h.COLLECTIONS.applicationReviews)
  var record = new Record(col)
  record.set('application', payload.application)
  record.set('reviewer', payload.reviewer)
  record.set('review_type', payload.review_type)
  record.set('decision', payload.decision)
  if (payload.comment) record.set('comment', payload.comment)
  if (payload.internal_note) record.set('internal_note', payload.internal_note)
  if (payload.student_message) record.set('student_message', payload.student_message)
  app.save(record)
  return record
}

function reviewToPlain(record, includeInternal) {
  var plain = {
    id: record.id,
    application: record.getString('application'),
    reviewer: record.getString('reviewer'),
    review_type: record.getString('review_type'),
    decision: record.getString('decision'),
    comment: record.getString('comment') || null,
    student_message: record.getString('student_message') || null,
    created: String(record.get('created') || ''),
  }
  if (includeInternal) {
    plain.internal_note = record.getString('internal_note') || null
  }
  return plain
}

function reviewToStudentPlain(record) {
  return {
    decision: record.getString('decision'),
    student_message: record.getString('student_message') || null,
    created: String(record.get('created') || ''),
  }
}

function statusHistoryToPlain(record, studentSafe) {
  var plain = {
    id: record.id,
    from_status: record.getString('from_status') || null,
    to_status: record.getString('to_status'),
    changed_by_type: record.getString('changed_by_type'),
    reason: record.getString('reason') || null,
    created: String(record.get('created') || ''),
  }
  if (!studentSafe) {
    plain.changed_by_student = record.getString('changed_by_student') || null
    plain.changed_by_staff = record.getString('changed_by_staff') || null
    plain.metadata = parseJsonMaybe(record.get('metadata'))
  }
  return plain
}

function fundingDecisionToPlain(record, includeInternal) {
  var plain = {
    id: record.id,
    application: record.getString('application'),
    decision_version: record.getInt('decision_version'),
    requested_total: Number(record.get('requested_total') || 0),
    approved_total: Number(record.get('approved_total') || 0),
    decision_note: record.getString('decision_note') || null,
    student_message: record.getString('student_message') || null,
    change_reason: record.getString('change_reason') || null,
    decided_by: record.getString('decided_by'),
    decided_at: record.get('decided_at') ? String(record.get('decided_at')) : null,
    status: record.getString('status'),
    superseded_by: record.getString('superseded_by') || null,
    created: String(record.get('created') || ''),
  }
  if (includeInternal) {
    plain.internal_note = record.getString('internal_note') || null
  }
  return plain
}

function fundingItemToPlain(record) {
  return {
    id: record.id,
    funding_decision: record.getString('funding_decision'),
    item_code: record.getString('item_code'),
    item_label: record.getString('item_label'),
    requested_amount: Number(record.get('requested_amount') || 0),
    approved_amount: Number(record.get('approved_amount') || 0),
    note: record.getString('note') || null,
    sort_order: record.getInt('sort_order') || 0,
  }
}

function supplementToPlain(record) {
  return {
    id: record.id,
    application: record.getString('application'),
    requested_by: record.getString('requested_by'),
    message: record.getString('message'),
    due_at: record.get('due_at') ? String(record.get('due_at')) : null,
    status: record.getString('status'),
    submitted_at: record.get('submitted_at') ? String(record.get('submitted_at')) : null,
    resolved_at: record.get('resolved_at') ? String(record.get('resolved_at')) : null,
    student_reply: record.getString('student_reply') || null,
    created: String(record.get('created') || ''),
  }
}

function assignmentToPlain(record) {
  return {
    id: record.id,
    application: record.getString('application'),
    staff: record.getString('staff') || null,
    department: record.getString('department') || null,
    assignment_type: record.getString('assignment_type'),
    active: record.getBool('active'),
    assigned_by: record.getString('assigned_by') || null,
    created: String(record.get('created') || ''),
  }
}

function staffUserToPlain(record) {
  return {
    id: record.id,
    email: record.getString('email'),
    name: record.getString('name'),
    is_staff: record.getBool('is_staff'),
    is_admin: record.getBool('is_admin'),
    active: record.getBool('active'),
    phone: record.getString('phone') || null,
    job_title: record.getString('job_title') || null,
    last_login_at: record.get('last_login_at') ? String(record.get('last_login_at')) : null,
    notes: record.getString('notes') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function departmentToPlain(record) {
  return {
    id: record.id,
    name: record.getString('name'),
    code: record.getString('code'),
    active: record.getBool('active'),
    description: record.getString('description') || null,
    sort_order: record.getInt('sort_order') || 0,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function categoryDeptAssignmentToPlain(record) {
  return {
    id: record.id,
    category: record.getString('category'),
    department: record.getString('department'),
    assignment_type: record.getString('assignment_type'),
    active: record.getBool('active'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function pdfMetaToPlain(record) {
  return {
    id: record.id,
    document_number: record.getString('document_number'),
    document_version: record.getInt('document_version'),
    status: record.getString('status'),
    file_sha256: record.getString('file_sha256'),
    generated_at: record.get('generated_at') ? String(record.get('generated_at')) : null,
    submission: record.getString('submission'),
    submission_version: record.getString('submission_version'),
  }
}

function assertStaffScope(app, h, workflow, staff, applicationId) {
  workflow.assertStaffCanAccessApplication(app, h, staff, applicationId)
}

function readRawBody(e) {
  try {
    var info = e.requestInfo()
    if (info && info.body && typeof info.body === 'object') return info.body
  } catch (_) {}
  return {}
}

function scopedApplicationIdsForStaff(app, h, workflow, staff) {
  if (staff.getBool('is_admin')) return null // null = all
  var ids = {}
  var deptIds = workflow.staffDepartmentIds(app, h, staff.id)
  for (var d = 0; d < deptIds.length; d++) {
    var byDept = app.findRecordsByFilter(
      h.COLLECTIONS.applications,
      'current_department = {:did}',
      '-submitted_at',
      1000,
      0,
      { did: deptIds[d] },
    )
    for (var i = 0; i < byDept.length; i++) ids[byDept[i].id] = true

    var assignDept = app.findRecordsByFilter(
      h.COLLECTIONS.applicationStaffAssignments,
      'department = {:did} && active = true',
      '-created',
      1000,
      0,
      { did: deptIds[d] },
    )
    for (var a = 0; a < assignDept.length; a++) {
      ids[assignDept[a].getString('application')] = true
    }
  }
  var assignStaff = app.findRecordsByFilter(
    h.COLLECTIONS.applicationStaffAssignments,
    'staff = {:sid} && active = true',
    '-created',
    1000,
    0,
    { sid: staff.id },
  )
  for (var s = 0; s < assignStaff.length; s++) {
    ids[assignStaff[s].getString('application')] = true
  }
  return Object.keys(ids)
}

function isOverrideStillValid(appRecord, h) {
  var until = appRecord.get('edit_override_until')
  if (!until) return false
  var ms = h.dateToMs(until)
  return !isNaN(ms) && Date.now() <= ms
}

function ensureCanSubmitNow(app, h, period, existing) {
  var editable = h.isPeriodEditableNow(period, Date.now())
  if (editable) return
  if (
    existing &&
    existing.getString('status') === 'returned_for_edit' &&
    isOverrideStillValid(existing, h)
  ) {
    return
  }
  throw new ForbiddenError('目前申請梯次未開放，或退回修改期限已過')
}

function createStaffAssignment(app, h, applicationId, departmentId, assignedBy) {
  if (!departmentId) return null
  var col = app.findCollectionByNameOrId(h.COLLECTIONS.applicationStaffAssignments)
  var record = new Record(col)
  record.set('application', applicationId)
  record.set('department', departmentId)
  record.set('assignment_type', 'primary')
  record.set('active', true)
  if (assignedBy) record.set('assigned_by', assignedBy)
  app.save(record)
  return record
}

// ---------------------------------------------------------------------------
// Student: submit
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/applications/submit',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const funding = require(`${__hooks}/hk_funding_config.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const meta = h.requestMeta(e)
    const student = requireStudent(e, h)

    const data = new DynamicModel({ submission_id: '' })
    e.bindBody(data)
    const submissionId = h.trimStr(data.submission_id)
    if (!submissionId) throw new BadRequestError('缺少 submission_id')

    const submission = e.app.findRecordById(h.COLLECTIONS.formSubmissions, submissionId)
    if (submission.getString('student') !== student.id) throw new ForbiddenError('無權限')
    if (submission.getString('status') !== 'completed') {
      throw new BadRequestError('請先完成表單填寫')
    }

    const periodId = submission.getString('period')
    const categoryId = submission.getString('category')
    const period = e.app.findRecordById(h.COLLECTIONS.applicationPeriods, periodId)
    const category = e.app.findRecordById(h.COLLECTIONS.applicationCategories, categoryId)
    const categoryCode = category.getString('code')

    var periodProfile = null
    try {
      periodProfile = e.app.findFirstRecordByFilter(
        h.COLLECTIONS.periodStudentProfiles,
        'student = {:sid} && period = {:pid}',
        { sid: student.id, pid: periodId },
      )
    } catch (_) {}
    if (!periodProfile || !periodProfile.get('confirmed_at')) {
      throw new BadRequestError('請先確認本梯次申請資格資料')
    }

    const existing = findExistingApplication(e.app, h, student.id, periodId, categoryId)
    ensureCanSubmitNow(e.app, h, period, existing)

    if (existing && existing.getString('status') !== 'returned_for_edit') {
      throw new BadRequestError('此類別已送件，不可重複申請')
    }

    const versionRecord = findLatestCompletedVersion(e.app, h, submissionId)
    if (!versionRecord) throw new BadRequestError('找不到已完成的表單版本')
    const snapshot = loadSnapshot(versionRecord)
    if (!snapshot) throw new BadRequestError('表單快照無效')

    const pdf = findValidPdf(e.app, h, submissionId)
    if (!pdf) throw new BadRequestError('請先產生有效 PDF 後再送件')

    validateSnapshotFileAttachments(e.app, h, student.id, snapshot)

    const sigMode = funding.getPdfSignatureUploadMode(categoryCode)
    var signedDoc = existing ? findActiveSignedDocument(e.app, h, existing.id) : null
    var signedAtt = null
    if (!signedDoc || (signedDoc && signedDoc.getString('source_pdf') !== pdf.id)) {
      // Prefer signed doc tied to latest valid PDF; otherwise look for submission attachment
      if (signedDoc && signedDoc.getString('source_pdf') !== pdf.id) {
        signedDoc = null
      }
      signedAtt = findSignedAttachmentForSubmission(e.app, h, student.id, submissionId)
    }
    if (sigMode === 'required' && !signedDoc && !signedAtt) {
      throw new BadRequestError('請先上傳已簽 PDF 文件後再送件')
    }

    const extracted = funding.extractRequestedFunding(categoryCode, snapshot)
    const requestedAmount = extracted.requested_total
    const now = h.nowIso()
    const primaryAssign = findPrimaryCategoryDepartment(e.app, h, categoryId)
    const departmentId = primaryAssign ? primaryAssign.getString('department') : ''

    var application = existing
    var fromStatus = existing ? existing.getString('status') : null
    var isResubmit = !!existing

    if (isResubmit) {
      application.set('submission', submissionId)
      application.set('submission_version', versionRecord.id)
      application.set('pdf_document', pdf.id)
      application.set('status', 'submitted')
      application.set('submitted_at', now)
      application.set('eligibility_status', 'pending')
      application.set('requested_amount', requestedAmount)
      application.set('return_reason', '')
      application.set('reject_reason', '')
      application.set('supplement_message', '')
      application.set('supplement_due_at', null)
      application.set('edit_override_until', null)
      application.set('notification_pending', false)
      if (departmentId) application.set('current_department', departmentId)
      e.app.save(application)
    } else {
      const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.applications)
      application = new Record(col)
      var appNumber = generateApplicationNumber(e.app, h, period, categoryCode)
      application.set('student', student.id)
      application.set('period', periodId)
      application.set('category', categoryId)
      application.set('submission', submissionId)
      application.set('submission_version', versionRecord.id)
      application.set('pdf_document', pdf.id)
      application.set('application_number', appNumber)
      application.set('status', 'submitted')
      application.set('submitted_at', now)
      application.set('eligibility_status', 'pending')
      application.set('requested_amount', requestedAmount)
      application.set('notification_pending', false)
      if (departmentId) application.set('current_department', departmentId)

      var saved = false
      for (var retry = 0; retry < 5 && !saved; retry++) {
        try {
          if (retry > 0) {
            application.set(
              'application_number',
              generateApplicationNumber(e.app, h, period, categoryCode),
            )
          }
          e.app.save(application)
          saved = true
        } catch (err) {
          if (retry >= 4) throw err
        }
      }
      if (departmentId) {
        try {
          createStaffAssignment(e.app, h, application.id, departmentId, null)
        } catch (_) {}
      }
    }

    // Link / create signed document for latest valid PDF when available
    if (!signedDoc && signedAtt) {
      try {
        signedDoc = createSignedDocumentFromAttachment(
          e.app,
          h,
          application,
          pdf,
          signedAtt,
          '',
        )
      } catch (_) {
        if (sigMode === 'required') {
          throw new BadRequestError('已簽文件登錄失敗，請重新上傳後再送件')
        }
      }
    }
    if (signedDoc) {
      if (signedDoc.getString('source_pdf') !== pdf.id && signedAtt) {
        signedDoc = createSignedDocumentFromAttachment(e.app, h, application, pdf, signedAtt, '')
      }
      application.set('signed_document', signedDoc.id)
      e.app.save(application)
    } else if (sigMode === 'required') {
      throw new BadRequestError('請先上傳已簽 PDF 文件後再送件')
    }

    writeStatusHistory(e.app, h, {
      application: application.id,
      from_status: fromStatus,
      to_status: 'submitted',
      changed_by_type: 'student',
      changed_by_student: student.id,
      reason: isResubmit ? '學生重新送件' : '學生送件',
    })

    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: isResubmit ? 'APPLICATION_RESUBMITTED' : 'APPLICATION_SUBMITTED',
        target_type: 'hk_applications',
        target_id: application.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          application_number: application.getString('application_number'),
          category: categoryCode,
          requested_amount: requestedAmount,
        },
      })
    } catch (_) {}

    try {
      const notif = require(`${__hooks}/hk_notification_service.js`)
      notif.safeEmitNotificationEvent(
        e.app,
        h,
        isResubmit ? 'APPLICATION_RESUBMITTED' : 'APPLICATION_SUBMITTED',
        {
          studentId: student.id,
          applicationId: application.id,
          idempotencyKey: 'app_submit:' + application.id + ':' + versionRecord.id,
          actionUrl: '/student/applications/' + application.id,
          variables: {
            student_name: student.getString('name') || '',
            category_name: category.getString('name') || categoryCode,
            application_number: application.getString('application_number'),
          },
        },
      )
    } catch (_) {}

    const labels = enrichApplicationLabels(e.app, h, workflow, application)
    return e.json(200, {
      application: applicationToPlain(application, Object.assign({ omit_internal: true }, labels)),
      message: isResubmit ? '已重新送件' : '送件成功',
    })
  },
  $apis.requireAuth('hk_students'),
)

// ---------------------------------------------------------------------------
// Student: list mine
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/applications/mine',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const student = requireStudent(e, h)
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.applications,
      'student = {:sid}',
      '-submitted_at',
      200,
      0,
      { sid: student.id },
    )
    const items = []
    for (var i = 0; i < rows.length; i++) {
      const labels = enrichApplicationLabels(e.app, h, workflow, rows[i])
      items.push(applicationToPlain(rows[i], Object.assign({ omit_internal: true }, labels)))
    }
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_students'),
)

// ---------------------------------------------------------------------------
// Student: detail mine
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/applications/mine/{id}',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const student = requireStudent(e, h)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    if (application.getString('student') !== student.id) throw new ForbiddenError('無權限')

    const labels = enrichApplicationLabels(e.app, h, workflow, application)
    const reviews = e.app.findRecordsByFilter(
      h.COLLECTIONS.applicationReviews,
      'application = {:aid}',
      '-created',
      100,
      0,
      { aid: id },
    )
    const studentReviews = []
    for (var r = 0; r < reviews.length; r++) {
      studentReviews.push(reviewToStudentPlain(reviews[r]))
    }

    var funding = null
    const decisions = e.app.findRecordsByFilter(
      h.COLLECTIONS.fundingDecisions,
      'application = {:aid} && status = "final"',
      '-decision_version',
      1,
      0,
      { aid: id },
    )
    if (decisions.length) {
      funding = fundingDecisionToPlain(decisions[0], false)
      const fItems = e.app.findRecordsByFilter(
        h.COLLECTIONS.fundingDecisionItems,
        'funding_decision = {:fid}',
        'sort_order',
        100,
        0,
        { fid: decisions[0].id },
      )
      funding.items = []
      for (var fi = 0; fi < fItems.length; fi++) funding.items.push(fundingItemToPlain(fItems[fi]))
    }

    const supplements = e.app.findRecordsByFilter(
      h.COLLECTIONS.supplementRequests,
      'application = {:aid} && status = "pending"',
      '-created',
      50,
      0,
      { aid: id },
    )
    const pendingSupplements = []
    for (var s = 0; s < supplements.length; s++) {
      pendingSupplements.push(supplementToPlain(supplements[s]))
    }

    const history = e.app.findRecordsByFilter(
      h.COLLECTIONS.applicationStatusHistory,
      'application = {:aid}',
      '-created',
      100,
      0,
      { aid: id },
    )
    const historyItems = []
    for (var hi = 0; hi < history.length; hi++) {
      historyItems.push(statusHistoryToPlain(history[hi], true))
    }

    return e.json(200, {
      application: applicationToPlain(application, Object.assign({ omit_internal: true }, labels)),
      reviews: studentReviews,
      funding: funding,
      pending_supplements: pendingSupplements,
      status_history: historyItems,
    })
  },
  $apis.requireAuth('hk_students'),
)

// ---------------------------------------------------------------------------
// Student: supplement reply
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/applications/{id}/supplement-reply',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const meta = h.requestMeta(e)
    const student = requireStudent(e, h)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    if (application.getString('student') !== student.id) throw new ForbiddenError('無權限')
    if (application.getString('status') !== 'supplement_required') {
      throw new BadRequestError('目前狀態不可補件回覆')
    }

    const rawBody = readRawBody(e)
    const data = new DynamicModel({ reply: '', message: '', attachment_ids: [] })
    e.bindBody(data)
    const reply = h.trimStr(data.reply || data.message || rawBody.reply || rawBody.message)
    var attachmentIds = []
    if (Array.isArray(rawBody.attachment_ids)) attachmentIds = rawBody.attachment_ids
    else if (Array.isArray(data.attachment_ids)) attachmentIds = data.attachment_ids

    const pending = e.app.findRecordsByFilter(
      h.COLLECTIONS.supplementRequests,
      'application = {:aid} && status = "pending"',
      '-created',
      50,
      0,
      { aid: id },
    )
    if (!pending.length) throw new BadRequestError('沒有待處理的補件要求')

    const now = h.nowIso()
    const nowMs = Date.now()
    var appDueOverdue = false
    var appDue = application.get('supplement_due_at')
    if (appDue) {
      var appDueMs = Date.parse(String(appDue))
      if (!isNaN(appDueMs) && nowMs > appDueMs) appDueOverdue = true
    }

    // Validate attachments belong to student
    const normalizedAttIds = []
    for (var ai = 0; ai < attachmentIds.length; ai++) {
      var attId = String(attachmentIds[ai] || '').trim()
      if (!attId) continue
      const att = e.app.findRecordById(h.COLLECTIONS.attachments, attId)
      if (att.getString('owner_student') !== student.id) throw new ForbiddenError('附件無權限')
      if (att.getString('status') !== 'active') throw new BadRequestError('附件狀態不可用')
      normalizedAttIds.push(att.id)
    }

    const subCol = e.app.findCollectionByNameOrId(h.COLLECTIONS.supplementSubmissions)
    const createdSubs = []

    for (var i = 0; i < pending.length; i++) {
      var req = pending[i]
      var overdue = isSupplementOverdue(req, nowMs) || appDueOverdue

      for (var a = 0; a < normalizedAttIds.length; a++) {
        try {
          const att = e.app.findRecordById(h.COLLECTIONS.attachments, normalizedAttIds[a])
          att.set('supplement_request', req.id)
          att.set('application', id)
          att.set('attachment_type', 'supplement')
          e.app.save(att)
        } catch (_) {}
      }

      const sub = new Record(subCol)
      sub.set('supplement_request', req.id)
      sub.set('student', student.id)
      if (reply) sub.set('message', reply)
      sub.set('submitted_at', now)
      sub.set('status', 'submitted')
      sub.set('is_overdue_at_submit', overdue)
      e.app.save(sub)
      createdSubs.push(sub)

      req.set('status', 'submitted')
      req.set('submitted_at', now)
      if (reply) req.set('student_reply', reply)
      e.app.save(req)
    }

    const fromStatus = application.getString('status')
    application.set('status', 'under_review')
    if (application.getString('eligibility_status') === 'supplement_required') {
      application.set('eligibility_status', 'pending')
    }
    e.app.save(application)

    writeStatusHistory(e.app, h, {
      application: id,
      from_status: fromStatus,
      to_status: 'under_review',
      changed_by_type: 'student',
      changed_by_student: student.id,
      reason: '學生補件回覆',
      metadata: {
        attachment_count: normalizedAttIds.length,
        overdue: appDueOverdue,
      },
    })

    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'SUPPLEMENT_REPLIED',
        target_type: 'hk_applications',
        target_id: application.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          attachment_ids: normalizedAttIds,
          overdue: appDueOverdue,
        },
      })
    } catch (_) {}

    const supplementItems = []
    for (var j = 0; j < pending.length; j++) {
      supplementItems.push(supplementToPlain(pending[j]))
    }

    return e.json(200, {
      message: '補件回覆已送出',
      application: applicationToPlain(application, { omit_internal: true }),
      supplements: supplementItems,
      attachment_ids: normalizedAttIds,
    })
  },
  $apis.requireAuth('hk_students'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: summary
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/applications/summary',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const staff = h.requireStaffAuth(e)
    const scopedIds = scopedApplicationIdsForStaff(e.app, h, workflow, staff)

    var rows = []
    if (scopedIds === null) {
      rows = e.app.findRecordsByFilter(h.COLLECTIONS.applications, 'id != ""', '-created', 5000, 0)
    } else if (!scopedIds.length) {
      rows = []
    } else {
      // Fetch in chunks by id filter when possible; fallback scan + filter
      var all = e.app.findRecordsByFilter(
        h.COLLECTIONS.applications,
        'id != ""',
        '-created',
        5000,
        0,
      )
      var set = {}
      for (var i = 0; i < scopedIds.length; i++) set[scopedIds[i]] = true
      for (var j = 0; j < all.length; j++) {
        if (set[all[j].id]) rows.push(all[j])
      }
    }

    const counts = {
      total: rows.length,
      by_status: {},
      by_eligibility: {},
    }
    for (var k = 0; k < rows.length; k++) {
      var st = rows[k].getString('status')
      var el = rows[k].getString('eligibility_status')
      counts.by_status[st] = (counts.by_status[st] || 0) + 1
      counts.by_eligibility[el] = (counts.by_eligibility[el] || 0) + 1
    }
    return e.json(200, counts)
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: list
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/applications',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const staff = h.requireStaffAuth(e)

    const q = queryStr(e, 'q').toLowerCase()
    const period = queryStr(e, 'period')
    const category = queryStr(e, 'category')
    const status = queryStr(e, 'status')
    const eligibility = queryStr(e, 'eligibility_status')
    const department = queryStr(e, 'department')
    const page = Math.max(1, queryInt(e, 'page', 1))
    const perPage = Math.min(100, Math.max(1, queryInt(e, 'perPage', 20)))
    var sort = queryStr(e, 'sort') || '-submitted_at'
    if (sort.indexOf('submitted_at') < 0 && sort.indexOf('created') < 0 && sort.indexOf('application_number') < 0) {
      sort = '-submitted_at'
    }

    var filterParts = ['id != ""']
    var params = {}
    if (period) {
      filterParts.push('period = {:period}')
      params.period = period
    }
    if (category) {
      filterParts.push('category = {:category}')
      params.category = category
    }
    if (status) {
      filterParts.push('status = {:status}')
      params.status = status
    }
    if (eligibility) {
      filterParts.push('eligibility_status = {:eligibility}')
      params.eligibility = eligibility
    }
    if (department) {
      filterParts.push('current_department = {:department}')
      params.department = department
    }
    const filter = filterParts.join(' && ')

    var rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.applications,
      filter,
      sort,
      5000,
      0,
      params,
    )

    const scopedIds = scopedApplicationIdsForStaff(e.app, h, workflow, staff)
    if (scopedIds !== null) {
      var set = {}
      for (var i = 0; i < scopedIds.length; i++) set[scopedIds[i]] = true
      var filtered = []
      for (var j = 0; j < rows.length; j++) {
        if (set[rows[j].id]) filtered.push(rows[j])
      }
      rows = filtered
    }

    const enriched = []
    for (var r = 0; r < rows.length; r++) {
      const application = rows[r]
      const labels = enrichApplicationLabels(e.app, h, workflow, application)
      var identity = {
        student_no: '',
        student_name: '',
        identity_masked: '****',
        department_name: '',
      }
      try {
        identity = loadStudentIdentity(e.app, h, application.getString('student'), false)
      } catch (_) {}

      if (q) {
        var hay =
          (application.getString('application_number') || '').toLowerCase() +
          ' ' +
          (identity.student_no || '').toLowerCase() +
          ' ' +
          (identity.student_name || '').toLowerCase() +
          ' ' +
          (labels.category_name || '').toLowerCase()
        if (hay.indexOf(q) < 0) continue
      }

      enriched.push(
        applicationToPlain(
          application,
          Object.assign({}, labels, {
            student_no: identity.student_no,
            student_name: identity.student_name,
            identity_masked: identity.identity_masked,
            department_name: identity.department_name,
          }),
        ),
      )
    }

    const totalItems = enriched.length
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
    const start = (page - 1) * perPage
    const pageItems = enriched.slice(start, start + perPage)

    return e.json(200, {
      page: page,
      perPage: perPage,
      totalItems: totalItems,
      totalPages: totalPages,
      items: pageItems,
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: detail
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/applications/{id}',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    assertStaffScope(e.app, h, workflow, staff, id)

    const labels = enrichApplicationLabels(e.app, h, workflow, application)
    const identity = loadStudentIdentity(e.app, h, application.getString('student'), true)

    var periodProfile = null
    try {
      const pp = e.app.findFirstRecordByFilter(
        h.COLLECTIONS.periodStudentProfiles,
        'student = {:sid} && period = {:pid}',
        { sid: application.getString('student'), pid: application.getString('period') },
      )
      periodProfile = h.periodProfileToPlain(pp)
    } catch (_) {}

    var snapshot = null
    try {
      const ver = e.app.findRecordById(
        h.COLLECTIONS.formSubmissionVersions,
        application.getString('submission_version'),
      )
      snapshot = loadSnapshot(ver)
    } catch (_) {}

    var pdf = null
    try {
      pdf = pdfMetaToPlain(
        e.app.findRecordById(h.COLLECTIONS.pdfDocuments, application.getString('pdf_document')),
      )
    } catch (_) {}

    const reviews = e.app.findRecordsByFilter(
      h.COLLECTIONS.applicationReviews,
      'application = {:aid}',
      '-created',
      200,
      0,
      { aid: id },
    )
    const reviewItems = []
    for (var r = 0; r < reviews.length; r++) reviewItems.push(reviewToPlain(reviews[r], true))

    const decisions = e.app.findRecordsByFilter(
      h.COLLECTIONS.fundingDecisions,
      'application = {:aid}',
      '-decision_version',
      50,
      0,
      { aid: id },
    )
    const fundingHistory = []
    for (var d = 0; d < decisions.length; d++) {
      var fd = fundingDecisionToPlain(decisions[d], true)
      var fItems = e.app.findRecordsByFilter(
        h.COLLECTIONS.fundingDecisionItems,
        'funding_decision = {:fid}',
        'sort_order',
        100,
        0,
        { fid: decisions[d].id },
      )
      fd.items = []
      for (var fi = 0; fi < fItems.length; fi++) fd.items.push(fundingItemToPlain(fItems[fi]))
      fundingHistory.push(fd)
    }

    const assignments = e.app.findRecordsByFilter(
      h.COLLECTIONS.applicationStaffAssignments,
      'application = {:aid}',
      '-created',
      100,
      0,
      { aid: id },
    )
    const assignmentItems = []
    for (var a = 0; a < assignments.length; a++) {
      assignmentItems.push(assignmentToPlain(assignments[a]))
    }

    const supplements = e.app.findRecordsByFilter(
      h.COLLECTIONS.supplementRequests,
      'application = {:aid}',
      '-created',
      100,
      0,
      { aid: id },
    )
    const supplementItems = []
    for (var s = 0; s < supplements.length; s++) {
      supplementItems.push(supplementToPlain(supplements[s]))
    }

    const history = e.app.findRecordsByFilter(
      h.COLLECTIONS.applicationStatusHistory,
      'application = {:aid}',
      '-created',
      200,
      0,
      { aid: id },
    )
    const historyItems = []
    for (var hi = 0; hi < history.length; hi++) {
      historyItems.push(statusHistoryToPlain(history[hi], false))
    }

    var academicYear = 0
    try {
      academicYear = e.app
        .findRecordById(h.COLLECTIONS.applicationPeriods, application.getString('period'))
        .getInt('academic_year')
    } catch (_) {}
    const annual = annualFundingSummary(
      e.app,
      h,
      application.getString('student'),
      academicYear,
    )

    return e.json(200, {
      application: applicationToPlain(
        application,
        Object.assign({}, labels, {
          student_no: identity.student_no,
          student_name: identity.student_name,
          identity_number: identity.identity_number,
          identity_masked: identity.identity_masked,
          department_name: identity.department_name,
        }),
      ),
      student: {
        id: application.getString('student'),
        student_no: identity.student_no,
        profile: identity.profile || null,
      },
      period_profile: periodProfile,
      submission_snapshot: snapshot,
      pdf: pdf,
      reviews: reviewItems,
      funding_history: fundingHistory,
      assignments: assignmentItems,
      supplements: supplementItems,
      status_history: historyItems,
      annual_funding_summary: annual,
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: action
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/admin/applications/{id}/action',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    assertStaffScope(e.app, h, workflow, staff, id)

    const data = new DynamicModel({
      action: '',
      reason: '',
      student_message: '',
      internal_note: '',
      edit_override_until: '',
      due_at: '',
      comment: '',
    })
    e.bindBody(data)

    const action = h.trimStr(data.action)
    const reason = h.trimStr(data.reason)
    const studentMessage = h.trimStr(data.student_message)
    const internalNote = h.trimStr(data.internal_note)
    const comment = h.trimStr(data.comment)
    const editOverrideUntil = h.trimStr(data.edit_override_until)
    const dueAt = h.trimStr(data.due_at)

    const fromStatus = application.getString('status')
    const toStatus = workflow.resolveAction(action, fromStatus)

    const reasonRequired = [
      'reject',
      'disqualify_eligibility',
      'return_for_edit',
      'request_supplement',
    ]
    if (reasonRequired.indexOf(action) >= 0 && !reason) {
      throw new BadRequestError('請填寫原因')
    }

    const now = h.nowIso()
    var createdSupplementId = ''
    application.set('status', toStatus)
    application.set('latest_reviewed_at', now)

    if (action === 'qualify_eligibility') {
      application.set('eligibility_status', 'qualified')
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: 'eligibility',
        decision: 'qualified',
        comment: comment || reason,
        internal_note: internalNote,
        student_message: studentMessage,
      })
    } else if (action === 'disqualify_eligibility') {
      application.set('eligibility_status', 'disqualified')
      application.set('reject_reason', reason)
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: 'eligibility',
        decision: 'disqualified',
        comment: comment || reason,
        internal_note: internalNote,
        student_message: studentMessage || reason,
      })
    } else if (action === 'request_supplement') {
      if (fromStatus === 'eligibility_review') {
        application.set('eligibility_status', 'supplement_required')
      }
      application.set('supplement_message', reason)
      if (dueAt) application.set('supplement_due_at', dueAt)

      const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.supplementRequests)
      const supp = new Record(col)
      supp.set('application', id)
      supp.set('requested_by', staff.id)
      supp.set('message', reason)
      if (dueAt) supp.set('due_at', dueAt)
      supp.set('status', 'pending')
      e.app.save(supp)
      createdSupplementId = supp.id

      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: fromStatus === 'eligibility_review' ? 'eligibility' : 'content',
        decision: 'supplement_required',
        comment: comment || reason,
        internal_note: internalNote,
        student_message: studentMessage || reason,
      })
    } else if (action === 'accept_supplement') {
      const pending = e.app.findRecordsByFilter(
        h.COLLECTIONS.supplementRequests,
        'application = {:aid} && (status = "pending" || status = "submitted")',
        '-created',
        50,
        0,
        { aid: id },
      )
      for (var si = 0; si < pending.length; si++) {
        pending[si].set('status', 'accepted')
        pending[si].set('resolved_at', now)
        e.app.save(pending[si])
        try {
          const notifCancel = require(`${__hooks}/hk_notification_service.js`)
          notifCancel.cancelRemindersForSupplement(e.app, h, pending[si].id)
        } catch (_) {}
      }
      application.set('supplement_message', '')
      application.set('supplement_due_at', null)
      if (application.getString('eligibility_status') === 'supplement_required') {
        application.set('eligibility_status', 'qualified')
      }
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: 'content',
        decision: 'note_only',
        comment: comment || '接受補件',
        internal_note: internalNote,
        student_message: studentMessage,
      })
    } else if (action === 'return_for_edit') {
      application.set('return_reason', reason)
      if (editOverrideUntil) application.set('edit_override_until', editOverrideUntil)
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: 'content',
        decision: 'returned_for_edit',
        comment: comment || reason,
        internal_note: internalNote,
        student_message: studentMessage || reason,
      })
    } else if (action === 'approve') {
      application.set('notification_pending', false)
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: 'final',
        decision: 'approved',
        comment: comment || reason,
        internal_note: internalNote,
        student_message: studentMessage,
      })
    } else if (action === 'reject') {
      application.set('reject_reason', reason)
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: fromStatus === 'eligibility_review' ? 'eligibility' : 'content',
        decision: 'rejected',
        comment: comment || reason,
        internal_note: internalNote,
        student_message: studentMessage || reason,
      })
    } else if (action === 'start_eligibility_review') {
      createReviewRecord(e.app, h, {
        application: id,
        reviewer: staff.id,
        review_type: 'eligibility',
        decision: 'note_only',
        comment: comment || '開始資格審核',
        internal_note: internalNote,
        student_message: studentMessage,
      })
    } else if (action === 'close') {
      const followLib = require(`${__hooks}/hk_follow_up_lib.js`)
      followLib.assertRequiredFollowUpsComplete(e.app, h, id)
      application.set('closed_at', now)
    }

    e.app.save(application)

    writeStatusHistory(e.app, h, {
      application: id,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by_type: actorTypeOfStaff(staff),
      changed_by_staff: staff.id,
      reason: reason || comment || action,
      metadata: { action: action },
    })

    try {
      h.writeAudit(e.app, {
        actor_type: actorTypeOfStaff(staff),
        actor_staff: staff.id,
        action: 'APPLICATION_ACTION_' + action.toUpperCase(),
        target_type: 'hk_applications',
        target_id: id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { from_status: fromStatus, to_status: toStatus },
      })
    } catch (_) {}

    try {
      var notifEvent = ''
      if (action === 'request_supplement') notifEvent = 'SUPPLEMENT_REQUESTED'
      else if (action === 'return_for_edit') notifEvent = 'APPLICATION_RETURNED'
      else if (action === 'reject' || action === 'disqualify_eligibility') {
        notifEvent = 'APPLICATION_REJECTED'
      } else if (action === 'approve') notifEvent = 'APPLICATION_APPROVED'

      if (notifEvent) {
        const notif = require(`${__hooks}/hk_notification_service.js`)
        var catName = ''
        try {
          catName = e.app
            .findRecordById(h.COLLECTIONS.applicationCategories, application.getString('category'))
            .getString('name')
        } catch (_) {}
        var studentName = ''
        try {
          studentName = e.app
            .findRecordById(h.COLLECTIONS.students, application.getString('student'))
            .getString('name')
        } catch (_) {}
        notif.safeEmitNotificationEvent(e.app, h, notifEvent, {
          studentId: application.getString('student'),
          applicationId: id,
          supplementId: createdSupplementId || undefined,
          idempotencyKey:
            'app_action:' + id + ':' + action + ':' + fromStatus + ':' + toStatus,
          actionUrl: '/student/applications/' + id,
          variables: {
            student_name: studentName,
            category_name: catName,
            application_number: application.getString('application_number'),
            student_message: studentMessage || reason || '',
            due_at: dueAt || String(application.get('supplement_due_at') || ''),
          },
        })
      }
    } catch (_) {}

    const labels = enrichApplicationLabels(e.app, h, workflow, application)
    return e.json(200, {
      application: applicationToPlain(application, labels),
      message: '操作完成',
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: assign
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/admin/applications/{id}/assign',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)

    const data = new DynamicModel({
      staff_id: '',
      department_id: '',
      assignment_type: 'primary',
    })
    e.bindBody(data)

    const staffId = h.trimStr(data.staff_id)
    const departmentId = h.trimStr(data.department_id)
    var assignmentType = h.trimStr(data.assignment_type) || 'primary'
    if (['primary', 'collaborator', 'viewer'].indexOf(assignmentType) < 0) {
      throw new BadRequestError('assignment_type 無效')
    }
    if (!staffId && !departmentId) {
      throw new BadRequestError('請指定承辦人或單位')
    }

    const hasCurrent =
      !!application.getString('current_staff') || !!application.getString('current_department')
    if (!hasCurrent && !staff.getBool('is_admin')) {
      throw new ForbiddenError('未指派案件僅管理員可指派')
    }
    if (hasCurrent) {
      assertStaffScope(e.app, h, workflow, staff, id)
    }

    if (staffId) {
      try {
        e.app.findRecordById(h.COLLECTIONS.staffUsers, staffId)
      } catch (_) {
        throw new BadRequestError('承辦人不存在')
      }
      application.set('current_staff', staffId)
    }
    if (departmentId) {
      try {
        e.app.findRecordById(h.COLLECTIONS.departments, departmentId)
      } catch (_) {
        throw new BadRequestError('單位不存在')
      }
      application.set('current_department', departmentId)
    }
    e.app.save(application)

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.applicationStaffAssignments)
    const record = new Record(col)
    record.set('application', id)
    if (staffId) record.set('staff', staffId)
    if (departmentId) record.set('department', departmentId)
    record.set('assignment_type', assignmentType)
    record.set('active', true)
    record.set('assigned_by', staff.id)
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: actorTypeOfStaff(staff),
        actor_staff: staff.id,
        action: 'APPLICATION_ASSIGNED',
        target_type: 'hk_applications',
        target_id: id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          staff_id: staffId || null,
          department_id: departmentId || null,
          assignment_type: assignmentType,
        },
      })
    } catch (_) {}

    return e.json(200, {
      application: applicationToPlain(application),
      assignment: assignmentToPlain(record),
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: funding decision
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/admin/applications/{id}/funding',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const fundingCfg = require(`${__hooks}/hk_funding_config.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const meta = h.requestMeta(e)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    assertStaffScope(e.app, h, workflow, staff, id)

    const status = application.getString('status')
    if (status !== 'funding_pending' && status !== 'funding_decided') {
      throw new BadRequestError('目前狀態不可核定補助')
    }

    const data = new DynamicModel({
      items: [],
      decision_note: '',
      internal_note: '',
      student_message: '',
      change_reason: '',
      notify_student: false,
    })
    e.bindBody(data)
    const rawBody = readRawBody(e)

    const changeReason = h.trimStr(data.change_reason || rawBody.change_reason)
    const isRevise = status === 'funding_decided'
    if (isRevise && !changeReason) {
      throw new BadRequestError('修正核定請填寫變更原因')
    }

    var snapshot = null
    try {
      const ver = e.app.findRecordById(
        h.COLLECTIONS.formSubmissionVersions,
        application.getString('submission_version'),
      )
      snapshot = loadSnapshot(ver)
    } catch (_) {}
    if (!snapshot) throw new BadRequestError('找不到申請快照')

    var categoryCode = ''
    try {
      categoryCode = e.app
        .findRecordById(h.COLLECTIONS.applicationCategories, application.getString('category'))
        .getString('code')
    } catch (_) {}
    const extracted = fundingCfg.extractRequestedFunding(categoryCode, snapshot)
    const requestedByCode = {}
    for (var ei = 0; ei < extracted.items.length; ei++) {
      requestedByCode[extracted.items[ei].item_code] = extracted.items[ei]
    }

    var inputItems = []
    if (Array.isArray(data.items) && data.items.length) inputItems = data.items
    else if (Array.isArray(rawBody.items)) inputItems = rawBody.items
    if (!inputItems.length) throw new BadRequestError('請提供核定項目')

    var approvedTotal = 0
    const normalized = []
    for (var i = 0; i < inputItems.length; i++) {
      const row = inputItems[i] || {}
      const code = h.trimStr(row.item_code)
      const reqItem = requestedByCode[code]
      if (!reqItem) throw new BadRequestError('未知補助項目：' + code)
      var approved = Number(row.approved_amount)
      if (isNaN(approved) || approved < 0) {
        throw new BadRequestError('核定金額不可為負數')
      }
      if (approved > Number(reqItem.requested_amount || 0)) {
        throw new BadRequestError('核定金額不可超過申請金額：' + code)
      }
      approvedTotal += approved
      normalized.push({
        item_code: code,
        item_label: reqItem.item_label,
        requested_amount: Number(reqItem.requested_amount || 0),
        approved_amount: approved,
        note: h.trimStr(row.note),
        sort_order: reqItem.sort_order || i + 1,
      })
    }

    const warnings = checkFundingRules(
      e.app,
      h,
      application.getString('student'),
      application.getString('period'),
      application.getString('category'),
      approvedTotal,
    )

    var nextVersion = 1
    var oldFinal = null
    const existingFinal = e.app.findRecordsByFilter(
      h.COLLECTIONS.fundingDecisions,
      'application = {:aid} && status = "final"',
      '-decision_version',
      1,
      0,
      { aid: id },
    )
    if (existingFinal.length) {
      oldFinal = existingFinal[0]
      nextVersion = (oldFinal.getInt('decision_version') || 1) + 1
    } else {
      const any = e.app.findRecordsByFilter(
        h.COLLECTIONS.fundingDecisions,
        'application = {:aid}',
        '-decision_version',
        1,
        0,
        { aid: id },
      )
      if (any.length) nextVersion = (any[0].getInt('decision_version') || 0) + 1
    }

    const fromStatus = application.getString('status')
    const decCol = e.app.findCollectionByNameOrId(h.COLLECTIONS.fundingDecisions)
    const decision = new Record(decCol)
    decision.set('application', id)
    decision.set('decision_version', nextVersion)
    decision.set('requested_total', extracted.requested_total)
    decision.set('approved_total', approvedTotal)
    decision.set('decision_note', h.trimStr(data.decision_note || rawBody.decision_note))
    decision.set('internal_note', h.trimStr(data.internal_note || rawBody.internal_note))
    decision.set('student_message', h.trimStr(data.student_message || rawBody.student_message))
    if (changeReason) decision.set('change_reason', changeReason)
    decision.set('decided_by', staff.id)
    decision.set('decided_at', h.nowIso())
    decision.set('status', 'final')
    e.app.save(decision)

    if (oldFinal) {
      oldFinal.set('status', 'superseded')
      oldFinal.set('superseded_by', decision.id)
      e.app.save(oldFinal)
    }

    const itemCol = e.app.findCollectionByNameOrId(h.COLLECTIONS.fundingDecisionItems)
    const savedItems = []
    for (var n = 0; n < normalized.length; n++) {
      const itemRec = new Record(itemCol)
      itemRec.set('funding_decision', decision.id)
      itemRec.set('item_code', normalized[n].item_code)
      itemRec.set('item_label', normalized[n].item_label)
      itemRec.set('requested_amount', normalized[n].requested_amount)
      itemRec.set('approved_amount', normalized[n].approved_amount)
      if (normalized[n].note) itemRec.set('note', normalized[n].note)
      itemRec.set('sort_order', normalized[n].sort_order)
      e.app.save(itemRec)
      savedItems.push(fundingItemToPlain(itemRec))
    }

    application.set('approved_amount', approvedTotal)
    application.set('status', 'funding_decided')
    application.set('latest_reviewed_at', h.nowIso())
    const notifyStudent = data.notify_student === true || rawBody.notify_student === true
    if (notifyStudent) {
      application.set('notification_pending', true)
    }
    e.app.save(application)

    // Phase 8: seed follow-up tasks after funding decided (idempotent)
    try {
      const followLib = require(`${__hooks}/hk_follow_up_lib.js`)
      followLib.ensureFollowUpTasksForApplication(e.app, h, id)
    } catch (followErr) {
      try {
        h.writeAudit(e.app, {
          actor_type: actorTypeOfStaff(staff),
          actor_staff: staff.id,
          action: 'FOLLOW_UP_SEED_FAILED',
          target_type: 'hk_applications',
          target_id: id,
          ip: meta.ip,
          user_agent: meta.user_agent,
          metadata: { error: String(followErr.message || followErr) },
        })
      } catch (_) {}
    }

    writeStatusHistory(e.app, h, {
      application: id,
      from_status: fromStatus,
      to_status: 'funding_decided',
      changed_by_type: actorTypeOfStaff(staff),
      changed_by_staff: staff.id,
      reason: changeReason || h.trimStr(data.decision_note || rawBody.decision_note) || '補助核定',
      metadata: { decision_version: nextVersion, revised: isRevise },
    })

    try {
      h.writeAudit(e.app, {
        actor_type: actorTypeOfStaff(staff),
        actor_staff: staff.id,
        action: isRevise ? 'FUNDING_DECISION_REVISED' : 'FUNDING_DECISION_CREATED',
        target_type: 'hk_funding_decisions',
        target_id: decision.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          application_id: id,
          approved_total: approvedTotal,
          decision_version: nextVersion,
          notify_student: notifyStudent,
        },
      })
    } catch (_) {}

    try {
      const notif = require(`${__hooks}/hk_notification_service.js`)
      var fundStudentName = ''
      try {
        fundStudentName = e.app
          .findRecordById(h.COLLECTIONS.students, application.getString('student'))
          .getString('name')
      } catch (_) {}
      var fundCatName = ''
      try {
        fundCatName = e.app
          .findRecordById(h.COLLECTIONS.applicationCategories, application.getString('category'))
          .getString('name')
      } catch (_) {}
      notif.safeEmitNotificationEvent(
        e.app,
        h,
        isRevise ? 'FUNDING_REVISED' : 'FUNDING_DECIDED',
        {
          studentId: application.getString('student'),
          applicationId: id,
          idempotencyKey: 'funding:' + decision.id,
          actionUrl: '/student/applications/' + id,
          variables: {
            student_name: fundStudentName,
            category_name: fundCatName,
            application_number: application.getString('application_number'),
            approved_amount: String(approvedTotal),
            student_message: h.trimStr(data.student_message || rawBody.student_message),
          },
        },
      )
      if (application.getBool('notification_pending')) {
        application.set('notification_pending', false)
        e.app.save(application)
      }
    } catch (_) {}

    return e.json(200, {
      application: applicationToPlain(application),
      funding: Object.assign(fundingDecisionToPlain(decision, true), { items: savedItems }),
      warnings: warnings,
      message: isRevise ? '核定已修正' : '核定完成',
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin/Staff: funding preview
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/applications/{id}/funding-preview',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const fundingCfg = require(`${__hooks}/hk_funding_config.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const staff = h.requireStaffAuth(e)
    const id = e.request.pathValue('id')
    const application = e.app.findRecordById(h.COLLECTIONS.applications, id)
    assertStaffScope(e.app, h, workflow, staff, id)

    var snapshot = null
    try {
      const ver = e.app.findRecordById(
        h.COLLECTIONS.formSubmissionVersions,
        application.getString('submission_version'),
      )
      snapshot = loadSnapshot(ver)
    } catch (_) {}
    if (!snapshot) throw new BadRequestError('找不到申請快照')

    var categoryCode = ''
    try {
      categoryCode = e.app
        .findRecordById(h.COLLECTIONS.applicationCategories, application.getString('category'))
        .getString('code')
    } catch (_) {}

    const extracted = fundingCfg.extractRequestedFunding(categoryCode, snapshot)
    var academicYear = 0
    try {
      academicYear = e.app
        .findRecordById(h.COLLECTIONS.applicationPeriods, application.getString('period'))
        .getInt('academic_year')
    } catch (_) {}
    const annual = annualFundingSummary(
      e.app,
      h,
      application.getString('student'),
      academicYear,
    )
    const warnings = checkFundingRules(
      e.app,
      h,
      application.getString('student'),
      application.getString('period'),
      application.getString('category'),
      0,
    )

    return e.json(200, {
      extracted: extracted,
      annual_funding_summary: annual,
      warnings: warnings,
    })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin: staff users
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/staff-users',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    h.requireAdminAuth(e)
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.staffUsers,
      'id != ""',
      'name',
      500,
      0,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) {
      const plain = staffUserToPlain(rows[i])
      plain.departments = []
      try {
        const links = e.app.findRecordsByFilter(
          h.COLLECTIONS.staffDepartments,
          'staff = {:sid} && active = true',
          '-created',
          50,
          0,
          { sid: rows[i].id },
        )
        for (var d = 0; d < links.length; d++) {
          plain.departments.push({
            id: links[d].id,
            department: links[d].getString('department'),
            is_primary: links[d].getBool('is_primary'),
            active: links[d].getBool('active'),
          })
        }
      } catch (_) {}
      items.push(plain)
    }
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/staff-users',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)

    const data = new DynamicModel({
      email: '',
      password: '',
      name: '',
      is_staff: true,
      is_admin: false,
      active: true,
      phone: '',
      job_title: '',
      notes: '',
      department_ids: [],
    })
    e.bindBody(data)
    const rawBody = readRawBody(e)

    const email = h.trimStr(data.email).toLowerCase()
    const password = String(data.password || '')
    const name = h.trimStr(data.name)
    if (!email || email.indexOf('@') < 1) throw new BadRequestError('Email 無效')
    if (!password || password.length < 8) throw new BadRequestError('密碼至少 8 碼')
    if (!name) throw new BadRequestError('請填寫姓名')

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.staffUsers)
    const record = new Record(col)
    record.set('email', email)
    record.set('name', name)
    record.set('is_staff', data.is_staff !== false)
    record.set('is_admin', !!data.is_admin)
    record.set('active', data.active !== false)
    if (h.trimStr(data.phone)) record.set('phone', h.trimStr(data.phone))
    if (h.trimStr(data.job_title)) record.set('job_title', h.trimStr(data.job_title))
    if (h.trimStr(data.notes)) record.set('notes', h.trimStr(data.notes))
    if (typeof record.setPassword === 'function') {
      record.setPassword(password)
    } else {
      record.set('password', password)
      record.set('passwordConfirm', password)
    }
    e.app.save(record)

    var deptIds = []
    if (Array.isArray(data.department_ids) && data.department_ids.length) {
      deptIds = data.department_ids
    } else if (Array.isArray(rawBody.department_ids)) {
      deptIds = rawBody.department_ids
    }
    for (var i = 0; i < deptIds.length; i++) {
      const did = h.trimStr(deptIds[i])
      if (!did) continue
      try {
        e.app.findRecordById(h.COLLECTIONS.departments, did)
        const linkCol = e.app.findCollectionByNameOrId(h.COLLECTIONS.staffDepartments)
        const link = new Record(linkCol)
        link.set('staff', record.id)
        link.set('department', did)
        link.set('is_primary', i === 0)
        link.set('active', true)
        e.app.save(link)
      } catch (_) {}
    }

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'STAFF_USER_CREATED',
        target_type: 'hk_staff_users',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { staff_user: staffUserToPlain(record) })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/staff-users/{id}',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)
    const id = e.request.pathValue('id')
    const record = e.app.findRecordById(h.COLLECTIONS.staffUsers, id)

    const data = new DynamicModel({
      email: '',
      password: '',
      name: '',
      is_staff: true,
      is_admin: false,
      active: true,
      phone: '',
      job_title: '',
      notes: '',
    })
    e.bindBody(data)

    const name = h.trimStr(data.name)
    if (name) record.set('name', name)
    const email = h.trimStr(data.email).toLowerCase()
    if (email) {
      if (email.indexOf('@') < 1) throw new BadRequestError('Email 無效')
      record.set('email', email)
    }
    if (typeof data.is_staff === 'boolean') record.set('is_staff', data.is_staff)
    if (typeof data.is_admin === 'boolean') record.set('is_admin', data.is_admin)
    if (typeof data.active === 'boolean') record.set('active', data.active)
    if (data.phone !== undefined) record.set('phone', h.trimStr(data.phone))
    if (data.job_title !== undefined) record.set('job_title', h.trimStr(data.job_title))
    if (data.notes !== undefined) record.set('notes', h.trimStr(data.notes))

    const password = String(data.password || '')
    if (password) {
      if (password.length < 8) throw new BadRequestError('密碼至少 8 碼')
      if (typeof record.setPassword === 'function') {
        record.setPassword(password)
      } else {
        record.set('password', password)
        record.set('passwordConfirm', password)
      }
    }

    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'STAFF_USER_UPDATED',
        target_type: 'hk_staff_users',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { staff_user: staffUserToPlain(record) })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin: departments
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/departments',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    h.requireAdminAuth(e)
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.departments,
      'id != ""',
      'sort_order,code',
      200,
      0,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(departmentToPlain(rows[i]))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/departments',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)

    const data = new DynamicModel({
      id: '',
      name: '',
      code: '',
      active: true,
      description: '',
      sort_order: 0,
      deactivate: false,
    })
    e.bindBody(data)

    const existingId = h.trimStr(data.id)
    if (existingId) {
      const record = e.app.findRecordById(h.COLLECTIONS.departments, existingId)
      if (data.deactivate === true || data.active === false) {
        // soft deactivate — never hard-delete when assignments may exist
        record.set('active', false)
      } else {
        const name = h.trimStr(data.name)
        if (name) record.set('name', name)
        if (data.description !== undefined) record.set('description', h.trimStr(data.description))
        if (typeof data.active === 'boolean') record.set('active', data.active)
        if (typeof data.sort_order === 'number') record.set('sort_order', data.sort_order)
        // code immutable after create
      }
      e.app.save(record)
      try {
        h.writeAudit(e.app, {
          actor_type: 'admin',
          actor_staff: e.auth.id,
          action: 'DEPARTMENT_UPDATED',
          target_type: 'hk_departments',
          target_id: record.id,
          ip: meta.ip,
          user_agent: meta.user_agent,
        })
      } catch (_) {}
      return e.json(200, { department: departmentToPlain(record) })
    }

    const name = h.trimStr(data.name)
    const code = h.trimStr(data.code).toUpperCase()
    if (!name || !code) throw new BadRequestError('請填寫單位名稱與代碼')

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.departments)
    const record = new Record(col)
    record.set('name', name)
    record.set('code', code)
    record.set('active', data.active !== false)
    record.set('description', h.trimStr(data.description))
    record.set('sort_order', data.sort_order || 0)
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'DEPARTMENT_CREATED',
        target_type: 'hk_departments',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { department: departmentToPlain(record) })
  },
  $apis.requireAuth('hk_staff_users'),
)

// ---------------------------------------------------------------------------
// Admin: category-department assignments
// ---------------------------------------------------------------------------

routerAdd(
  'GET',
  '/api/hk/admin/category-department-assignments',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    h.requireAdminAuth(e)
    const category = queryStr(e, 'category')
    var filter = 'id != ""'
    var params = {}
    if (category) {
      filter = 'category = {:cid}'
      params.cid = category
    }
    const rows = e.app.findRecordsByFilter(
      h.COLLECTIONS.categoryDepartmentAssignments,
      filter,
      '-created',
      500,
      0,
      params,
    )
    const items = []
    for (var i = 0; i < rows.length; i++) items.push(categoryDeptAssignmentToPlain(rows[i]))
    return e.json(200, { items: items })
  },
  $apis.requireAuth('hk_staff_users'),
)

routerAdd(
  'POST',
  '/api/hk/admin/category-department-assignments',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const meta = h.requestMeta(e)
    h.requireAdminAuth(e)

    const data = new DynamicModel({
      id: '',
      category: '',
      department: '',
      assignment_type: 'primary',
      active: true,
    })
    e.bindBody(data)

    const existingId = h.trimStr(data.id)
    var assignmentType = h.trimStr(data.assignment_type) || 'primary'
    if (['primary', 'collaborator'].indexOf(assignmentType) < 0) {
      throw new BadRequestError('assignment_type 無效')
    }

    if (existingId) {
      const record = e.app.findRecordById(h.COLLECTIONS.categoryDepartmentAssignments, existingId)
      if (typeof data.active === 'boolean') record.set('active', data.active)
      record.set('assignment_type', assignmentType)
      const department = h.trimStr(data.department)
      if (department) record.set('department', department)
      e.app.save(record)
      try {
        h.writeAudit(e.app, {
          actor_type: 'admin',
          actor_staff: e.auth.id,
          action: 'CATEGORY_DEPARTMENT_ASSIGNMENT_UPDATED',
          target_type: 'hk_category_department_assignments',
          target_id: record.id,
          ip: meta.ip,
          user_agent: meta.user_agent,
        })
      } catch (_) {}
      return e.json(200, { assignment: categoryDeptAssignmentToPlain(record) })
    }

    const categoryId = h.trimStr(data.category)
    const departmentId = h.trimStr(data.department)
    if (!categoryId || !departmentId) throw new BadRequestError('請指定類別與單位')
    try {
      e.app.findRecordById(h.COLLECTIONS.applicationCategories, categoryId)
      e.app.findRecordById(h.COLLECTIONS.departments, departmentId)
    } catch (_) {
      throw new BadRequestError('類別或單位不存在')
    }

    if (assignmentType === 'primary') {
      const others = e.app.findRecordsByFilter(
        h.COLLECTIONS.categoryDepartmentAssignments,
        'category = {:cid} && assignment_type = "primary" && active = true',
        '-created',
        20,
        0,
        { cid: categoryId },
      )
      for (var i = 0; i < others.length; i++) {
        others[i].set('active', false)
        e.app.save(others[i])
      }
    }

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.categoryDepartmentAssignments)
    const record = new Record(col)
    record.set('category', categoryId)
    record.set('department', departmentId)
    record.set('assignment_type', assignmentType)
    record.set('active', data.active !== false)
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: 'admin',
        actor_staff: e.auth.id,
        action: 'CATEGORY_DEPARTMENT_ASSIGNMENT_CREATED',
        target_type: 'hk_category_department_assignments',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, { assignment: categoryDeptAssignmentToPlain(record) })
  },
  $apis.requireAuth('hk_staff_users'),
)
