/**
 * Shared helpers for HAD PocketBase hooks.
 * Loaded via require() inside handlers (JSVM isolated scopes).
 */

var COLLECTIONS = {
  staffUsers: 'had_staff_users',
  departments: 'had_departments',
  staffDepartments: 'had_staff_departments',
  students: 'had_students',
  studentProfiles: 'had_student_profiles',
  applicationPeriods: 'had_application_periods',
  identityResetRequests: 'had_identity_reset_requests',
  auditLogs: 'had_audit_logs',
  periodStudentProfiles: 'had_period_student_profiles',
  applicationCategories: 'had_application_categories',
  studentCategoryEntries: 'had_student_category_entries',
  forms: 'had_forms',
  formVersions: 'had_form_versions',
  formSections: 'had_form_sections',
  formFields: 'had_form_fields',
  formFieldOptions: 'had_form_field_options',
  formRules: 'had_form_rules',
  formSubmissions: 'had_form_submissions',
  formSubmissionVersions: 'had_form_submission_versions',
  formAnswers: 'had_form_answers',
  pdfDocuments: 'had_pdf_documents',
  applications: 'had_applications',
  applicationStatusHistory: 'had_application_status_history',
  applicationReviews: 'had_application_reviews',
  applicationStaffAssignments: 'had_application_staff_assignments',
  categoryDepartmentAssignments: 'had_category_department_assignments',
  supplementRequests: 'had_supplement_requests',
  fundingDecisions: 'had_funding_decisions',
  fundingDecisionItems: 'had_funding_decision_items',
  fundingRules: 'had_funding_rules',
  attachments: 'had_attachments',
  signedDocuments: 'had_signed_documents',
  supplementSubmissions: 'had_supplement_submissions',
  followUpTaskTemplates: 'had_follow_up_task_templates',
  categoryFollowUpTemplates: 'had_category_follow_up_templates',
  followUpTasks: 'had_follow_up_tasks',
  followUpSubmissions: 'had_follow_up_submissions',
  followUpReviews: 'had_follow_up_reviews',
  notificationTemplates: 'had_notification_templates',
  notifications: 'had_notifications',
  notificationDeliveries: 'had_notification_deliveries',
  notificationPreferences: 'had_notification_preferences',
  reminderRules: 'had_reminder_rules',
  scheduledNotifications: 'had_scheduled_notifications',
}

function trimStr(value) {
  return (value == null ? '' : String(value)).trim()
}

function upperStr(value) {
  return trimStr(value).toUpperCase()
}

function getIdentityLast4(identityNumber) {
  var value = upperStr(identityNumber)
  return value.slice(-4)
}

function studentInternalEmail(studentNo) {
  // Synthetic auth email — never shown as student login identity.
  return 'had.' + encodeURIComponent(trimStr(studentNo).toLowerCase()) + '@students.had.internal'
}

function writeAudit(app, payload) {
  var collection = app.findCollectionByNameOrId(COLLECTIONS.auditLogs)
  var record = new Record(collection)
  record.set('actor_type', payload.actor_type || 'system')
  if (payload.actor_student) record.set('actor_student', payload.actor_student)
  if (payload.actor_staff) record.set('actor_staff', payload.actor_staff)
  record.set('action', payload.action)
  if (payload.target_type) record.set('target_type', payload.target_type)
  if (payload.target_id) record.set('target_id', payload.target_id)
  if (payload.ip) record.set('ip', payload.ip)
  if (payload.user_agent) record.set('user_agent', payload.user_agent)
  if (payload.metadata) record.set('metadata', payload.metadata)
  app.save(record)
}

function requestMeta(e) {
  var ua = ''
  try {
    ua = e.request.header.get('User-Agent') || ''
  } catch (_) {}
  return {
    ip: e.realIP ? e.realIP() : e.remoteIP(),
    user_agent: ua,
  }
}

function isLocked(record, nowMs) {
  var locked = record.get('locked_until')
  if (!locked) return false
  try {
    var ms = locked.time ? locked.time().unix() * 1000 : Date.parse(String(locked))
    return !isNaN(ms) && ms > nowMs
  } catch (_) {
    return false
  }
}

function addMinutesIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

function requireStaffAuth(e) {
  if (!e.auth || e.auth.collection().name !== COLLECTIONS.staffUsers) {
    throw new UnauthorizedError('請先登入後台')
  }
  if (!e.auth.getBool('active')) {
    throw new ForbiddenError('帳號未啟用')
  }
  if (!e.auth.getBool('is_staff') && !e.auth.getBool('is_admin')) {
    throw new ForbiddenError('無權限')
  }
  return e.auth
}

function requireAdminAuth(e) {
  var staff = requireStaffAuth(e)
  if (!staff.getBool('is_admin')) {
    throw new ForbiddenError('需要管理員權限')
  }
  return staff
}

