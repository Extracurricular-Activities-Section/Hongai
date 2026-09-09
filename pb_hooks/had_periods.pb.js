/// <reference path="../pb_data/types.d.ts" />

function requireStudent(e, h) {
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }
  return e.auth
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
  }
}

function entryToPlain(record) {
  return {
    id: record.id,
    student: record.getString('student'),
    period: record.getString('period'),
    category: record.getString('category'),
    status: record.getString('status'),
    last_opened_at: record.get('last_opened_at') ? String(record.get('last_opened_at')) : null,
    copied_from_entry: record.getString('copied_from_entry') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

routerAdd('GET', '/api/had/student/current-period', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const student = requireStudent(e, h)
  const nowMs = Date.now()
  const latest = h.getLatestVisiblePeriodRecord(e.app)
  const open = h.getCurrentOpenPeriodRecord(e.app)

  let periodProfile = null
  let previous = null
  if (open) {
    try {
      periodProfile = e.app.findFirstRecordByFilter(
        h.COLLECTIONS.periodStudentProfiles,
        'student = {:sid} && period = {:pid}',
        { sid: student.id, pid: open.id },
      )
    } catch (_) {}
    previous = h.findPreviousPeriodRecord(e.app, open)
  }

  let historyCount = 0
  try {
    const hist = e.app.findRecordsByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid}',
      '-created',
      200,
      0,
      { sid: student.id },
    )
    historyCount = hist.length
  } catch (_) {}

  const latestPlain = latest ? h.periodToPlain(latest) : null
  let uiState = 'none'
  if (latestPlain) {
    if (open && open.id === latest.id) uiState = 'open'
    else if (latestPlain.status === 'scheduled' || (latestPlain.status === 'open' && nowMs < h.dateToMs(latest.get('start_at'))))
      uiState = 'scheduled'
    else uiState = 'closed'
  }

  return e.json(200, {
    server_now: new Date(nowMs).toISOString(),
    ui_state: uiState,
    latest_period: latestPlain,
    current_open_period: open ? h.periodToPlain(open) : null,
    period_profile: periodProfile ? h.periodProfileToPlain(periodProfile) : null,
    previous_period: previous ? h.periodToPlain(previous) : null,
    has_history: historyCount > 0 || h.studentHasHistory(e.app, student.id),
    history_count: historyCount,
  })
}, $apis.requireAuth('had_students'))

routerAdd('GET', '/api/had/student/period-profile/bootstrap', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const student = requireStudent(e, h)
  const open = h.getCurrentOpenPeriodRecord(e.app)
  if (!open) throw new ForbiddenError('目前沒有可申請梯次')

  let existing = null
  try {
    existing = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {}

  const previous = h.findPreviousPeriodRecord(e.app, open)
  let previousProfile = null
  if (previous) {
    try {
      previousProfile = e.app.findFirstRecordByFilter(
        h.COLLECTIONS.periodStudentProfiles,
        'student = {:sid} && period = {:pid}',
        { sid: student.id, pid: previous.id },
      )
    } catch (_) {}
  }

  let shared = null
  try {
    shared = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentProfiles,
      'student = {:sid}',
      { sid: student.id },
    )
  } catch (_) {
    throw new NotFoundError('找不到共用資料')
  }

  return e.json(200, {
    period: h.periodToPlain(open),
    existing_profile: existing ? h.periodProfileToPlain(existing) : null,
    previous_period: previous ? h.periodToPlain(previous) : null,
    previous_profile: previousProfile ? h.periodProfileToPlain(previousProfile) : null,
    defaults: {
      grade: shared.getString('grade') || '',
      bank_account_registered: shared.getBool('bank_account_registered'),
      bank_account_note: shared.getString('bank_account_note') || '',
      has_applied_before: h.studentHasHistory(e.app, student.id, open.id),
    },
  })
}, $apis.requireAuth('had_students'))

