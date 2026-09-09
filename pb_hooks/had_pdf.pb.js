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

function pdfServiceSettings() {
  var url = ''
  var secret = 'had-dev-pdf-secret'
  var verifyBase = ''
  try {
    url = $os.getenv('HAD_PDF_SERVICE_URL') || ''
  } catch (_) {}
  try {
    secret = $os.getenv('HAD_PDF_SERVICE_SECRET') || secret
  } catch (_) {}
  try {
    verifyBase = $os.getenv('HAD_VERIFY_BASE_URL') || ''
  } catch (_) {}
  return { url: url, secret: secret, verifyBase: verifyBase }
}

function pdfToPlain(record) {
  return {
    id: record.id,
    student: record.getString('student'),
    period: record.getString('period'),
    category: record.getString('category'),
    submission: record.getString('submission'),
    submission_version: record.getString('submission_version'),
    document_number: record.getString('document_number'),
    document_version: record.getInt('document_version'),
    status: record.getString('status'),
    file_sha256: record.getString('file_sha256'),
    generated_at: record.get('generated_at') ? String(record.get('generated_at')) : null,
    generated_by_type: record.getString('generated_by_type'),
    superseded_by: record.getString('superseded_by') || null,
    revoked_at: record.get('revoked_at') ? String(record.get('revoked_at')) : null,
    revoke_reason: record.getString('revoke_reason') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function findLatestCompletedSubmissionVersion(app, h, submissionId) {
  const versions = app.findRecordsByFilter(
    h.COLLECTIONS.formSubmissionVersions,
    'submission = {:sid} && reason = "completed"',
    '-version_number',
    20,
    0,
    { sid: submissionId },
  )
  if (!versions.length) {
    const any = app.findRecordsByFilter(
      h.COLLECTIONS.formSubmissionVersions,
      'submission = {:sid}',
      '-version_number',
      1,
      0,
      { sid: submissionId },
    )
    if (!any.length) throw new BadRequestError('找不到可用的 submission snapshot')
    return any[0]
  }
  return versions[0]
}

function assertSnapshotComplete(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new BadRequestError('snapshot 無效')
  if (!snapshot.studentProfileSnapshot) throw new BadRequestError('snapshot 缺少學生資料')
  if (!snapshot.periodProfileSnapshot) throw new BadRequestError('snapshot 缺少梯次資格資料')
  if (!snapshot.answers && !snapshot.computed) throw new BadRequestError('snapshot 缺少 answers')
  if (!snapshot.formVersion) throw new BadRequestError('snapshot 缺少 formVersion')
  if (!snapshot.category) throw new BadRequestError('snapshot 缺少 category')
}

function loadSchemaForVersion(app, h, formVersionId) {
  // reuse forms hook helper by requiring schema loader from had_forms patterns
  const version = app.findRecordById(h.COLLECTIONS.formVersions, formVersionId)
  const form = app.findRecordById(h.COLLECTIONS.forms, version.getString('form'))
  const category = app.findRecordById(h.COLLECTIONS.applicationCategories, form.getString('category'))
  const sections = app.findRecordsByFilter(
    h.COLLECTIONS.formSections,
    'form_version = {:vid}',
    'sort_order',
    100,
    0,
    { vid: formVersionId },
  )
  const sectionItems = []
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
        'field = {:fid}',
        'sort_order',
        100,
        0,
        { fid: field.id },
      )
      const optionItems = []
      for (var o = 0; o < options.length; o++) {
        optionItems.push({
          value: options[o].getString('value'),
          label: options[o].getString('label'),
        })
      }
      fieldItems.push({
        code: field.getString('code'),
        label: field.getString('label'),
        field_type: field.getString('field_type'),
        help_text: field.getString('help_text') || null,
        active: field.getBool('active'),
        pdf_visible: field.getBool('pdf_visible'),
        config: parseJsonMaybe(field.get('config')),
        options: optionItems,
      })
    }
    sectionItems.push({
      code: section.getString('code'),
      title: section.getString('title'),
      visible: section.getBool('visible'),
      pdf_visible: section.getBool('pdf_visible'),
      fields: fieldItems,
    })
  }
  return {
    form: { id: form.id, name: form.getString('name') },
    version: { id: version.id, version_number: version.getInt('version_number') },
    category: {
      id: category.id,
      code: category.getString('code'),
      name: category.getString('name'),
    },
    sections: sectionItems,
  }
}

