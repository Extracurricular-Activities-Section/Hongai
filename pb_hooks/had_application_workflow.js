/**
 * Application status state machine + staff scope helpers.
 */

var ALLOWED_TRANSITIONS = {
  submitted: ['eligibility_review'],
  eligibility_review: ['supplement_required', 'under_review', 'rejected'],
  under_review: ['supplement_required', 'returned_for_edit', 'approved', 'rejected'],
  supplement_required: ['under_review', 'returned_for_edit', 'rejected'],
  returned_for_edit: ['submitted'],
  approved: ['funding_pending'],
  funding_pending: ['funding_decided'],
  funding_decided: ['closed', 'funding_pending'],
  rejected: [],
  closed: [],
}

var ACTION_TRANSITIONS = {
  start_eligibility_review: { from: ['submitted'], to: 'eligibility_review' },
  qualify_eligibility: { from: ['eligibility_review'], to: 'under_review' },
  disqualify_eligibility: { from: ['eligibility_review', 'under_review'], to: 'rejected' },
  request_supplement: {
    from: ['eligibility_review', 'under_review'],
    to: 'supplement_required',
  },
  accept_supplement: { from: ['supplement_required'], to: 'under_review' },
  return_for_edit: { from: ['under_review', 'supplement_required'], to: 'returned_for_edit' },
  approve: { from: ['under_review'], to: 'approved' },
  reject: { from: ['eligibility_review', 'under_review', 'supplement_required'], to: 'rejected' },
  begin_funding: { from: ['approved'], to: 'funding_pending' },
  decide_funding: { from: ['funding_pending'], to: 'funding_decided' },
  revise_funding: { from: ['funding_decided'], to: 'funding_pending' },
  close: { from: ['funding_decided'], to: 'closed' },
  resubmit: { from: ['returned_for_edit'], to: 'submitted' },
}

var FROZEN_STATUSES = [
  'submitted',
  'eligibility_review',
  'under_review',
  'supplement_required',
  'approved',
  'rejected',
  'funding_pending',
  'funding_decided',
  'closed',
]

var STATUS_LABELS = {
  submitted: '已送件',
  eligibility_review: '資格審核中',
  under_review: '內容審核中',
  supplement_required: '待補件',
  returned_for_edit: '退回修改',
  approved: '審核通過',
  rejected: '不通過',
  funding_pending: '待核定',
  funding_decided: '已核定',
  closed: '已結案',
}

var ELIGIBILITY_LABELS = {
  pending: '待審核',
  qualified: '資格符合',
  supplement_required: '資格待補件',
  disqualified: '資格不符',
}

function canTransition(fromStatus, toStatus) {
  var list = ALLOWED_TRANSITIONS[fromStatus] || []
  return list.indexOf(toStatus) >= 0
}

function resolveAction(action, currentStatus) {
  var def = ACTION_TRANSITIONS[action]
  if (!def) throw new BadRequestError('未知操作：' + action)
  if (def.from.indexOf(currentStatus) < 0) {
    throw new BadRequestError('目前狀態不可執行此操作')
  }
  if (!canTransition(currentStatus, def.to)) {
    throw new BadRequestError('非法狀態轉換')
  }
  return def.to
}

function isSubmissionFrozen(applicationStatus) {
  return FROZEN_STATUSES.indexOf(applicationStatus) >= 0
}

function staffDepartmentIds(app, h, staffId) {
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.staffDepartments,
    'staff = {:sid} && active = true',
    '-created',
    100,
    0,
    { sid: staffId },
  )
  var ids = []
  for (var i = 0; i < rows.length; i++) ids.push(rows[i].getString('department'))
  return ids
}

function canStaffAccessApplication(app, h, staffRecord, applicationId) {
  if (staffRecord.getBool('is_admin')) return true
  var application = app.findRecordById(h.COLLECTIONS.applications, applicationId)
  var staffId = staffRecord.id

  var direct = app.findRecordsByFilter(
    h.COLLECTIONS.applicationStaffAssignments,
    'application = {:aid} && staff = {:sid} && active = true',
    '-created',
    1,
    0,
    { aid: applicationId, sid: staffId },
  )
  if (direct.length > 0) return true

  var deptIds = staffDepartmentIds(app, h, staffId)
  if (!deptIds.length) return false

  var currentDept = application.getString('current_department')
  if (currentDept && deptIds.indexOf(currentDept) >= 0) return true

  for (var i = 0; i < deptIds.length; i++) {
    var deptAssign = app.findRecordsByFilter(
      h.COLLECTIONS.applicationStaffAssignments,
      'application = {:aid} && department = {:did} && active = true',
      '-created',
      1,
      0,
      { aid: applicationId, did: deptIds[i] },
    )
    if (deptAssign.length > 0) return true
  }
  return false
}

function assertStaffCanAccessApplication(app, h, staffRecord, applicationId) {
  if (!canStaffAccessApplication(app, h, staffRecord, applicationId)) {
    throw new ForbiddenError('無權限存取此案件')
  }
}

module.exports = {
  ALLOWED_TRANSITIONS: ALLOWED_TRANSITIONS,
  ACTION_TRANSITIONS: ACTION_TRANSITIONS,
  FROZEN_STATUSES: FROZEN_STATUSES,
  STATUS_LABELS: STATUS_LABELS,
  ELIGIBILITY_LABELS: ELIGIBILITY_LABELS,
  canTransition: canTransition,
  resolveAction: resolveAction,
  isSubmissionFrozen: isSubmissionFrozen,
  staffDepartmentIds: staffDepartmentIds,
  canStaffAccessApplication: canStaffAccessApplication,
  assertStaffCanAccessApplication: assertStaffCanAccessApplication,
}
