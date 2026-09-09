/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/had/auth/register', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const data = new DynamicModel({
    name: '',
    student_no: '',
    identity_number: '',
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

  const validated = h.validateRegisterInput(data)
  if (!validated.ok) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'system',
        action: 'STUDENT_REGISTER_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'validation' },
      })
    } catch (_) {}
    throw new BadRequestError('註冊資料不完整或格式錯誤', validated.errors)
  }

  const v = validated.value

  // Duplicate check (uniform message — avoid leaking which field collided if possible)
  try {
    e.app.findFirstRecordByData(h.COLLECTIONS.students, 'student_no', v.student_no)
    try {
      h.writeAudit(e.app, {
        actor_type: 'system',
        action: 'STUDENT_REGISTER_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'duplicate_student_no' },
      })
    } catch (_) {}
    throw new BadRequestError('註冊失敗，請確認資料後再試或聯絡承辦。')
  } catch (err) {
    if (err instanceof BadRequestError) throw err
    // not found — ok
  }

  let studentId = ''

  try {
    e.app.runInTransaction((txApp) => {
      const studentsCol = txApp.findCollectionByNameOrId(h.COLLECTIONS.students)
      const profilesCol = txApp.findCollectionByNameOrId(h.COLLECTIONS.studentProfiles)

      const student = new Record(studentsCol)
      student.setEmail(h.studentInternalEmail(v.student_no))
      // Unpredictable internal credential — never returned to the client; students do not use password login.
      student.setRandomPassword()
      student.set('student_no', v.student_no)
      student.set('identity_last4', v.identity_last4)
      student.set('active', true)
      student.set('failed_login_count', 0)
      student.set('registered_at', h.nowIso())
      student.setVerified(true)
      txApp.save(student)

      studentId = student.id

      const profile = new Record(profilesCol)
      profile.set('student', student.id)
      profile.set('name', v.name)
      profile.set('identity_number', v.identity_number)
      if (v.gender) profile.set('gender', v.gender)
      profile.set('department_name', v.department_name)
      if (v.program_type) profile.set('program_type', v.program_type)
      if (v.division) profile.set('division', v.division)
      profile.set('grade', v.grade)
      profile.set('phone', v.phone)
      if (v.line_id) profile.set('line_id', v.line_id)
      profile.set('email', v.email)
      profile.set('bank_account_registered', v.bank_account_registered)
      if (v.bank_account_note) profile.set('bank_account_note', v.bank_account_note)
      txApp.save(profile)
    })
  } catch (err) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'system',
        action: 'STUDENT_REGISTER_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'persist_failed' },
      })
    } catch (_) {}
    throw new BadRequestError('註冊失敗，請稍後再試或聯絡承辦。')
  }

  const student = e.app.findRecordById(h.COLLECTIONS.students, studentId)
  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'STUDENT_REGISTER_SUCCESS',
      target_type: 'had_students',
      target_id: student.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { student_no: v.student_no },
    })
  } catch (_) {}

  // Auto-login after successful registration (official auth response).
  return $apis.recordAuthResponse(e, student, 'had_register')
}, $apis.requireGuestOnly())

routerAdd('POST', '/api/had/auth/login', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const data = new DynamicModel({
    student_no: '',
    identity_last4: '',
  })
  e.bindBody(data)

  const studentNo = h.trimStr(data.student_no)
  const last4 = h.upperStr(data.identity_last4)
  const genericError = '學號或身分驗證資料錯誤。'
  const lockedMessage = '登入失敗次數過多，請稍後再試或聯絡承辦。'

  if (!studentNo || !/^[0-9A-Za-z]{4}$/.test(last4)) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'system',
        action: 'STUDENT_LOGIN_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'invalid_input' },
      })
    } catch (_) {}
    throw new BadRequestError(genericError)
  }

  let student = null
  try {
    student = e.app.findFirstRecordByData(h.COLLECTIONS.students, 'student_no', studentNo)
  } catch (_) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'system',
        action: 'STUDENT_LOGIN_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'not_found_or_mismatch' },
      })
    } catch (_) {}
    throw new BadRequestError(genericError)
  }

  const nowMs = Date.now()
  if (!student.getBool('active')) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'STUDENT_LOGIN_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'inactive' },
      })
    } catch (_) {}
    throw new BadRequestError(genericError)
  }

  if (h.isLocked(student, nowMs)) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'STUDENT_LOGIN_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'locked' },
      })
    } catch (_) {}
    throw new BadRequestError(lockedMessage)
  }

  const expected = h.upperStr(student.getString('identity_last4'))
  if (expected !== last4) {
    const fails = (student.getInt('failed_login_count') || 0) + 1
    student.set('failed_login_count', fails)
    if (fails >= 5) {
      student.set('locked_until', h.addMinutesIso(15))
      try {
        h.writeAudit(e.app, {
          actor_type: 'student',
          actor_student: student.id,
          action: 'STUDENT_LOCKED',
          target_type: 'had_students',
          target_id: student.id,
          ip: meta.ip,
          user_agent: meta.user_agent,
          metadata: { failed_login_count: fails },
        })
      } catch (_) {}
    }
    e.app.save(student)
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'STUDENT_LOGIN_FAILED',
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { reason: 'mismatch', failed_login_count: fails },
      })
    } catch (_) {}
    if (fails >= 5) {
      throw new BadRequestError(lockedMessage)
    }
    throw new BadRequestError(genericError)
  }

  student.set('failed_login_count', 0)
  student.set('locked_until', '')
  student.set('last_login_at', h.nowIso())
  e.app.save(student)

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'STUDENT_LOGIN_SUCCESS',
      target_type: 'had_students',
      target_id: student.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { student_no: studentNo },
    })
  } catch (_) {}

  return $apis.recordAuthResponse(e, student, 'had_student_no_last4')
}, $apis.requireGuestOnly())

routerAdd('POST', '/api/had/auth/logout', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  if (e.auth && e.auth.collection().name === h.COLLECTIONS.students) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: e.auth.id,
        action: 'STUDENT_LOGOUT',
        target_type: 'had_students',
        target_id: e.auth.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}
  }
  return e.json(200, { success: true })
}, $apis.requireAuth('had_students'))