function renderPdfBytes(payload) {
  const settings = pdfServiceSettings()
  if (!settings.url) {
    throw new BadRequestError(
      'PDF 服務未設定（HAD_PDF_SERVICE_URL）。請啟動 pdf-engine/service.mjs 或部署 Cloudflare Worker。',
    )
  }
  const res = $http.send({
    url: settings.url.replace(/\/$/, '') + '/render',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HAD-PDF-SECRET': settings.secret,
    },
    body: JSON.stringify(payload),
    timeout: 120,
  })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    var msg = 'PDF 產生失敗'
    try {
      var parsed = JSON.parse(String(res.body))
      if (parsed && parsed.message) msg = parsed.message
    } catch (_) {}
    throw new BadRequestError(msg)
  }
  var sha = ''
  try {
    sha = res.headers.get('X-Had-Sha256') || res.headers.get('X-HAD-SHA256') || ''
  } catch (_) {}
  return { bytes: res.body, sha256: sha }
}

function listValidPdfs(app, submissionId) {
  return app.findRecordsByFilter(
    'had_pdf_documents',
    'submission = {:sid} && status = "valid"',
    '-document_version',
    20,
    0,
    { sid: submissionId },
  )
}

routerAdd('POST', '/api/had/pdf/generate', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const pdfCfg = require(`${__hooks}/had_pdf_config.js`)
  const meta = h.requestMeta(e)
  const student = requireStudent(e, h)
  const data = new DynamicModel({ submission_id: '' })
  e.bindBody(data)

  const submission = e.app.findRecordById(
    h.COLLECTIONS.formSubmissions,
    h.trimStr(data.submission_id),
  )
  if (submission.getString('student') !== student.id) throw new ForbiddenError('無權限')
  if (submission.getString('status') !== 'completed') {
    throw new BadRequestError('請先完成填寫')
  }
  const formForPdf = e.app.findRecordById(h.COLLECTIONS.forms, submission.getString('form'))
  const guardsPdf = require(`${__hooks}/had_application_guards.js`)
  guardsPdf.assertStudentCanEditSubmission(
    e.app,
    h,
    student.id,
    submission.getString('period'),
    formForPdf.getString('category'),
  )
  guardsPdf.assertPeriodEditableOrApplicationOverride(
    e.app,
    h,
    student.id,
    submission.getString('period'),
    formForPdf.getString('category'),
  )

  const versionRecord = findLatestCompletedSubmissionVersion(e.app, h, submission.id)
  const snapshot = parseJsonMaybe(versionRecord.get('snapshot'))
  assertSnapshotComplete(snapshot)

  const period = e.app.findRecordById(
    h.COLLECTIONS.applicationPeriods,
    submission.getString('period'),
  )
  const category = e.app.findRecordById(
    h.COLLECTIONS.applicationCategories,
    submission.getString('category'),
  )
  if (!snapshot.period) snapshot.period = h.periodToPlain(period)
  if (!snapshot.schema) {
    snapshot.schema = loadSchemaForVersion(e.app, h, submission.getString('form_version'))
  }

  const serial = pdfCfg.nextDocumentSerial(
    e.app,
    period.getInt('academic_year'),
    period.getString('semester'),
    category.getString('code'),
  )
  const documentNumber = pdfCfg.buildDocumentNumber(
    period.getInt('academic_year'),
    period.getString('semester'),
    category.getString('code'),
    serial,
  )

  const existing = e.app.findRecordsByFilter(
    'had_pdf_documents',
    'submission = {:sid}',
    '-document_version',
    1,
    0,
    { sid: submission.id },
  )
  const nextPdfVersion = existing.length ? existing[0].getInt('document_version') + 1 : 1
  const token = pdfCfg.createVerificationToken()
  const settings = pdfServiceSettings()
  var verifyBase = settings.verifyBase
  if (!verifyBase) {
    try {
      verifyBase = String(e.request.url).split('/api/')[0]
    } catch (_) {
      verifyBase = 'https://example.invalid'
    }
  }
  const verificationUrl = verifyBase.replace(/\/$/, '') + '/verify/' + token

  // Generate NEW file first; only supersede after success
  const rendered = renderPdfBytes({
    snapshot: snapshot,
    schema: snapshot.schema,
    documentNumber: documentNumber,
    documentVersion: nextPdfVersion,
    verificationUrl: verificationUrl,
  })

  var sha = rendered.sha256
  if (!sha) {
    throw new BadRequestError('PDF 服務未回傳 SHA-256')
  }

  const col = e.app.findCollectionByNameOrId('had_pdf_documents')
  const record = new Record(col)
  record.set('student', student.id)
  record.set('period', period.id)
  record.set('category', category.id)
  record.set('submission', submission.id)
  record.set('submission_version', versionRecord.id)
  record.set('document_number', documentNumber)
  record.set('document_version', nextPdfVersion)
  record.set('status', 'valid')
  record.set('file_sha256', sha)
  record.set('generated_at', h.nowIso())
  record.set('generated_by_type', 'student')
  record.set('generated_by_student', student.id)
  record.set('verification_token', token)

  // File from bytes
  var fileName = documentNumber + '-V' + nextPdfVersion + '.pdf'
  try {
    var file = $filesystem.fileFromBytes(rendered.bytes, fileName)
    record.set('file', file)
  } catch (err) {
    throw new BadRequestError('無法寫入 PDF 檔案：請確認 PDF 服務與 PocketBase filesystem API')
  }
  e.app.save(record)

  // Supersede previous valid docs
  const previousValid = listValidPdfs(e.app, submission.id)
  for (var i = 0; i < previousValid.length; i++) {
    if (previousValid[i].id === record.id) continue
    previousValid[i].set('status', 'superseded')
    previousValid[i].set('superseded_by', record.id)
    e.app.save(previousValid[i])
    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'PDF_SUPERSEDED',
        target_type: 'had_pdf_documents',
        target_id: previousValid[i].id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: { superseded_by: record.id },
      })
    } catch (_) {}
  }

  try {
    h.writeAudit(e.app, {
      actor_type: 'student',
      actor_student: student.id,
      action: 'PDF_GENERATED',
      target_type: 'had_pdf_documents',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: {
        document_number: documentNumber,
        document_version: nextPdfVersion,
        submission_version: versionRecord.id,
      },
    })
  } catch (_) {}

  return e.json(200, {
    document: pdfToPlain(record),
    message: 'PDF 已產生',
  })
}, $apis.requireAuth('had_students'))

