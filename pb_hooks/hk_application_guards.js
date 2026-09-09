/**
 * Submission edit guards based on application freeze state.
 * Wired into hk_forms.pb.js separately.
 */

function getBlockingApplicationForSubmission(app, h, studentId, periodId, categoryId) {
  const workflow = require(`${__hooks}/hk_application_workflow.js`)
  var existing = null
  try {
    existing = app.findFirstRecordByFilter(
      h.COLLECTIONS.applications,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: studentId, pid: periodId, cid: categoryId },
    )
  } catch (_) {
    return null
  }
  if (!existing) return null

  var status = existing.getString('status')
  var period = null
  try {
    period = app.findRecordById(h.COLLECTIONS.applicationPeriods, periodId)
  } catch (_) {}
  var periodEditable = period ? h.isPeriodEditableNow(period, Date.now()) : false
  var overrideUntil = existing.get('edit_override_until')
  var overrideOk = false
  if (overrideUntil) {
    var untilMs = h.dateToMs(overrideUntil)
    overrideOk = !isNaN(untilMs) && Date.now() <= untilMs
  }

  if (status === 'returned_for_edit') {
    if (periodEditable || overrideOk) return null
    return existing
  }

  if (workflow.isSubmissionFrozen(status)) {
    return existing
  }

  return null
}

function assertStudentCanEditSubmission(app, h, studentId, periodId, categoryId) {
  var blocking = getBlockingApplicationForSubmission(app, h, studentId, periodId, categoryId)
  if (blocking) {
    throw new ForbiddenError('此申請已送件或目前不可編輯，表單已鎖定')
  }
}

/** Period must be open, or application is returned_for_edit with valid edit_override_until. */
function assertPeriodEditableOrApplicationOverride(app, h, studentId, periodId, categoryId) {
  try {
    h.assertCurrentEditablePeriod(app, periodId)
    return
  } catch (_) {}

  var existing = null
  try {
    existing = app.findFirstRecordByFilter(
      h.COLLECTIONS.applications,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: studentId, pid: periodId, cid: categoryId },
    )
  } catch (_) {
    existing = null
  }
  if (!existing || existing.getString('status') !== 'returned_for_edit') {
    throw new ForbiddenError('目前不可編輯此申請梯次')
  }
  var overrideUntil = existing.get('edit_override_until')
  if (!overrideUntil) {
    throw new ForbiddenError('申請已截止，請聯絡承辦延長修改期限')
  }
  var untilMs = h.dateToMs(overrideUntil)
  if (isNaN(untilMs) || Date.now() > untilMs) {
    throw new ForbiddenError('個別延長修改期限已過')
  }
}

module.exports = {
  getBlockingApplicationForSubmission: getBlockingApplicationForSubmission,
  assertStudentCanEditSubmission: assertStudentCanEditSubmission,
  assertPeriodEditableOrApplicationOverride: assertPeriodEditableOrApplicationOverride,
}