function validateRegisterInput(data) {
  var errors = {}
  var name = trimStr(data.name)
  var studentNo = trimStr(data.student_no)
  var identityNumber = upperStr(data.identity_number)
  var email = trimStr(data.email)
  var phone = trimStr(data.phone)
  var departmentName = trimStr(data.department_name)
  var grade = trimStr(data.grade)
  var gender = trimStr(data.gender)
  var bankRegistered = !!data.bank_account_registered
  var bankNote = trimStr(data.bank_account_note)

  if (!name) errors.name = '必填'
  if (!studentNo || studentNo.length > 32) errors.student_no = '學號無效'
  if (!identityNumber || identityNumber.length < 4 || identityNumber.length > 32) {
    errors.identity_number = '身分證件號碼無效'
  }
  if (!email || email.indexOf('@') < 1) errors.email = 'Email 無效'
  if (!phone || phone.length < 8 || phone.length > 20) errors.phone = '電話無效'
  if (!departmentName) errors.department_name = '必填'
  if (!grade) errors.grade = '必填'
  if (gender && ['male', 'female', 'other'].indexOf(gender) < 0) errors.gender = '無效'
  if (!bankRegistered && !bankNote) errors.bank_account_note = '請說明無法提供銀行帳號原因'

  return {
    ok: Object.keys(errors).length === 0,
    errors: errors,
    value: {
      name: name,
      student_no: studentNo,
      identity_number: identityNumber,
      identity_last4: getIdentityLast4(identityNumber),
      email: email,
      phone: phone,
      department_name: departmentName,
      grade: grade,
      gender: gender || '',
      program_type: trimStr(data.program_type),
      division: trimStr(data.division),
      line_id: trimStr(data.line_id),
      bank_account_registered: bankRegistered,
      bank_account_note: bankNote,
    },
  }
}

function dateToMs(value) {
  if (!value) return NaN
  try {
    if (value.unixTime) return value.unixTime() * 1000
    if (value.time) return value.time().unix() * 1000
  } catch (_) {}
  var parsed = Date.parse(String(value))
  return parsed
}

