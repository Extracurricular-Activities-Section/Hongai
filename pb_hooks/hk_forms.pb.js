/// <reference path="../pb_data/types.d.ts" />

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

function loadSchemaBundle(app, h, versionId) {
  const engine = require(`${__hooks}/hk_form_engine.js`)
  const version = app.findRecordById(h.COLLECTIONS.formVersions, versionId)
  const form = app.findRecordById(h.COLLECTIONS.forms, version.getString('form'))
  const category = app.findRecordById(h.COLLECTIONS.applicationCategories, form.getString('category'))

  const sections = app.findRecordsByFilter(
    h.COLLECTIONS.formSections,
    'form_version = {:vid}',
    'sort_order',
    100,
    0,
    { vid: versionId },
  )

  const sectionItems = []
  const flatFields = []
  for (var s = 0; s < sections.length; s++) {
    const section = sections[s]
    const fields = app.findRecordsByFilter(
      h.COLLECTIONS.formFields,
      'section = {:sid}',
      'sort_order',
      200,
      0,
      { sid: section.id },
    )
    const fieldItems = []
    for (var f = 0; f < fields.length; f++) {
      const field = fields[f]
      const options = app.findRecordsByFilter(
        h.COLLECTIONS.formFieldOptions,
        'field = {:fid} && active = true',
        'sort_order',
        100,
        0,
        { fid: field.id },
      )
      const optionItems = []
      for (var o = 0; o < options.length; o++) {
        optionItems.push({
          id: options[o].id,
          value: options[o].getString('value'),
          label: options[o].getString('label'),
          sort_order: options[o].getInt('sort_order') || 0,
          active: options[o].getBool('active'),
        })
      }
      const fieldPlain = {
        id: field.id,
        code: field.getString('code'),
        label: field.getString('label'),
        field_type: field.getString('field_type'),
        help_text: field.getString('help_text') || null,
        placeholder: field.getString('placeholder') || null,
        required: field.getBool('required'),
        sort_order: field.getInt('sort_order') || 0,
        default_value: parseJsonMaybe(field.get('default_value')),
        validation: parseJsonMaybe(field.get('validation')),
        config: parseJsonMaybe(field.get('config')),
        pdf_visible: field.getBool('pdf_visible'),
        copy_previous: field.getBool('copy_previous'),
        active: field.getBool('active'),
        options: optionItems,
      }
      fieldItems.push(fieldPlain)
      flatFields.push(fieldPlain)
    }
    sectionItems.push({
      id: section.id,
      code: section.getString('code'),
      title: section.getString('title'),
      description: section.getString('description') || null,
      sort_order: section.getInt('sort_order') || 0,
      visible: section.getBool('visible'),
      pdf_visible: section.getBool('pdf_visible'),
      fields: fieldItems,
    })
  }

  const rules = app.findRecordsByFilter(
    h.COLLECTIONS.formRules,
    'form_version = {:vid}',
    'sort_order',
    200,
    0,
    { vid: versionId },
  )
  const ruleItems = []
  for (var r = 0; r < rules.length; r++) {
    const rule = rules[r]
    let fieldCode = ''
    try {
      const fr = app.findRecordById(h.COLLECTIONS.formFields, rule.getString('field'))
      fieldCode = fr.getString('code')
    } catch (_) {}
    ruleItems.push({
      id: rule.id,
      field_id: rule.getString('field'),
      field_code: fieldCode,
      rule_type: rule.getString('rule_type'),
      source_field_code: rule.getString('source_field_code'),
      operator: rule.getString('operator'),
      value: parseJsonMaybe(rule.get('value')),
      sort_order: rule.getInt('sort_order') || 0,
    })
  }

  return {
    engine: engine,
    form: form,
    version: version,
    category: category,
    fields: flatFields,
    rules: ruleItems,
    schema: {
      form: {
        id: form.id,
        name: form.getString('name'),
        description: form.getString('description') || null,
        category_id: category.id,
        category_code: category.getString('code'),
        category_name: category.getString('name'),
      },
      version: {
        id: version.id,
        version_number: version.getInt('version_number'),
        status: version.getString('status'),
      },
      sections: sectionItems,
      rules: ruleItems,
    },
  }
}