routerAdd('POST', '/api/had/student/period-profile/confirm', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const open = h.getCurrentOpenPeriodRecord(e.app)
  if (!open) throw new ForbiddenError('目前沒有可申請梯次')

  const data = new DynamicModel({
    grade: '',
    application_identity_types: [],
    disability_level: '',
    weak_aid_level: '',
    bank_account_registered: false,
    bank_account_note: '',
    qualification_note: '',
    copy_from_previous: false,
  })
  e.bindBody(data)

  const types = Array.isArray(data.application_identity_types)
    ? data.application_identity_types
    : []
  const grade = h.trimStr(data.grade)
  const bankRegistered = !!data.bank_account_registered
  const bankNote = h.trimStr(data.bank_account_note)
  const qualificationNote = h.trimStr(data.qualification_note)
  const disability = h.trimStr(data.disability_level)
  const weakAid = h.trimStr(data.weak_aid_level)

  if (!grade) throw new BadRequestError('請填寫年級')
  if (!bankRegistered && !bankNote) throw new BadRequestError('請說明無法提供銀行帳號原因')
  if (types.indexOf('other_special') >= 0 && !qualificationNote) {
    throw new BadRequestError('請填寫其他特殊情況說明')
  }

  const hasHistory = h.studentHasHistory(e.app, student.id, open.id)
  let sourcePeriodId = ''
  let copied = false
  let isNew = false

  let record = null
  try {
    record = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {
    isNew = true
    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.periodStudentProfiles)
    record = new Record(col)
    record.set('student', student.id)
    record.set('period', open.id)

    if (data.copy_from_previous) {
      const previous = h.findPreviousPeriodRecord(e.app, open)
      if (previous) {
        try {
          const prevProfile = e.app.findFirstRecordByFilter(
            h.COLLECTIONS.periodStudentProfiles,
            'student = {:sid} && period = {:pid}',
            { sid: student.id, pid: previous.id },
          )
          // snapshot copy defaults (may be overridden by submitted body)
          const prevPlain = h.periodProfileToPlain(prevProfile)
          if (!types.length && prevPlain.application_identity_types.length) {
            data.application_identity_types = prevPlain.application_identity_types
          }
          sourcePeriodId = previous.id
          copied = true
          record.set('source_period', previous.id)
          record.set('copied_from_previous', true)
        } catch (_) {}
      }
    }
  }

  const finalTypes = Array.isArray(data.application_identity_types)
    ? data.application_identity_types
    : types

  record.set('grade', grade)
  record.set('application_identity_types', finalTypes)
  record.set('disability_level', disability)
  record.set('weak_aid_level', weakAid)
  record.set('has_applied_before', hasHistory)
  record.set('bank_account_registered', bankRegistered)
  record.set('bank_account_note', bankNote)
  record.set('qualification_note', qualificationNote)
  record.set('confirmed_at', h.nowIso())
  e.app.save(record)

  try {
    if (isNew) {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: copied ? 'PERIOD_PROFILE_COPIED' : 'PERIOD_PROFILE_CREATED',
        target_type: 'had_period_student_profiles',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { period_id: open.id, source_period_id: sourcePeriodId || null },
      })
    }
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'PERIOD_PROFILE_CONFIRMED',
      target_type: 'had_period_student_profiles',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { period_id: open.id },
    })
  } catch (_) {}

  return e.json(200, { profile: h.periodProfileToPlain(record) })
}, $apis.requireAuth('had_students'))

routerAdd('POST', '/api/had/student/period-profile/update', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const open = h.getCurrentOpenPeriodRecord(e.app)
  if (!open) throw new ForbiddenError('目前不可修改本學期資料')

  const data = new DynamicModel({
    grade: '',
    application_identity_types: [],
    disability_level: '',
    weak_aid_level: '',
    bank_account_registered: false,
    bank_account_note: '',
    qualification_note: '',
  })
  e.bindBody(data)

  let record = null
  try {
    record = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {
    throw new NotFoundError('請先完成本學期資料確認')
  }

  const grade = h.trimStr(data.grade)
  const types = Array.isArray(data.application_identity_types)
    ? data.application_identity_types
    : []
  const bankRegistered = !!data.bank_account_registered
  const bankNote = h.trimStr(data.bank_account_note)
  const qualificationNote = h.trimStr(data.qualification_note)
  if (!grade) throw new BadRequestError('請填寫年級')
  if (!bankRegistered && !bankNote) throw new BadRequestError('請說明無法提供銀行帳號原因')
  if (types.indexOf('other_special') >= 0 && !qualificationNote) {
    throw new BadRequestError('請填寫其他特殊情況說明')
  }

  record.set('grade', grade)
  record.set('application_identity_types', types)
  record.set('disability_level', h.trimStr(data.disability_level))
  record.set('weak_aid_level', h.trimStr(data.weak_aid_level))
  record.set('has_applied_before', h.studentHasHistory(e.app, student.id))
  record.set('bank_account_registered', bankRegistered)
  record.set('bank_account_note', bankNote)
  record.set('qualification_note', qualificationNote)
  e.app.save(record)

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'PERIOD_PROFILE_UPDATED',
      target_type: 'had_period_student_profiles',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { period_id: open.id },
    })
  } catch (_) {}

  return e.json(200, { profile: h.periodProfileToPlain(record) })
}, $apis.requireAuth('had_students'))

