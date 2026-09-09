/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/api/had/student/me', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }

  const student = e.auth
  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentProfiles,
      'student = {:sid}',
      { sid: student.id },
    )
  } catch (_) {
    throw new NotFoundError('找不到學生資料')
  }

  return e.json(200, {
    student: {
      id: student.id,
      student_no: student.getString('student_no'),
      active: student.getBool('active'),
      last_login_at: student.get('last_login_at') || null,
    },
    profile: {
      id: profile.id,
      student: profile.getString('student'),
      name: profile.getString('name'),
      identity_number: profile.getString('identity_number'),
      gender: profile.getString('gender') || null,
      department_name: profile.getString('department_name'),
      program_type: profile.getString('program_type') || null,
      division: profile.getString('division') || null,
      grade: profile.getString('grade'),
      phone: profile.getString('phone'),
      line_id: profile.getString('line_id') || null,
      email: profile.getString('email'),
      bank_account_registered: profile.getBool('bank_account_registered'),
      bank_account_note: profile.getString('bank_account_note') || null,
      updated_by_student_at: profile.get('updated_by_student_at') || null,
    },
  })
}, $apis.requireAuth('had_students'))

routerAdd('POST', '/api/had/student/profile/update', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }

  const data = new DynamicModel({
    name: '',
    gender: '',
    division: '',
    program_type: '',
    grade: '',
    department_name: '',
    phone: '',
    line_id: '',
    email: '',
    bank_account_registered: false,
    bank_account_note: '',
  })
  e.bindBody(data)

  const name = h.trimStr(data.name)
  const email = h.trimStr(data.email)
  const phone = h.trimStr(data.phone)
  const departmentName = h.trimStr(data.department_name)
  const grade = h.trimStr(data.grade)
  const gender = h.trimStr(data.gender)
  const bankRegistered = !!data.bank_account_registered
  const bankNote = h.trimStr(data.bank_account_note)

  if (!name || !email || !phone || !departmentName || !grade) {
    throw new BadRequestError('資料更新失敗，請稍後再試。')
  }
  if (gender && ['male', 'female', 'other'].indexOf(gender) < 0) {
    throw new BadRequestError('資料更新失敗，請稍後再試。')
  }
  if (!bankRegistered && !bankNote) {
    throw new BadRequestError('請說明無法提供銀行帳號原因')
  }

  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentProfiles,
      'student = {:sid}',
      { sid: e.auth.id },
    )
  } catch (_) {
    throw new NotFoundError('找不到學生資料')
  }

  // Ownership from session only — never trust client student_id.
  if (profile.getString('student') !== e.auth.id) {
    throw new ForbiddenError('無權限')
  }

  profile.set('name', name)
  if (gender) profile.set('gender', gender)
  else profile.set('gender', '')
  profile.set('division', h.trimStr(data.division))
  profile.set('program_type', h.trimStr(data.program_type))
  profile.set('grade', grade)
  profile.set('department_name', departmentName)
  profile.set('phone', phone)
  profile.set('line_id', h.trimStr(data.line_id))
  profile.set('email', email)
  profile.set('bank_account_registered', bankRegistered)
  profile.set('bank_account_note', bankNote)
  profile.set('updated_by_student_at', h.nowIso())
  // identity_number and student relation intentionally untouched

  e.app.save(profile)

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: e.auth.id,
      action: 'STUDENT_PROFILE_UPDATED',
      target_type: 'had_student_profiles',
      target_id: profile.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
    })
  } catch (_) {}

  return e.json(200, {
    success: true,
    profile: {
      id: profile.id,
      student: profile.getString('student'),
      name: profile.getString('name'),
      identity_number: profile.getString('identity_number'),
      gender: profile.getString('gender') || null,
      department_name: profile.getString('department_name'),
      program_type: profile.getString('program_type') || null,
      division: profile.getString('division') || null,
      grade: profile.getString('grade'),
      phone: profile.getString('phone'),
      line_id: profile.getString('line_id') || null,
      email: profile.getString('email'),
      bank_account_registered: profile.getBool('bank_account_registered'),
      bank_account_note: profile.getString('bank_account_note') || null,
      updated_by_student_at: profile.get('updated_by_student_at') || null,
    },
  })
}, $apis.requireAuth('had_students'))