routerAdd('GET', '/api/had/pdf/by-submission/{submissionId}', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const student = requireStudent(e, h)
  const submissionId = e.request.pathValue('submissionId')
  const submission = e.app.findRecordById(h.COLLECTIONS.formSubmissions, submissionId)
  if (submission.getString('student') !== student.id) throw new ForbiddenError('無權限')

  const records = e.app.findRecordsByFilter(
    'had_pdf_documents',
    'submission = {:sid}',
    '-document_version',
    50,
    0,
    { sid: submissionId },
  )
  const items = []
  for (var i = 0; i < records.length; i++) items.push(pdfToPlain(records[i]))
  return e.json(200, { items: items })
}, $apis.requireAuth('had_students'))

routerAdd('GET', '/api/had/pdf/{id}/download', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  const id = e.request.pathValue('id')
  const record = e.app.findRecordById('had_pdf_documents', id)

  var allowed = false
  var actorType = 'system'
  if (e.auth && e.auth.collection().name === h.COLLECTIONS.students) {
    if (record.getString('student') === e.auth.id) {
      allowed = true
      actorType = 'student'
    }
  } else if (e.auth && e.auth.collection().name === h.COLLECTIONS.staffUsers) {
    if (e.auth.getBool('is_admin') && e.auth.getBool('active')) {
      allowed = true
      actorType = 'admin'
    }
  }
  if (!allowed) throw new ForbiddenError('無權下載')

  const fileName =
    record.getString('document_number') + '-V' + record.getInt('document_version') + '.pdf'
  try {
    h.writeAudit(e.app, {
      actor_type: actorType,
      actor_student: actorType === 'student' ? e.auth.id : '',
      actor_staff: actorType === 'admin' ? e.auth.id : '',
      action: 'PDF_DOWNLOADED',
      target_type: 'had_pdf_documents',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { document_number: record.getString('document_number') },
    })
  } catch (_) {}

  const storedName = String(record.get('file') || '')
  if (!storedName) throw new NotFoundError('找不到 PDF 檔案')
  const fullPath = record.baseFilesPath() + '/' + storedName
  var bytes
  try {
    bytes = $os.readFile(fullPath)
  } catch (_) {
    throw new NotFoundError('PDF 檔案讀取失敗')
  }

  e.response.header().set('Content-Type', 'application/pdf')
  e.response.header().set('Content-Disposition', 'attachment; filename="' + fileName + '"')
  e.response.header().set('X-Content-Type-Options', 'nosniff')
  return e.blob(200, 'application/pdf', bytes)
})