function loadAnswersMap(app, h, submissionId) {
  const rows = app.findRecordsByFilter(
    h.COLLECTIONS.formAnswers,
    'submission = {:sid}',
    'field_code',
    500,
    0,
    { sid: submissionId },
  )
  const map = {}
  for (var i = 0; i < rows.length; i++) {
    map[rows[i].getString('field_code')] = parseJsonMaybe(rows[i].get('value'))
  }
  return map
}

function saveAnswersMap(app, h, submissionId, fields, answers) {
  const byCode = {}
  for (var i = 0; i < fields.length; i++) byCode[fields[i].code] = fields[i]
  const keys = Object.keys(answers || {})
  for (var k = 0; k < keys.length; k++) {
    const code = keys[k]
    const field = byCode[code]
    if (!field || !field.active) continue
    if (field.field_type === 'display') continue
    let record = null
    try {
      record = app.findFirstRecordByFilter(
        h.COLLECTIONS.formAnswers,
        'submission = {:sid} && field_code = {:code}',
        { sid: submissionId, code: code },
      )
    } catch (_) {
      const col = app.findCollectionByNameOrId(h.COLLECTIONS.formAnswers)
      record = new Record(col)
      record.set('submission', submissionId)
      record.set('field', field.id)
      record.set('field_code', code)
    }
    record.set('value', answers[code])
    app.save(record)
  }
}

function profileSnapshot(app, h, studentId) {
  try {
    const profile = app.findFirstRecordByFilter(
      h.COLLECTIONS.studentProfiles,
      'student = {:sid}',
      { sid: studentId },
    )
    const student = app.findRecordById(h.COLLECTIONS.students, studentId)
    return {
      name: profile.getString('name'),
      student_no: student.getString('student_no'),
      department_name: profile.getString('department_name'),
      gender: profile.getString('gender'),
      program_type: profile.getString('program_type'),
      division: profile.getString('division'),
      grade: profile.getString('grade'),
      phone: profile.getString('phone'),
      line_id: profile.getString('line_id'),
      email: profile.getString('email'),
      // Full identity for PDF snapshot only; client APIs must strip before return.
      identity_number: profile.getString('identity_number'),
      identity_number_masked: h.maskIdentityNumber(profile.getString('identity_number')),
    }
  } catch (_) {
    return {}
  }
}

function publicApplicantView(snapshot) {
  const copy = Object.assign({}, snapshot || {})
  delete copy.identity_number
  return copy
}

function periodProfileSnapshot(app, h, studentId, periodId) {
  try {
    const profile = app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: studentId, pid: periodId },
    )
    return h.periodProfileToPlain(profile)
  } catch (_) {
    return {}
  }
}

function createSubmissionVersion(app, h, submission, reason, snapshot) {
  const nextNumber = (submission.getInt('current_version_number') || 0) + 1
  const col = app.findCollectionByNameOrId(h.COLLECTIONS.formSubmissionVersions)
  const version = new Record(col)
  version.set('submission', submission.id)
  version.set('version_number', nextNumber)
  version.set('snapshot', snapshot)
  version.set('reason', reason)
  app.save(version)
  submission.set('current_version_number', nextNumber)
  app.save(submission)
  return version
}

function ensureCategoryEntry(app, h, student, period, category) {
  try {
    return app.findFirstRecordByFilter(
      h.COLLECTIONS.studentCategoryEntries,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: period.id, cid: category.id },
    )
  } catch (_) {
    const col = app.findCollectionByNameOrId(h.COLLECTIONS.studentCategoryEntries)
    const entry = new Record(col)
    entry.set('student', student.id)
    entry.set('period', period.id)
    entry.set('category', category.id)
    entry.set('status', 'draft')
    entry.set('last_opened_at', h.nowIso())
    app.save(entry)
    return entry
  }
}

