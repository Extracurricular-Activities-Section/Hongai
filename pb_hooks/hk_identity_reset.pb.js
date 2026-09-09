/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/hk/identity-reset', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const data = new DynamicModel({
    name: '',
    student_no: '',
    email: '',
    phone: '',
    reason: '',
  })
  e.bindBody(data)

  const name = h.trimStr(data.name)
  const studentNo = h.trimStr(data.student_no)
  const email = h.trimStr(data.email)
  const phone = h.trimStr(data.phone)
  const reason = h.trimStr(data.reason)

  const uniform = '已收到申請，如資料可核對，承辦人員將協助處理。'

  if (!name || !studentNo || !email || !phone || !reason) {
    // Still uniform — avoid leaking validation detail that aids enumeration.
    throw new BadRequestError(uniform)
  }

  let createdStudentId = ''
  try {
    const existing = e.app.findFirstRecordByData(h.COLLECTIONS.students, 'student_no', studentNo)
    createdStudentId = existing.id
  } catch (_) {
    // do not reveal existence
  }

  const collection = e.app.findCollectionByNameOrId(h.COLLECTIONS.identityResetRequests)
  const record = new Record(collection)
  record.set('student_no', studentNo)
  record.set('name', name)
  record.set('email', email)
  record.set('phone', phone)
  record.set('reason', reason)
  record.set('status', 'pending')
  if (createdStudentId) {
    record.set('created_student', createdStudentId)
  }
  e.app.save(record)

  try {
    h.writeAudit(e.app, {
      actor_type: 'system',
      action: 'IDENTITY_RESET_REQUESTED',
      target_type: 'hk_identity_reset_requests',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: createdStudentId ? { linked: true } : { linked: false },
    })
  } catch (_) {}

  return e.json(200, { message: uniform })
})

routerAdd('GET', '/api/hk/admin/identity-resets', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  h.requireStaffAuth(e)

  const status = e.request.url.query().get('status') || ''
  let filter = 'id != ""'
  const params = {}
  if (status) {
    filter = 'status = {:status}'
    params.status = status
  }

  const records = e.app.findRecordsByFilter(
    h.COLLECTIONS.identityResetRequests,
    filter,
    '-created',
    100,
    0,
    params,
  )

  const items = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    items.push({
      id: r.id,
      student_no: r.getString('student_no'),
      name: r.getString('name'),
      email: r.getString('email'),
      phone: r.getString('phone'),
      reason: r.getString('reason'),
      status: r.getString('status'),
      resolution_note: r.getString('resolution_note') || null,
      resolved_at: r.get('resolved_at') || null,
      created: r.get('created'),
      created_student: r.getString('created_student') || null,
    })
  }

  return e.json(200, { items: items })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('POST', '/api/hk/admin/identity-resets/{id}/status', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const staff = h.requireStaffAuth(e)
  const id = e.request.pathValue('id')
  const data = new DynamicModel({
    status: '',
    resolution_note: '',
  })
  e.bindBody(data)

  const status = h.trimStr(data.status)
  const allowed = ['pending', 'processing', 'approved', 'rejected', 'closed']
  if (allowed.indexOf(status) < 0) {
    throw new BadRequestError('狀態無效')
  }

  const record = e.app.findRecordById(h.COLLECTIONS.identityResetRequests, id)
  record.set('status', status)
  record.set('resolution_note', h.trimStr(data.resolution_note))
  record.set('resolved_by', staff.id)
  record.set('resolved_at', h.nowIso())
  e.app.save(record)

  try {
    h.writeAudit(e.app, {
      actor_type: staff.getBool('is_admin') ? 'admin' : 'staff',
      actor_staff: staff.id,
      action: 'IDENTITY_RESET_STATUS_CHANGED',
      target_type: 'hk_identity_reset_requests',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { status: status },
    })
  } catch (_) {}

  if (status === 'approved' || status === 'rejected' || status === 'closed') {
    try {
      const notif = require(`${__hooks}/hk_notification_service.js`)
      var studentId = record.getString('created_student')
      if (studentId) {
        var statusLabels = {
          approved: '已核准',
          rejected: '未核准',
          closed: '已結案',
        }
        notif.safeEmitNotificationEvent(e.app, h, 'IDENTITY_RESET_PROCESSED', {
          studentId: studentId,
          idempotencyKey: 'identity_reset:' + record.id + ':' + status,
          variables: {
            student_name:
              notif.loadStudentName(e.app, h, studentId) || record.getString('name') || '',
            reset_status_label: statusLabels[status] || status,
            student_message: h.trimStr(data.resolution_note),
          },
        })
      }
    } catch (_) {}
  }

  return e.json(200, { success: true })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('POST', '/api/hk/admin/students/{id}/unlock', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const admin = h.requireAdminAuth(e)
  const id = e.request.pathValue('id')

  const student = e.app.findRecordById(h.COLLECTIONS.students, id)
  student.set('failed_login_count', 0)
  student.set('locked_until', '')
  e.app.save(student)

  try {
    h.writeAudit(e.app, {
      actor_type: 'admin',
      actor_staff: admin.id,
      action: 'STUDENT_UNLOCKED',
      target_type: 'hk_students',
      target_id: student.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
    })
  } catch (_) {}

  return e.json(200, { success: true })
}, $apis.requireAuth('hk_staff_users'))