routerAdd('GET', '/api/had/student/current/categories', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const student = requireStudent(e, h)
  const open = h.getCurrentOpenPeriodRecord(e.app)
  if (!open) throw new ForbiddenError('目前沒有可申請梯次')

  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {}
  if (!profile || !profile.get('confirmed_at')) {
    throw new ForbiddenError('請先完成本學期資料確認')
  }

  const categories = e.app.findRecordsByFilter(
    h.COLLECTIONS.applicationCategories,
    'active = true',
    'sort_order,name',
    50,
    0,
  )
  const entries = e.app.findRecordsByFilter(
    h.COLLECTIONS.studentCategoryEntries,
    'student = {:sid} && period = {:pid}',
    '-updated',
    50,
    0,
    { sid: student.id, pid: open.id },
  )

  const entryByCategory = {}
  for (var i = 0; i < entries.length; i++) {
    entryByCategory[entries[i].getString('category')] = entryToPlain(entries[i])
  }

  const previous = h.findPreviousPeriodRecord(e.app, open)
  const items = []
  for (var c = 0; c < categories.length; c++) {
    const cat = categories[c]
    const plain = categoryToPlain(cat)
    const entry = entryByCategory[cat.id] || null
    let previousEntry = null
    if (!entry && previous && plain.allow_copy_previous) {
      try {
        const pe = e.app.findFirstRecordByFilter(
          h.COLLECTIONS.studentCategoryEntries,
          'student = {:sid} && period = {:pid} && category = {:cid}',
          { sid: student.id, pid: previous.id, cid: cat.id },
        )
        previousEntry = entryToPlain(pe)
      } catch (_) {}
    }
    items.push({
      category: plain,
      entry: entry,
      previous_entry: previousEntry,
    })
  }

  const started = entries.filter(function (x) {
    return x.getString('status') !== 'not_started'
  }).length

  return e.json(200, {
    period: h.periodToPlain(open),
    period_profile: h.periodProfileToPlain(profile),
    items: items,
    started_count: started,
    min_application_count: open.getInt('min_application_count') || 2,
    min_application_rule: open.getString('min_application_rule') || 'warning_only',
  })
}, $apis.requireAuth('had_students'))

routerAdd('POST', '/api/had/student/current/categories/{code}/start', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const code = e.request.pathValue('code')
  const open = h.getCurrentOpenPeriodRecord(e.app)
  if (!open) throw new ForbiddenError('目前沒有可申請梯次')

  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {}
  if (!profile || !profile.get('confirmed_at')) {
    throw new ForbiddenError('請先完成本學期資料確認')
  }

  let category = null
  try {
    category = e.app.findFirstRecordByData(h.COLLECTIONS.applicationCategories, 'code', code)
  } catch (_) {
    throw new NotFoundError('找不到申請項目')
  }
  if (!category.getBool('active')) throw new ForbiddenError('此申請項目未開放')

  let entry = null
  try {
    entry = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentCategoryEntries,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: open.id, cid: category.id },
    )
  } catch (_) {
    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.studentCategoryEntries)
    entry = new Record(col)
    entry.set('student', student.id)
    entry.set('period', open.id)
    entry.set('category', category.id)
    entry.set('status', 'draft')
    entry.set('last_opened_at', h.nowIso())
    e.app.save(entry)
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'CATEGORY_ENTRY_CREATED',
        target_type: 'had_student_category_entries',
        target_id: entry.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { category_code: code, period_id: open.id },
      })
    } catch (_) {}
  }

  entry.set('last_opened_at', h.nowIso())
  if (entry.getString('status') === 'not_started') entry.set('status', 'draft')
  e.app.save(entry)

  return e.json(200, {
    entry: entryToPlain(entry),
    category: categoryToPlain(category),
  })
}, $apis.requireAuth('had_students'))