function getOrCreateSubmission(app, h, student, categoryCode) {
  const open = h.getCurrentOpenPeriodRecord(app)
  if (!open) throw new ForbiddenError('目前沒有可申請梯次')

  let periodProfile = null
  try {
    periodProfile = app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {}
  if (!periodProfile || !periodProfile.get('confirmed_at')) {
    throw new ForbiddenError('請先完成本學期資料確認')
  }

  let category = null
  try {
    category = app.findFirstRecordByData(h.COLLECTIONS.applicationCategories, 'code', categoryCode)
  } catch (_) {
    throw new NotFoundError('找不到申請項目')
  }
  if (!category.getBool('active')) throw new ForbiddenError('此申請項目未開放')

  let form = null
  try {
    form = app.findFirstRecordByFilter('hk_forms', 'category = {:cid} && active = true', {
      cid: category.id,
    })
  } catch (_) {
    throw new NotFoundError('找不到表單')
  }

  const publishedId = form.getString('current_published_version')
  if (!publishedId) throw new BadRequestError('表單尚未發布')

  const entry = ensureCategoryEntry(app, h, student, open, category)

  let submission = null
  let created = false
  try {
    submission = app.findFirstRecordByFilter(
      h.COLLECTIONS.formSubmissions,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: open.id, cid: category.id },
    )
  } catch (_) {
    created = true
    const col = app.findCollectionByNameOrId(h.COLLECTIONS.formSubmissions)
    submission = new Record(col)
    submission.set('student', student.id)
    submission.set('period', open.id)
    submission.set('category', category.id)
    submission.set('category_entry', entry.id)
    submission.set('form', form.id)
    submission.set('form_version', publishedId)
    submission.set('status', 'draft')
    submission.set('current_version_number', 0)
    submission.set('last_saved_at', h.nowIso())
    app.save(submission)

    const bundle = loadSchemaBundle(app, h, publishedId)
    const snapshot = {
      formVersion: {
        id: bundle.version.id,
        version_number: bundle.version.getInt('version_number'),
      },
      answers: {},
      computed: {},
      studentProfileSnapshot: profileSnapshot(app, h, student.id),
      periodProfileSnapshot: periodProfileSnapshot(app, h, student.id, open.id),
      category: {
        id: category.id,
        code: category.getString('code'),
        name: category.getString('name'),
      },
      timestamps: { created_at: h.nowIso(), completed_at: null, saved_at: h.nowIso() },
    }
    createSubmissionVersion(app, h, submission, 'other', snapshot)
  }

  entry.set('status', 'draft')
  entry.set('last_opened_at', h.nowIso())
  app.save(entry)

  return { open: open, category: category, form: form, entry: entry, submission: submission, created: created }
}

routerAdd('GET', '/api/hk/forms/by-category/{code}/workspace', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const code = e.request.pathValue('code')
  const ctx = getOrCreateSubmission(e.app, h, student, code)
  if (ctx.created) {
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'FORM_SUBMISSION_CREATED',
        target_type: 'hk_form_submissions',
        target_id: ctx.submission.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { category_code: code, period_id: ctx.open.id },
      })
    } catch (_) {}
  }

  const bundle = loadSchemaBundle(e.app, h, ctx.submission.getString('form_version'))
  const answers = loadAnswersMap(e.app, h, ctx.submission.id)
  const computed = bundle.engine.calculateComputed(bundle.fields, answers)

  return e.json(200, {
    period: h.periodToPlain(ctx.open),
    category: {
      id: ctx.category.id,
      code: ctx.category.getString('code'),
      name: ctx.category.getString('name'),
    },
    submission: {
      id: ctx.submission.id,
      status: ctx.submission.getString('status'),
      current_version_number: ctx.submission.getInt('current_version_number') || 1,
      last_saved_at: ctx.submission.get('last_saved_at')
        ? String(ctx.submission.get('last_saved_at'))
        : null,
      completed_at: ctx.submission.get('completed_at')
        ? String(ctx.submission.get('completed_at'))
        : null,
      form_version: ctx.submission.getString('form_version'),
    },
    schema: bundle.schema,
    answers: computed,
    applicant: publicApplicantView(profileSnapshot(e.app, h, student.id)),
    period_profile: periodProfileSnapshot(e.app, h, student.id, ctx.open.id),
  })
}, $apis.requireAuth('hk_students'))