function periodToPlain(record) {
  return {
    id: record.id,
    name: record.getString('name'),
    academic_year: record.getInt('academic_year'),
    semester: record.getString('semester'),
    start_at: String(record.get('start_at') || ''),
    end_at: String(record.get('end_at') || ''),
    status: record.getString('status'),
    active: record.getBool('active'),
    sort_order: record.getInt('sort_order') || 0,
    description: record.getString('description') || null,
    min_application_count: record.getInt('min_application_count') || 2,
    min_application_rule: record.getString('min_application_rule') || 'warning_only',
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function comparePeriodsForLatest(a, b) {
  if (a.academic_year !== b.academic_year) return b.academic_year - a.academic_year
  if (a.semester !== b.semester) return Number(b.semester) - Number(a.semester)
  var startDiff = dateToMs(b.start_at) - dateToMs(a.start_at)
  if (startDiff !== 0) return startDiff
  return (b.sort_order || 0) - (a.sort_order || 0)
}

function listActivePeriods(app) {
  return app.findRecordsByFilter(
    COLLECTIONS.applicationPeriods,
    'active = true',
    '-academic_year,-start_at,-sort_order',
    200,
    0,
  )
}

function pickLatestPeriodRecords(records) {
  if (!records || records.length === 0) return null
  var plains = []
  for (var i = 0; i < records.length; i++) {
    plains.push({ record: records[i], plain: periodToPlain(records[i]) })
  }
  plains.sort(function (x, y) {
    return comparePeriodsForLatest(x.plain, y.plain)
  })
  return plains[0]
}

function getLatestVisiblePeriodRecord(app) {
  var all = listActivePeriods(app)
  var visible = []
  for (var i = 0; i < all.length; i++) {
    if (all[i].getString('status') !== 'draft') visible.push(all[i])
  }
  var picked = pickLatestPeriodRecords(visible)
  return picked ? picked.record : null
}

function isPeriodEditableNow(periodRecord, nowMs) {
  if (!periodRecord.getBool('active')) return false
  if (periodRecord.getString('status') !== 'open') return false
  var start = dateToMs(periodRecord.get('start_at'))
  var end = dateToMs(periodRecord.get('end_at'))
  if (isNaN(start) || isNaN(end)) return false
  return nowMs >= start && nowMs <= end
}

function getCurrentOpenPeriodRecord(app) {
  var latest = getLatestVisiblePeriodRecord(app)
  if (!latest) return null
  if (!isPeriodEditableNow(latest, Date.now())) return null
  return latest
}

function assertCurrentEditablePeriod(app, periodId) {
  var current = getCurrentOpenPeriodRecord(app)
  if (!current || current.id !== periodId) {
    throw new ForbiddenError('目前不可編輯此申請梯次')
  }
  return current
}

function findPreviousPeriodRecord(app, currentRecord) {
  var all = listActivePeriods(app)
  var currentPlain = periodToPlain(currentRecord)
  var older = []
  for (var i = 0; i < all.length; i++) {
    var p = all[i]
    if (p.id === currentRecord.id) continue
    if (p.getString('status') === 'draft') continue
    var plain = periodToPlain(p)
    // older if compare(current, plain) < 0 means plain is older? 
    // compare(a,b)=b-a years: compare(current, plain)=plain.year-current.year
    // if plain older: negative. Yes.
    if (comparePeriodsForLatest(currentPlain, plain) < 0) {
      older.push(p)
    }
  }
  var picked = pickLatestPeriodRecords(older)
  return picked ? picked.record : null
}

function studentHasHistory(app, studentId, excludePeriodId) {
  try {
    var profiles = app.findRecordsByFilter(
      COLLECTIONS.periodStudentProfiles,
      excludePeriodId
        ? 'student = {:sid} && period != {:pid}'
        : 'student = {:sid}',
      '-created',
      1,
      0,
      { sid: studentId, pid: excludePeriodId || '' },
    )
    if (profiles.length > 0) return true
  } catch (_) {}
  try {
    var entries = app.findRecordsByFilter(
      COLLECTIONS.studentCategoryEntries,
      excludePeriodId
        ? 'student = {:sid} && period != {:pid}'
        : 'student = {:sid}',
      '-created',
      1,
      0,
      { sid: studentId, pid: excludePeriodId || '' },
    )
    if (entries.length > 0) return true
  } catch (_) {}
  return false
}

function maskIdentityNumber(identityNumber) {
  var value = trimStr(identityNumber)
  if (value.length < 6) {
    return '*'.repeat(Math.max(value.length, 4))
  }
  return value.slice(0, 4) + '*'.repeat(Math.max(value.length - 5, 1)) + value.slice(-1)
}

function categoryToPlain(record) {
  return {
    id: record.id,
    code: record.getString('code'),
    name: record.getString('name'),
    description: record.getString('description') || null,
    active: record.getBool('active'),
    sort_order: record.getInt('sort_order') || 0,
    allow_copy_previous: record.getBool('allow_copy_previous'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd
}

function hasOverlappingOpenPeriod(app, candidate, excludeId) {
  if (candidate.status !== 'open' || !candidate.active) return false
  var all = listActivePeriods(app)
  var cStart = dateToMs(candidate.start_at)
  var cEnd = dateToMs(candidate.end_at)
  for (var i = 0; i < all.length; i++) {
    var p = all[i]
    if (excludeId && p.id === excludeId) continue
    if (!p.getBool('active') || p.getString('status') !== 'open') continue
    var s = dateToMs(p.get('start_at'))
    var e = dateToMs(p.get('end_at'))
    if (rangesOverlap(cStart, cEnd, s, e)) return true
  }
  return false
}

function periodProfileToPlain(record) {
  var types = record.get('application_identity_types')
  if (typeof types === 'string') {
    try {
      types = JSON.parse(types)
    } catch (_) {
      types = []
    }
  }
  if (!Array.isArray(types)) types = []
  return {
    id: record.id,
    student: record.getString('student'),
    period: record.getString('period'),
    grade: record.getString('grade') || null,
    application_identity_types: types,
    disability_level: record.getString('disability_level') || null,
    weak_aid_level: record.getString('weak_aid_level') || null,
    has_applied_before: record.getBool('has_applied_before'),
    bank_account_registered: record.getBool('bank_account_registered'),
    bank_account_note: record.getString('bank_account_note') || null,
    qualification_note: record.getString('qualification_note') || null,
    confirmed_at: record.get('confirmed_at') ? String(record.get('confirmed_at')) : null,
    source_period: record.getString('source_period') || null,
    copied_from_previous: record.getBool('copied_from_previous'),
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

module.exports = {
  COLLECTIONS: COLLECTIONS,
  trimStr: trimStr,
  upperStr: upperStr,
  getIdentityLast4: getIdentityLast4,
  studentInternalEmail: studentInternalEmail,
  writeAudit: writeAudit,
  requestMeta: requestMeta,
  isLocked: isLocked,
  addMinutesIso: addMinutesIso,
  nowIso: nowIso,
  requireStaffAuth: requireStaffAuth,
  requireAdminAuth: requireAdminAuth,
  validateRegisterInput: validateRegisterInput,
  dateToMs: dateToMs,
  periodToPlain: periodToPlain,
  comparePeriodsForLatest: comparePeriodsForLatest,
  getLatestVisiblePeriodRecord: getLatestVisiblePeriodRecord,
  getCurrentOpenPeriodRecord: getCurrentOpenPeriodRecord,
  isPeriodEditableNow: isPeriodEditableNow,
  assertCurrentEditablePeriod: assertCurrentEditablePeriod,
  findPreviousPeriodRecord: findPreviousPeriodRecord,
  studentHasHistory: studentHasHistory,
  hasOverlappingOpenPeriod: hasOverlappingOpenPeriod,
  periodProfileToPlain: periodProfileToPlain,
  listActivePeriods: listActivePeriods,
  maskIdentityNumber: maskIdentityNumber,
  categoryToPlain: categoryToPlain,
}