routerAdd('GET', '/api/had/pdf/verify/{token}', (e) => {
  const token = e.request.pathValue('token')
  if (!token || token.length < 16) {
    return e.json(200, {
      status: 'unknown',
      message: '查無此文件或驗證碼無效。',
    })
  }
  let record = null
  try {
    record = e.app.findFirstRecordByData('had_pdf_documents', 'verification_token', token)
  } catch (_) {
    return e.json(200, {
      status: 'unknown',
      message: '查無此文件或驗證碼無效。',
    })
  }

  const h = require(`${__hooks}/had_helpers.js`)
  let period = null
  let category = null
  try {
    period = e.app.findRecordById(h.COLLECTIONS.applicationPeriods, record.getString('period'))
  } catch (_) {}
  try {
    category = e.app.findRecordById(
      h.COLLECTIONS.applicationCategories,
      record.getString('category'),
    )
  } catch (_) {}

  const status = record.getString('status')
  var message = '此文件為目前有效版本'
  if (status === 'superseded') message = '此文件已被較新版本取代'
  if (status === 'revoked') message = '此文件已撤銷'

  return e.json(200, {
    status: status,
    message: message,
    document_number: record.getString('document_number'),
    document_version: record.getInt('document_version'),
    category_name: category ? category.getString('name') : null,
    academic_year: period ? period.getInt('academic_year') : null,
    semester: period ? period.getString('semester') : null,
    generated_at: record.get('generated_at') ? String(record.get('generated_at')) : null,
  })
})

routerAdd('GET', '/api/had/admin/documents', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  h.requireAdminAuth(e)
  const q = h.trimStr(e.request.url.query().get('q')).toLowerCase()
  const records = e.app.findRecordsByFilter('had_pdf_documents', 'id != ""', '-generated_at', 100, 0)
  const items = []
  for (var i = 0; i < records.length; i++) {
    const doc = records[i]
    let studentNo = ''
    try {
      studentNo = e.app.findRecordById(h.COLLECTIONS.students, doc.getString('student')).getString(
        'student_no',
      )
    } catch (_) {}
    let categoryName = ''
    try {
      categoryName = e.app
        .findRecordById(h.COLLECTIONS.applicationCategories, doc.getString('category'))
        .getString('name')
    } catch (_) {}
    if (
      q &&
      doc.getString('document_number').toLowerCase().indexOf(q) < 0 &&
      studentNo.toLowerCase().indexOf(q) < 0 &&
      categoryName.toLowerCase().indexOf(q) < 0
    ) {
      continue
    }
    items.push(
      Object.assign(pdfToPlain(doc), {
        student_no: studentNo,
        category_name: categoryName,
      }),
    )
  }
  return e.json(200, { items: items })
}, $apis.requireAuth('had_staff_users'))

routerAdd('POST', '/api/had/admin/pdf/{id}/revoke', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const meta = h.requestMeta(e)
  h.requireAdminAuth(e)
  const id = e.request.pathValue('id')
  const data = new DynamicModel({ revoke_reason: '' })
  e.bindBody(data)
  const reason = h.trimStr(data.revoke_reason)
  if (!reason) throw new BadRequestError('請填寫撤銷原因')
  const record = e.app.findRecordById('had_pdf_documents', id)
  record.set('status', 'revoked')
  record.set('revoked_at', h.nowIso())
  record.set('revoke_reason', reason)
  e.app.save(record)
  try {
    h.writeAudit(e.app, {
      actor_type: 'admin',
      actor_staff: e.auth.id,
      action: 'PDF_REVOKED',
      target_type: 'had_pdf_documents',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { reason_present: true },
    })
  } catch (_) {}
  return e.json(200, { document: pdfToPlain(record) })
}, $apis.requireAuth('had_staff_users'))