routerAdd('POST', '/api/hk/forms/submission/save', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const data = new DynamicModel({
    submission_id: '',
    answers: {},
    create_snapshot: false,
  })
  e.bindBody(data)

  const submission = e.app.findRecordById(h.COLLECTIONS.formSubmissions, h.trimStr(data.submission_id))
  if (submission.getString('student') !== student.id) throw new ForbiddenError('無權限')
  const formRec = e.app.findRecordById(h.COLLECTIONS.forms, submission.getString('form'))
  const guards = require(`${__hooks}/hk_application_guards.js`)
  guards.assertStudentCanEditSubmission(
    e.app,
    h,
    student.id,
    submission.getString('period'),
    formRec.getString('category'),
  )
  guards.assertPeriodEditableOrApplicationOverride(
    e.app,
    h,
    student.id,
    submission.getString('period'),
    formRec.getString('category'),
  )

  const bundle = loadSchemaBundle(e.app, h, submission.getString('form_version'))
  const incoming = data.answers || {}
  const allowlisted = {}
  for (var i = 0; i < bundle.fields.length; i++) {
    const field = bundle.fields[i]
    if (!field.active) continue
    if (field.field_type === 'computed' || field.field_type === 'display') continue
    if (Object.prototype.hasOwnProperty.call(incoming, field.code)) {
      allowlisted[field.code] = incoming[field.code]
    }
  }

  const existing = loadAnswersMap(e.app, h, submission.id)
  const merged = Object.assign({}, existing, allowlisted)
  const validated = bundle.engine.validateValues(bundle.fields, bundle.rules, merged, 'draft')
  const hardErrors = validated.issues.filter(function (issue) {
    return issue.severity === 'error' && issue.code !== 'required'
  })
  if (hardErrors.length) {
    return e.json(400, { message: '草稿內容格式有誤', issues: hardErrors })
  }

  saveAnswersMap(e.app, h, submission.id, bundle.fields, validated.values)
  submission.set('last_saved_at', h.nowIso())
  if (submission.getString('status') === 'completed') {
    submission.set('status', 'draft')
    submission.set('completed_at', null)
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'FORM_REOPENED',
        target_type: 'hk_form_submissions',
        target_id: submission.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}
  }
  e.app.save(submission)

  if (data.create_snapshot) {
    createSubmissionVersion(e.app, h, submission, 'manual_save', {
      formVersion: {
        id: bundle.version.id,
        version_number: bundle.version.getInt('version_number'),
      },
      answers: validated.values,
      computed: validated.values,
      studentProfileSnapshot: profileSnapshot(e.app, h, student.id),
      periodProfileSnapshot: periodProfileSnapshot(
        e.app,
        h,
        student.id,
        submission.getString('period'),
      ),
      category: {
        id: bundle.category.id,
        code: bundle.category.getString('code'),
        name: bundle.category.getString('name'),
      },
      timestamps: {
        saved_at: h.nowIso(),
        completed_at: null,
      },
    })
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'FORM_DRAFT_SAVED',
        target_type: 'hk_form_submissions',
        target_id: submission.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}
  }

  return e.json(200, {
    submission_id: submission.id,
    status: submission.getString('status'),
    last_saved_at: String(submission.get('last_saved_at') || ''),
    answers: validated.values,
    issues: validated.issues,
  })
}, $apis.requireAuth('hk_students'))