routerAdd('POST', '/api/had/student/current/categories/{code}/copy-previous', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const code = e.request.pathValue('code')
  const open = h.getCurrentOpenPeriodRecord(e.app)
  if (!open) throw new ForbiddenError('目前沒有可申請梯次')

  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: open.id },
    )
  } catch (_) {}
  if (!profile || !profile.get('confirmed_at')) {
    throw new ForbiddenError('請先完成本學期資料確認')
  }

  const category = e.app.findFirstRecordByData(h.COLLECTIONS.applicationCategories, 'code', code)
  if (!category.getBool('active')) throw new ForbiddenError('此申請項目未開放')

  try {
    e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentCategoryEntries,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: open.id, cid: category.id },
    )
    throw new BadRequestError('此項目已開始，無需重複建立')
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  const previous = h.findPreviousPeriodRecord(e.app, open)
  if (!previous) throw new BadRequestError('找不到上一期資料')

  let prevEntry = null
  try {
    prevEntry = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentCategoryEntries,
      'student = {:sid} && period = {:pid} && category = {:cid}',
      { sid: student.id, pid: previous.id, cid: category.id },
    )
  } catch (_) {
    throw new BadRequestError('上一期未申請此項目')
  }

  const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.studentCategoryEntries)
  const entry = new Record(col)
  entry.set('student', student.id)
  entry.set('period', open.id)
  entry.set('category', category.id)
  entry.set('status', 'draft')
  entry.set('last_opened_at', h.nowIso())
  entry.set('copied_from_entry', prevEntry.id)
  e.app.save(entry)

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'CATEGORY_ENTRY_COPIED',
      target_type: 'had_student_category_entries',
      target_id: entry.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { category_code: code, from_entry: prevEntry.id },
    })
  } catch (_) {}

  return e.json(200, {
    entry: entryToPlain(entry),
    category: categoryToPlain(category),
    message: '已建立新梯次草稿，申請內容將在表單階段進行複製。',
  })
}, $apis.requireAuth('had_students'))

routerAdd('GET', '/api/had/student/history', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const student = requireStudent(e, h)
  const currentOpen = h.getCurrentOpenPeriodRecord(e.app)

  const periodIds = {}
  const profiles = e.app.findRecordsByFilter(
    h.COLLECTIONS.periodStudentProfiles,
    'student = {:sid}',
    '-created',
    200,
    0,
    { sid: student.id },
  )
  for (var i = 0; i < profiles.length; i++) {
    periodIds[profiles[i].getString('period')] = true
  }
  const allEntries = e.app.findRecordsByFilter(
    h.COLLECTIONS.studentCategoryEntries,
    'student = {:sid}',
    '-created',
    500,
    0,
    { sid: student.id },
  )
  for (var eIdx = 0; eIdx < allEntries.length; eIdx++) {
    periodIds[allEntries[eIdx].getString('period')] = true
  }

  const ids = Object.keys(periodIds)
  const items = []
  for (var p = 0; p < ids.length; p++) {
    const periodId = ids[p]
    let period = null
    try {
      period = e.app.findRecordById(h.COLLECTIONS.applicationPeriods, periodId)
    } catch (_) {
      continue
    }

    let profile = null
    try {
      profile = e.app.findFirstRecordByFilter(
        h.COLLECTIONS.periodStudentProfiles,
        'student = {:sid} && period = {:pid}',
        { sid: student.id, pid: periodId },
      )
    } catch (_) {}

    const entries = e.app.findRecordsByFilter(
      h.COLLECTIONS.studentCategoryEntries,
      'student = {:sid} && period = {:pid}',
      'created',
      50,
      0,
      { sid: student.id, pid: periodId },
    )
    const categoryNames = []
    for (var j = 0; j < entries.length; j++) {
      try {
        const cat = e.app.findRecordById(
          h.COLLECTIONS.applicationCategories,
          entries[j].getString('category'),
        )
        categoryNames.push(cat.getString('name'))
      } catch (_) {}
    }

    if (!profile && entries.length === 0) continue

    items.push({
      period: h.periodToPlain(period),
      profile: profile
        ? h.periodProfileToPlain(profile)
        : {
            id: '',
            student: student.id,
            period: periodId,
            grade: null,
            application_identity_types: [],
            disability_level: null,
            weak_aid_level: null,
            has_applied_before: false,
            bank_account_registered: false,
            bank_account_note: null,
            qualification_note: null,
            confirmed_at: null,
            source_period: null,
            copied_from_previous: false,
            created: '',
            updated: '',
          },
      entry_count: entries.length,
      category_names: categoryNames,
      is_current_editable:
        !!currentOpen &&
        currentOpen.id === periodId &&
        h.isPeriodEditableNow(currentOpen, Date.now()),
    })
  }

  items.sort(function (a, b) {
    return h.comparePeriodsForLatest(a.period, b.period)
  })

  return e.json(200, { items: items })
}, $apis.requireAuth('had_students'))

