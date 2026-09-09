/// <reference path="../pb_data/types.d.ts" />

/**
 * Phase 8: Signed documents — link signed uploads to latest VALID PDF.
 */

function requireStudent(e, h) {
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }
  if (!e.auth.getBool('active')) throw new ForbiddenError('帳號未啟用')
  return e.auth
}

function signedToPlain(record) {
  return {
    id: record.id,
    application: record.getString('application'),
    student: record.getString('student'),
    source_pdf: record.getString('source_pdf'),
    attachment: record.getString('attachment'),
    version_number: record.getInt('version_number'),
    status: record.getString('status'),
    uploaded_at: record.get('uploaded_at') ? String(record.get('uploaded_at')) : null,
    student_note: record.getString('student_note') || null,
    review_note: record.getString('review_note') || null,
    reviewed_by: record.getString('reviewed_by') || null,
    reviewed_at: record.get('reviewed_at') ? String(record.get('reviewed_at')) : null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function findLatestValidPdfForApplication(app, h, application) {
  var pdfId = application.getString('pdf_document')
  if (pdfId) {
    try {
      var pdf = app.findRecordById(h.COLLECTIONS.pdfDocuments, pdfId)
      if (pdf.getString('status') === 'valid') return pdf
    } catch (_) {}
  }
  var submissionId = application.getString('submission')
  if (!submissionId) return null
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.pdfDocuments,
    'submission = {:sid} && status = "valid"',
    '-document_version',
    1,
    0,
    { sid: submissionId },
  )
  return rows.length ? rows[0] : null
}

function assertCanViewApplicationSigned(app, h, e, applicationId) {
  const workflow = require(`${__hooks}/had_application_workflow.js`)
  const application = app.findRecordById(h.COLLECTIONS.applications, applicationId)
  if (e.auth && e.auth.collection().name === h.COLLECTIONS.students) {
    if (application.getString('student') !== e.auth.id) throw new ForbiddenError('無權限')
    return { actorType: 'student', application: application }
  }
  if (e.auth && e.auth.collection().name === h.COLLECTIONS.staffUsers) {
    h.requireStaffAuth(e)
    workflow.assertStaffCanAccessApplication(app, h, e.auth, applicationId)
    return {
      actorType: e.auth.getBool('is_admin') ? 'admin' : 'staff',
      application: application,
    }
  }
  throw new UnauthorizedError('請先登入')
}

// ---------------------------------------------------------------------------
// Create signed document (after attachment upload)
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/had/signed-documents/upload',
  (e) => {
    const h = require(`${__hooks}/had_helpers.js`)
    const meta = h.requestMeta(e)
    const student = requireStudent(e, h)

    const data = new DynamicModel({
      attachment_id: '',
      application_id: '',
      student_note: '',
    })
    e.bindBody(data)

    const attachmentId = h.trimStr(data.attachment_id)
    const applicationId = h.trimStr(data.application_id)
    const studentNote = h.trimStr(data.student_note)
    if (!attachmentId || !applicationId) {
      throw new BadRequestError('請提供 attachment_id 與 application_id')
    }

    const application = e.app.findRecordById(h.COLLECTIONS.applications, applicationId)
    if (application.getString('student') !== student.id) throw new ForbiddenError('無權限')

    const status = application.getString('status')
    if (status && status !== 'returned_for_edit' && status !== 'supplement_required') {
      // allow before first submit? application always has status once created
      // students may upload signed doc while returned_for_edit, or after creating via submit flow
      // Also allow when status is empty-like only for returned; for new apps after submit they need returned
      if (
        [
          'submitted',
          'eligibility_review',
          'under_review',
          'approved',
          'rejected',
          'funding_pending',
          'funding_decided',
          'closed',
        ].indexOf(status) >= 0
      ) {
        throw new BadRequestError('目前案件狀態不可上傳已簽文件')
      }
    }

    const attachment = e.app.findRecordById(h.COLLECTIONS.attachments, attachmentId)
    if (attachment.getString('owner_student') !== student.id) throw new ForbiddenError('無權限')
    if (attachment.getString('status') !== 'active') {
      throw new BadRequestError('附件狀態不可用')
    }
    if (attachment.getString('attachment_type') !== 'signed_document') {
      throw new BadRequestError('附件類型必須為 signed_document')
    }
    if (attachment.getString('extension') !== 'pdf') {
      throw new BadRequestError('已簽文件僅接受 PDF')
    }

    const pdf = findLatestValidPdfForApplication(e.app, h, application)
    if (!pdf) throw new BadRequestError('找不到對應的有效 PDF，請先產生 PDF')

    // Link attachment to application if missing
    if (!attachment.getString('application')) {
      attachment.set('application', applicationId)
      e.app.save(attachment)
    }

    const existing = e.app.findRecordsByFilter(
      h.COLLECTIONS.signedDocuments,
      'application = {:aid}',
      '-version_number',
      1,
      0,
      { aid: applicationId },
    )
    var nextVersion = existing.length ? (existing[0].getInt('version_number') || 0) + 1 : 1

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.signedDocuments)
    const record = new Record(col)
    record.set('application', applicationId)
    record.set('student', student.id)
    record.set('source_pdf', pdf.id)
    record.set('attachment', attachmentId)
    record.set('version_number', nextVersion)
    record.set('status', 'active')
    record.set('uploaded_at', h.nowIso())
    if (studentNote) record.set('student_note', studentNote)
    e.app.save(record)

    // Supersede previous active
    const previous = e.app.findRecordsByFilter(
      h.COLLECTIONS.signedDocuments,
      'application = {:aid} && status = "active"',
      '-version_number',
      50,
      0,
      { aid: applicationId },
    )
    for (var i = 0; i < previous.length; i++) {
      if (previous[i].id === record.id) continue
      previous[i].set('status', 'superseded')
      e.app.save(previous[i])
    }

    application.set('signed_document', record.id)
    e.app.save(application)

    try {
      h.writeAudit(e.app, {
        actor_type: 'student',
        actor_student: student.id,
        action: 'SIGNED_DOCUMENT_UPLOADED',
        target_type: 'had_signed_documents',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          application_id: applicationId,
          source_pdf: pdf.id,
          attachment_id: attachmentId,
          version_number: nextVersion,
        },
      })
    } catch (_) {}

    return e.json(200, {
      signed_document: signedToPlain(record),
      message: '已簽文件已登錄',
    })
  },
  $apis.requireAuth('had_students'),
)

// ---------------------------------------------------------------------------
// List by application
// ---------------------------------------------------------------------------

routerAdd('GET', '/api/had/signed-documents/by-application/{applicationId}', (e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  const applicationId = e.request.pathValue('applicationId')
  assertCanViewApplicationSigned(e.app, h, e, applicationId)

  const rows = e.app.findRecordsByFilter(
    h.COLLECTIONS.signedDocuments,
    'application = {:aid}',
    '-version_number',
    50,
    0,
    { aid: applicationId },
  )
  const items = []
  for (var i = 0; i < rows.length; i++) items.push(signedToPlain(rows[i]))
  return e.json(200, { items: items })
})