routerAdd('POST', '/api/hk/forms/submission/complete', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const data = new DynamicModel({ submission_id: '', answers: {} })
  e.bindBody(data)

  const submission = e.app.findRecordById(h.COLLECTIONS.formSubmissions, h.trimStr(data.submission_id))
  if (submission.getString('student') !== student.id) throw new ForbiddenError('無權限')
  const formRecComplete = e.app.findRecordById(h.COLLECTIONS.forms, submission.getString('form'))
  const guardsComplete = require(`${__hooks}/hk_application_guards.js`)
  guardsComplete.assertStudentCanEditSubmission(
    e.app,
    h,
    student.id,
    submission.getString('period'),
    formRecComplete.getString('category'),
  )
  guardsComplete.assertPeriodEditableOrApplicationOverride(
    e.app,
    h,
    student.id,
    submission.getString('period'),
    formRecComplete.getString('category'),
  )

  const bundle = loadSchemaBundle(e.app, h, submission.getString('form_version'))
  const incoming = data.answers || {}
  const allowlisted = {}
  for (var i = 0; i < bundle.fields.length; i++) {
    const field = bundle.fields[i]
    if (!field.active) continue
    if (field.field_type === 'computed' || field.field_type === 'display') continue
    if (Object.prototype.hasOwnProperty.call(incoming, field.code)) {
      allowlisted[field.code] = incoming[field.code]
    }
  }
  const existing = loadAnswersMap(e.app, h, submission.id)
  const merged = Object.assign({}, existing, allowlisted)
  const validated = bundle.engine.validateValues(bundle.fields, bundle.rules, merged, 'complete')
  const errors = validated.issues.filter(function (issue) {
    return issue.severity === 'error'
  })
  if (errors.length) {
    return e.json(400, { message: '尚有必填或缺漏項目', issues: errors })
  }

  saveAnswersMap(e.app, h, submission.id, bundle.fields, validated.values)
  submission.set('status', 'completed')
  submission.set('completed_at', h.nowIso())
  submission.set('last_saved_at', h.nowIso())
  e.app.save(submission)

  createSubmissionVersion(e.app, h, submission, 'completed', {
    formVersion: {
      id: bundle.version.id,
      version_number: bundle.version.getInt('version_number'),
    },
    answers: validated.values,
    computed: validated.values,
    studentProfileSnapshot: profileSnapshot(e.app, h, student.id),
    periodProfileSnapshot: periodProfileSnapshot(
      e.app,
      h,
      student.id,
      submission.getString('period'),
    ),
    period: h.periodToPlain(
      e.app.findRecordById(h.COLLECTIONS.applicationPeriods, submission.getString('period')),
    ),
    category: {
      id: bundle.category.id,
      code: bundle.category.getString('code'),
      name: bundle.category.getString('name'),
    },
    schema: bundle.schema,
    timestamps: {
      completed_at: h.nowIso(),
      saved_at: h.nowIso(),
    },
  })

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'FORM_COMPLETED',
      target_type: 'hk_form_submissions',
      target_id: submission.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
    })
  } catch (_) {}

  return e.json(200, {
    submission_id: submission.id,
    status: 'completed',
    completed_at: String(submission.get('completed_at') || ''),
    issues: validated.issues,
  })
}, $apis.requireAuth('hk_students'))

routerAdd('POST', '/api/hk/forms/submission/copy-previous', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const data = new DynamicModel({ category_code: '' })
  e.bindBody(data)
  const code = h.trimStr(data.category_code)
  const ctx = getOrCreateSubmission(e.app, h, student, code)
  const open = ctx.open

  const previousPeriod = h.findPreviousPeriodRecord(e.app, open)
  if (!previousPeriod) throw new NotFoundError('找不到上一期資料')

  let previousSubmission = null
  try {
    previousSubmission = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.formSubmissions,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: previousPeriod.id, cid: ctx.category.id },
    )
  } catch (_) {
    throw new NotFoundError('上一期尚未有此項目申請內容')
  }

  const sourceBundle = loadSchemaBundle(e.app, h, previousSubmission.getString('form_version'))
  const targetBundle = loadSchemaBundle(e.app, h, ctx.submission.getString('form_version'))
  const sourceAnswers = loadAnswersMap(e.app, h, previousSubmission.id)
  const copied = sourceBundle.engine.copyAnswers(
    sourceBundle.fields,
    sourceAnswers,
    targetBundle.fields,
  )

  saveAnswersMap(e.app, h, ctx.submission.id, targetBundle.fields, copied)
  ctx.submission.set('copied_from_submission', previousSubmission.id)
  ctx.submission.set('status', 'draft')
  ctx.submission.set('completed_at', null)
  ctx.submission.set('last_saved_at', h.nowIso())
  e.app.save(ctx.submission)

  createSubmissionVersion(e.app, h, ctx.submission, 'copied', {
    formVersion: {
      id: targetBundle.version.id,
      version_number: targetBundle.version.getInt('version_number'),
    },
    answers: copied,
    computed: copied,
    studentProfileSnapshot: profileSnapshot(e.app, h, student.id),
    periodProfileSnapshot: periodProfileSnapshot(e.app, h, student.id, open.id),
    category: {
      id: ctx.category.id,
      code: ctx.category.getString('code'),
      name: ctx.category.getString('name'),
    },
    timestamps: { saved_at: h.nowIso(), completed_at: null },
  })

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'FORM_PREVIOUS_COPIED',
      target_type: 'hk_form_submissions',
      target_id: ctx.submission.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { from_submission: previousSubmission.id },
    })
  } catch (_) {}

  return e.json(200, {
    submission_id: ctx.submission.id,
    answers: copied,
    message: '已套用上一期答案至目前表單版本（不相容欄位已略過）',
  })
}, $apis.requireAuth('hk_students'))