routerAdd('GET', '/api/had/student/history/{periodId}', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const student = requireStudent(e, h)
  const periodId = e.request.pathValue('periodId')
  const currentOpen = h.getCurrentOpenPeriodRecord(e.app)
  if (currentOpen && currentOpen.id === periodId) {
    throw new ForbiddenError('目前可編輯梯次請至申請頁查看')
  }

  let period = null
  try {
    period = e.app.findRecordById(h.COLLECTIONS.applicationPeriods, periodId)
  } catch (_) {
    throw new NotFoundError('找不到梯次')
  }

  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.periodStudentProfiles,
      'student = {:sid} && period = {:pid}',
      { sid: student.id, pid: periodId },
    )
  } catch (_) {}

  const entries = e.app.findRecordsByFilter(
    h.COLLECTIONS.studentCategoryEntries,
    'student = {:sid} && period = {:pid}',
    'created',
    50,
    0,
    { sid: student.id, pid: periodId },
  )

  if (!profile && entries.length === 0) {
    throw new ForbiddenError('無權查看此歷史紀錄')
  }

  const entryItems = []
  for (var i = 0; i < entries.length; i++) {
    let cat = null
    try {
      cat = e.app.findRecordById(
        h.COLLECTIONS.applicationCategories,
        entries[i].getString('category'),
      )
    } catch (_) {}
    entryItems.push({
      entry: entryToPlain(entries[i]),
      category: cat ? categoryToPlain(cat) : null,
    })
  }

  return e.json(200, {
    period: h.periodToPlain(period),
    profile: profile
      ? h.periodProfileToPlain(profile)
      : {
          id: '',
          student: student.id,
          period: periodId,
          grade: null,
          application_identity_types: [],
          disability_level: null,
          weak_aid_level: null,
          has_applied_before: false,
          bank_account_registered: false,
          bank_account_note: null,
          qualification_note: null,
          confirmed_at: null,
          source_period: null,
          copied_from_previous: false,
          created: '',
          updated: '',
        },
    entries: entryItems,
  })
}, $apis.requireAuth('had_students'))

// ---------- Admin periods ----------

routerAdd('GET', '/api/had/admin/periods', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  h.requireAdminAuth(e)
  const records = e.app.findRecordsByFilter(
    h.COLLECTIONS.applicationPeriods,
    'id != ""',
    '-academic_year,-start_at,-sort_order',
    200,
    0,
  )
  const items = []
  for (var i = 0; i < records.length; i++) items.push(h.periodToPlain(records[i]))
  return e.json(200, { items: items })
}, $apis.requireAuth('had_staff_users'))

routerAdd('POST', '/api/had/admin/periods', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  h.requireAdminAuth(e)
  const data = new DynamicModel({
    name: '',
    academic_year: 0,
    semester: '1',
    start_at: '',
    end_at: '',
    status: 'draft',
    active: true,
    description: '',
    min_application_count: 2,
    min_application_rule: 'warning_only',
    sort_order: 0,
  })
  e.bindBody(data)

  const name = h.trimStr(data.name)
  const startAt = h.trimStr(data.start_at)
  const endAt = h.trimStr(data.end_at)
  if (!name || !startAt || !endAt) throw new BadRequestError('請完整填寫梯次資料')
  if (h.dateToMs(startAt) >= h.dateToMs(endAt)) {
    throw new BadRequestError('開始時間必須早於結束時間')
  }
  if (data.min_application_count < 0) throw new BadRequestError('最低申請項數無效')
  if (!data.academic_year || data.academic_year < 100 || data.academic_year > 200) {
    throw new BadRequestError('學年度數值不合理')
  }

  const candidate = {
    status: h.trimStr(data.status) || 'draft',
    active: !!data.active,
    start_at: startAt,
    end_at: endAt,
  }
  if (h.hasOverlappingOpenPeriod(e.app, candidate, null)) {
    throw new BadRequestError('目前已有開放中的申請梯次，請先調整原梯次時間或狀態。')
  }

  const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.applicationPeriods)
  const record = new Record(col)
  record.set('name', name)
  record.set('academic_year', data.academic_year)
  record.set('semester', h.trimStr(data.semester) || '1')
  record.set('start_at', startAt)
  record.set('end_at', endAt)
  record.set('status', candidate.status)
  record.set('active', candidate.active)
  record.set('description', h.trimStr(data.description))
  record.set('min_application_count', data.min_application_count || 2)
  record.set('min_application_rule', h.trimStr(data.min_application_rule) || 'warning_only')
  record.set('sort_order', data.sort_order || 0)
  e.app.save(record)

  try {
    h.writeAudit(e.app, {
      actor_type: 'admin',
      actor_staff: e.auth.id,
      action: 'PERIOD_CREATED',
      target_type: 'had_application_periods',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
    })
  } catch (_) {}

  return e.json(200, { period: h.periodToPlain(record) })
}, $apis.requireAuth('had_staff_users'))

routerAdd('POST', '/api/had/admin/periods/{id}', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  h.requireAdminAuth(e)
  const id = e.request.pathValue('id')
  const record = e.app.findRecordById(h.COLLECTIONS.applicationPeriods, id)
  const data = new DynamicModel({
    name: '',
    academic_year: 0,
    semester: '1',
    start_at: '',
    end_at: '',
    status: 'draft',
    active: true,
    description: '',
    min_application_count: 2,
    min_application_rule: 'warning_only',
    sort_order: 0,
  })
  e.bindBody(data)

  const startAt = h.trimStr(data.start_at)
  const endAt = h.trimStr(data.end_at)
  if (h.dateToMs(startAt) >= h.dateToMs(endAt)) {
    throw new BadRequestError('開始時間必須早於結束時間')
  }
  if (data.min_application_count < 0) throw new BadRequestError('最低申請項數無效')
  if (!data.academic_year || data.academic_year < 100 || data.academic_year > 200) {
    throw new BadRequestError('學年度數值不合理')
  }

  const candidate = {
    status: h.trimStr(data.status) || record.getString('status'),
    active: !!data.active,
    start_at: startAt,
    end_at: endAt,
  }
  if (h.hasOverlappingOpenPeriod(e.app, candidate, id)) {
    throw new BadRequestError('目前已有開放中的申請梯次，請先調整原梯次時間或狀態。')
  }

  record.set('name', h.trimStr(data.name))
  record.set('academic_year', data.academic_year)
  record.set('semester', h.trimStr(data.semester) || '1')
  record.set('start_at', startAt)
  record.set('end_at', endAt)
  record.set('status', candidate.status)
  record.set('active', candidate.active)
  record.set('description', h.trimStr(data.description))
  record.set('min_application_count', data.min_application_count || 2)
  record.set('min_application_rule', h.trimStr(data.min_application_rule) || 'warning_only')
  record.set('sort_order', data.sort_order || 0)
  e.app.save(record)

  const action = candidate.status === 'archived' ? 'PERIOD_ARCHIVED' : 'PERIOD_UPDATED'
  try {
    h.writeAudit(e.app, {
      actor_type: 'admin',
      actor_staff: e.auth.id,
      action: action,
      target_type: 'had_application_periods',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
    })
  } catch (_) {}

  return e.json(200, { period: h.periodToPlain(record) })
}, $apis.requireAuth('had_staff_users'))

// ---------- Admin categories ----------