routerAdd('GET', '/api/hk/forms/history/{periodId}/{categoryCode}', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const student = requireStudent(e, h)
  const periodId = e.request.pathValue('periodId')
  const categoryCode = e.request.pathValue('categoryCode')
  const currentOpen = h.getCurrentOpenPeriodRecord(e.app)
  if (currentOpen && currentOpen.id === periodId) {
    throw new ForbiddenError('目前可編輯梯次請至申請頁查看')
  }

  let category = null
  try {
    category = e.app.findFirstRecordByData(h.COLLECTIONS.applicationCategories, 'code', categoryCode)
  } catch (_) {
    throw new NotFoundError('找不到申請項目')
  }

  let submission = null
  try {
    submission = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.formSubmissions,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: periodId, cid: category.id },
    )
  } catch (_) {
    throw new ForbiddenError('無權查看此歷史表單')
  }

  const versions = e.app.findRecordsByFilter(
    h.COLLECTIONS.formSubmissionVersions,
    'submission = {:sid}',
    '-version_number',
    50,
    0,
    { sid: submission.id },
  )
  if (!versions.length) throw new NotFoundError('找不到歷史版本')
  const latest = versions[0]
  const snapshot = parseJsonMaybe(latest.get('snapshot')) || {}
  const bundle = loadSchemaBundle(e.app, h, submission.getString('form_version'))

  return e.json(200, {
    period: h.periodToPlain(e.app.findRecordById(h.COLLECTIONS.applicationPeriods, periodId)),
    category: {
      id: category.id,
      code: category.getString('code'),
      name: category.getString('name'),
    },
    submission: {
      id: submission.id,
      status: submission.getString('status'),
      current_version_number: submission.getInt('current_version_number') || 1,
      completed_at: submission.get('completed_at') ? String(submission.get('completed_at')) : null,
    },
    latest_version: {
      id: latest.id,
      version_number: latest.getInt('version_number'),
      reason: latest.getString('reason'),
      created: String(latest.get('created') || ''),
      snapshot: snapshot,
    },
    schema: bundle.schema,
    answers: snapshot.answers || loadAnswersMap(e.app, h, submission.id),
    applicant: publicApplicantView(snapshot.studentProfileSnapshot || {}),
    period_profile: snapshot.periodProfileSnapshot || {},
  })
}, $apis.requireAuth('hk_students'))

routerAdd('GET', '/api/hk/admin/forms', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  h.requireAdminAuth(e)
  const forms = e.app.findRecordsByFilter(h.COLLECTIONS.forms, 'id != ""', 'name', 50, 0)
  const items = []
  for (var i = 0; i < forms.length; i++) {
    const form = forms[i]
    let category = null
    try {
      category = e.app.findRecordById(h.COLLECTIONS.applicationCategories, form.getString('category'))
    } catch (_) {}
    let version = null
    const vid = form.getString('current_published_version')
    if (vid) {
      try {
        version = e.app.findRecordById(h.COLLECTIONS.formVersions, vid)
      } catch (_) {}
    }
    items.push({
      id: form.id,
      name: form.getString('name'),
      description: form.getString('description') || null,
      active: form.getBool('active'),
      category_code: category ? category.getString('code') : null,
      category_name: category ? category.getString('name') : null,
      current_published_version_id: vid || null,
      current_published_version_number: version ? version.getInt('version_number') : null,
      current_published_status: version ? version.getString('status') : null,
    })
  }
  return e.json(200, { items: items })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('GET', '/api/hk/admin/forms/{formId}/versions/{versionId}/preview', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  h.requireAdminAuth(e)
  const formId = e.request.pathValue('formId')
  const versionId = e.request.pathValue('versionId')
  const version = e.app.findRecordById(h.COLLECTIONS.formVersions, versionId)
  if (version.getString('form') !== formId) throw new BadRequestError('版本與表單不符')
  const bundle = loadSchemaBundle(e.app, h, versionId)
  return e.json(200, { schema: bundle.schema })
}, $apis.requireAuth('hk_staff_users'))