routerAdd('GET', '/api/had/admin/categories', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  h.requireAdminAuth(e)
  const records = e.app.findRecordsByFilter(
    h.COLLECTIONS.applicationCategories,
    'id != ""',
    'sort_order,code',
    50,
    0,
  )
  const items = []
  for (var i = 0; i < records.length; i++) items.push(h.categoryToPlain(records[i]))
  return e.json(200, { items: items })
}, $apis.requireAuth('had_staff_users'))

routerAdd('POST', '/api/had/admin/categories/{id}', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  h.requireAdminAuth(e)
  const id = e.request.pathValue('id')
  const record = e.app.findRecordById(h.COLLECTIONS.applicationCategories, id)
  const data = new DynamicModel({
    name: '',
    description: '',
    active: true,
    sort_order: 0,
  })
  e.bindBody(data)

  const name = h.trimStr(data.name)
  if (name) record.set('name', name)
  if (data.description !== undefined) record.set('description', h.trimStr(data.description))
  if (typeof data.active === 'boolean') record.set('active', data.active)
  if (typeof data.sort_order === 'number') record.set('sort_order', data.sort_order)
  // code is immutable
  e.app.save(record)
  return e.json(200, { category: h.categoryToPlain(record) })
}, $apis.requireAuth('had_staff_users'))

// ---------- Admin students (period profiles) ----------

routerAdd('GET', '/api/had/admin/students', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  h.requireAdminAuth(e)
  const q = h.trimStr(e.request.url.query().get('q')).toLowerCase()
  const students = e.app.findRecordsByFilter(
    h.COLLECTIONS.students,
    'id != ""',
    'student_no',
    100,
    0,
  )
  const items = []
  for (var i = 0; i < students.length; i++) {
    const student = students[i]
    let profile = null
    try {
      profile = e.app.findFirstRecordByFilter(
        h.COLLECTIONS.studentProfiles,
        'student = {:sid}',
        { sid: student.id },
      )
    } catch (_) {}
    const name = profile ? profile.getString('name') : ''
    const department = profile ? profile.getString('department_name') : ''
    const studentNo = student.getString('student_no')
    if (
      q &&
      studentNo.toLowerCase().indexOf(q) < 0 &&
      name.toLowerCase().indexOf(q) < 0
    ) {
      continue
    }
    items.push({
      id: student.id,
      student_no: studentNo,
      name: name,
      department_name: department,
      identity_masked: profile
        ? h.maskIdentityNumber(profile.getString('identity_number'))
        : '****',
    })
  }
  return e.json(200, { items: items })
}, $apis.requireAuth('had_staff_users'))

routerAdd('GET', '/api/had/admin/students/{id}', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  h.requireAdminAuth(e)
  const id = e.request.pathValue('id')
  const student = e.app.findRecordById(h.COLLECTIONS.students, id)
  let profile = null
  try {
    profile = e.app.findFirstRecordByFilter(
      h.COLLECTIONS.studentProfiles,
      'student = {:sid}',
      { sid: id },
    )
  } catch (_) {
    throw new NotFoundError('找不到學生資料')
  }

  const periodProfiles = e.app.findRecordsByFilter(
    h.COLLECTIONS.periodStudentProfiles,
    'student = {:sid}',
    '-created',
    100,
    0,
    { sid: id },
  )
  const mapped = []
  for (var i = 0; i < periodProfiles.length; i++) {
    let period = null
    try {
      period = e.app.findRecordById(
        h.COLLECTIONS.applicationPeriods,
        periodProfiles[i].getString('period'),
      )
    } catch (_) {}
    mapped.push({
      profile: h.periodProfileToPlain(periodProfiles[i]),
      period: period ? h.periodToPlain(period) : null,
    })
  }

  return e.json(200, {
    student: {
      id: student.id,
      student_no: student.getString('student_no'),
    },
    profile: {
      name: profile.getString('name'),
      department_name: profile.getString('department_name'),
      grade: profile.getString('grade'),
      email: profile.getString('email'),
      phone: profile.getString('phone'),
      identity_number_masked: h.maskIdentityNumber(profile.getString('identity_number')),
    },
    period_profiles: mapped,
  })
}, $apis.requireAuth('had_staff_users'))
