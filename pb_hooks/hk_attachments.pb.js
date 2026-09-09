/// <reference path="../pb_data/types.d.ts" />

/**
 * Phase 8: Attachment upload / download / soft-delete.
 * No public file URLs — download only via authenticated custom routes.
 */

function requireStudent(e, h) {
  if (!e.auth || e.auth.collection().name !== h.COLLECTIONS.students) {
    throw new UnauthorizedError('請先登入')
  }
  if (!e.auth.getBool('active')) throw new ForbiddenError('帳號未啟用')
  return e.auth
}

function formField(e, h, key) {
  try {
    var info = e.requestInfo()
    if (info && info.body && info.body[key] != null && info.body[key] !== '') {
      return h.trimStr(info.body[key])
    }
  } catch (_) {}
  try {
    if (e.request.formValue) {
      var v = e.request.formValue(key)
      if (v != null && String(v) !== '') return h.trimStr(v)
    }
  } catch (_) {}
  try {
    if (e.request.postFormValue) {
      var v2 = e.request.postFormValue(key)
      if (v2 != null && String(v2) !== '') return h.trimStr(v2)
    }
  } catch (_) {}
  return ''
}

function attachmentToPlain(record) {
  return {
    id: record.id,
    owner_student: record.getString('owner_student'),
    application: record.getString('application') || null,
    submission: record.getString('submission') || null,
    supplement_request: record.getString('supplement_request') || null,
    follow_up_task: record.getString('follow_up_task') || null,
    attachment_type: record.getString('attachment_type'),
    field_code: record.getString('field_code') || null,
    original_filename: record.getString('original_filename'),
    stored_filename: record.getString('stored_filename'),
    mime_type: record.getString('mime_type'),
    extension: record.getString('extension'),
    size_bytes: Number(record.get('size_bytes') || 0),
    sha256: record.getString('sha256'),
    status: record.getString('status'),
    uploaded_by_type: record.getString('uploaded_by_type'),
    uploaded_by_student: record.getString('uploaded_by_student') || null,
    uploaded_by_staff: record.getString('uploaded_by_staff') || null,
    scan_status: record.getString('scan_status') || 'not_configured',
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function mapContextToType(context) {
  if (context === 'signed_document') return 'signed_document'
  if (context === 'supplement') return 'supplement'
  if (context === 'follow_up') return 'follow_up'
  return 'application'
}

/**
 * Resolve uploaded filesystem.File from multipart.
 * Prefer e.findUploadedFiles("file"); fall back to formFile + fileFromMultipart.
 */
function resolveUploadedFile(e) {
  var files = null
  try {
    files = e.findUploadedFiles('file')
  } catch (err) {
    // PocketBase API may differ by version — try alternatives below.
    files = null
  }
  if (files && files.length) return files[0]

  try {
    var pair = e.request.formFile('file')
    var mh = null
    if (Array.isArray(pair)) mh = pair[1] || pair[0]
    else mh = pair
    if (mh) {
      return $filesystem.fileFromMultipart(mh)
    }
  } catch (err2) {
    // continue
  }

  try {
    var mf = e.request.multipartForm()
    if (mf && mf.file && mf.file.file && mf.file.file.length) {
      return $filesystem.fileFromMultipart(mf.file.file[0])
    }
  } catch (err3) {
    // continue
  }

  throw new BadRequestError('請上傳檔案（欄位名稱：file）')
}

function readStoredFileBytes(record) {
  var storedName = String(record.get('file') || '')
  if (!storedName) throw new NotFoundError('找不到檔案')
  var fullPath = record.baseFilesPath() + '/' + storedName
  try {
    return $os.readFile(fullPath)
  } catch (_) {
    throw new NotFoundError('檔案讀取失敗')
  }
}

function resolveApplicationIdForAccess(app, h, att) {
  var appId = att.getString('application')
  if (appId) return appId
  var submissionId = att.getString('submission')
  if (submissionId) {
    try {
      var apps = app.findRecordsByFilter(
        h.COLLECTIONS.applications,
        'submission = {:sid}',
        '-created',
        1,
        0,
        { sid: submissionId },
      )
      if (apps.length) return apps[0].id
    } catch (_) {}
  }
  var taskId = att.getString('follow_up_task')
  if (taskId) {
    try {
      return app.findRecordById(h.COLLECTIONS.followUpTasks, taskId).getString('application')
    } catch (_) {}
  }
  var suppId = att.getString('supplement_request')
  if (suppId) {
    try {
      return app
        .findRecordById(h.COLLECTIONS.supplementRequests, suppId)
        .getString('application')
    } catch (_) {}
  }
  return ''
}

function assertCanAccessAttachment(app, h, e, att) {
  var workflow = require(`${__hooks}/hk_application_workflow.js`)
  if (e.auth && e.auth.collection().name === h.COLLECTIONS.students) {
    if (att.getString('owner_student') !== e.auth.id) {
      throw new ForbiddenError('無權限')
    }
    return { actorType: 'student', actorId: e.auth.id }
  }
  if (e.auth && e.auth.collection().name === h.COLLECTIONS.staffUsers) {
    if (!e.auth.getBool('active')) throw new ForbiddenError('帳號未啟用')
    if (!e.auth.getBool('is_staff') && !e.auth.getBool('is_admin')) {
      throw new ForbiddenError('無權限')
    }
    var appId = resolveApplicationIdForAccess(app, h, att)
    if (appId) {
      workflow.assertStaffCanAccessApplication(app, h, e.auth, appId)
    } else if (!e.auth.getBool('is_admin')) {
      throw new ForbiddenError('無權限存取此附件')
    }
    return {
      actorType: e.auth.getBool('is_admin') ? 'admin' : 'staff',
      actorId: e.auth.id,
    }
  }
  throw new UnauthorizedError('請先登入')
}

function isAttachmentLocked(app, h, att) {
  var appId = att.getString('application')
  if (appId) {
    try {
      var application = app.findRecordById(h.COLLECTIONS.applications, appId)
      var status = application.getString('status')
      if (
        status !== 'returned_for_edit' &&
        status !== 'supplement_required' &&
        status !== '' &&
        att.getString('attachment_type') === 'application'
      ) {
        // submitted applications lock application-field attachments
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
          return true
        }
      }
    } catch (_) {}
  }

  var suppId = att.getString('supplement_request')
  if (suppId) {
    try {
      var req = app.findRecordById(h.COLLECTIONS.supplementRequests, suppId)
      if (req.getString('status') === 'submitted' || req.getString('status') === 'accepted') {
        return true
      }
    } catch (_) {}
  }

  var taskId = att.getString('follow_up_task')
  if (taskId) {
    try {
      var task = app.findRecordById(h.COLLECTIONS.followUpTasks, taskId)
      var tStatus = task.getString('status')
      if (
        tStatus === 'under_review' ||
        tStatus === 'approved' ||
        tStatus === 'rejected' ||
        tStatus === 'waived'
      ) {
        return true
      }
      if (tStatus === 'submitted' && !task.getBool('allow_resubmit')) {
        return true
      }
    } catch (_) {}
  }

  if (att.getString('attachment_type') === 'signed_document') {
    try {
      var signed = app.findRecordsByFilter(
        h.COLLECTIONS.signedDocuments,
        'attachment = {:aid} && status = "active"',
        '-created',
        1,
        0,
        { aid: att.id },
      )
      if (signed.length) {
        var signedApp = app.findRecordById(
          h.COLLECTIONS.applications,
          signed[0].getString('application'),
        )
        var sStatus = signedApp.getString('status')
        if (sStatus !== 'returned_for_edit' && sStatus) {
          if (sStatus !== 'supplement_required') return true
        }
      }
    } catch (_) {}
  }

  return false
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/attachments/upload',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const sec = require(`${__hooks}/hk_attachment_security.js`)
    const workflow = require(`${__hooks}/hk_application_workflow.js`)
    const meta = h.requestMeta(e)

    var actorStudent = null
    var actorStaff = null
    var uploadedByType = 'student'
    var ownerStudentId = ''

    if (e.auth && e.auth.collection().name === h.COLLECTIONS.students) {
      actorStudent = requireStudent(e, h)
      ownerStudentId = actorStudent.id
      uploadedByType = 'student'
    } else if (e.auth && e.auth.collection().name === h.COLLECTIONS.staffUsers) {
      actorStaff = h.requireStaffAuth(e)
      uploadedByType = actorStaff.getBool('is_admin') ? 'admin' : 'staff'
    } else {
      throw new UnauthorizedError('請先登入')
    }

    const context = formField(e, h, 'context')
    if (['application', 'signed_document', 'supplement', 'follow_up'].indexOf(context) < 0) {
      throw new BadRequestError('context 無效')
    }

    // Staff upload only for follow_up / supplement (scoped); student is primary.
    if (actorStaff && context !== 'follow_up' && context !== 'supplement') {
      throw new ForbiddenError('工作人員僅可於補件／追蹤情境上傳')
    }

    const submissionId = formField(e, h, 'submission_id')
    const applicationId = formField(e, h, 'application_id')
    const fieldCode = formField(e, h, 'field_code')
    const supplementRequestId = formField(e, h, 'supplement_request_id')
    const followUpTaskId = formField(e, h, 'follow_up_task_id')
    const replaceAttachmentId = formField(e, h, 'replace_attachment_id')

    if (actorStudent) {
      if (applicationId) {
        const appRec = e.app.findRecordById(h.COLLECTIONS.applications, applicationId)
        if (appRec.getString('student') !== actorStudent.id) throw new ForbiddenError('無權限')
      }
      if (submissionId) {
        const sub = e.app.findRecordById(h.COLLECTIONS.formSubmissions, submissionId)
        if (sub.getString('student') !== actorStudent.id) throw new ForbiddenError('無權限')
      }
      if (supplementRequestId) {
        const req = e.app.findRecordById(h.COLLECTIONS.supplementRequests, supplementRequestId)
        const appRec = e.app.findRecordById(h.COLLECTIONS.applications, req.getString('application'))
        if (appRec.getString('student') !== actorStudent.id) throw new ForbiddenError('無權限')
      }
      if (followUpTaskId) {
        const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, followUpTaskId)
        if (task.getString('student') !== actorStudent.id) throw new ForbiddenError('無權限')
      }
    }

    if (actorStaff) {
      var scopeAppId = applicationId
      if (!scopeAppId && supplementRequestId) {
        scopeAppId = e.app
          .findRecordById(h.COLLECTIONS.supplementRequests, supplementRequestId)
          .getString('application')
      }
      if (!scopeAppId && followUpTaskId) {
        scopeAppId = e.app
          .findRecordById(h.COLLECTIONS.followUpTasks, followUpTaskId)
          .getString('application')
      }
      if (!scopeAppId) throw new BadRequestError('缺少 application 範圍')
      workflow.assertStaffCanAccessApplication(e.app, h, actorStaff, scopeAppId)
      ownerStudentId = e.app
        .findRecordById(h.COLLECTIONS.applications, scopeAppId)
        .getString('student')
    }

    const uploaded = resolveUploadedFile(e)
    const originalFilename = sec.sanitizeOriginalFilename(
      uploaded.originalName || uploaded.name || formField(e, h, 'filename') || 'file',
    )
    const sizeBytes = Number(uploaded.size || 0)
    var reportedMime = ''
    try {
      // best-effort from multipart header if present
      var pairMime = e.request.formFile('file')
      var mh = Array.isArray(pairMime) ? pairMime[1] : null
      if (mh && mh.header) {
        reportedMime = String(mh.header.get('Content-Type') || '')
      }
    } catch (_) {}

    var allowed = sec.allowedExtensionsForContext(context)
    if (context === 'follow_up' && followUpTaskId) {
      try {
        const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, followUpTaskId)
        var taskAllowed = null
        try {
          taskAllowed = JSON.parse(String(task.get('allowed_extensions') || 'null'))
        } catch (_) {
          taskAllowed = task.get('allowed_extensions')
        }
        if (Array.isArray(taskAllowed) && taskAllowed.length) {
          allowed = taskAllowed.map(function (x) {
            return String(x).toLowerCase()
          })
        }
      } catch (_) {}
    }

    var maxSizeMb = sec.getMaxUploadSizeMb()
    if (context === 'follow_up' && followUpTaskId) {
      try {
        const task = e.app.findRecordById(h.COLLECTIONS.followUpTasks, followUpTaskId)
        var taskMax = Number(task.get('max_file_size_mb'))
        if (!isNaN(taskMax) && taskMax > 0) maxSizeMb = taskMax
      } catch (_) {}
    }

    // Rename before save so stored name is safe
    const ext = sec.detectExtension(originalFilename)
    const storedFilename = sec.generateStoredFilename(ext)
    try {
      uploaded.name = storedFilename
    } catch (_) {}

    // Pre-validate without magic (size/ext); magic after persist
    const pre = sec.validateUpload({
      originalFilename: originalFilename,
      reportedMime: reportedMime,
      sizeBytes: sizeBytes,
      headBytes: null,
      allowedExtensions: allowed,
      maxSizeMb: maxSizeMb,
    })
    // Allow missing magic on pre-pass; still enforce ext/size/forbidden
    if (!pre.ok) {
      // filter out magic-related errors when headBytes is null
      var hard = []
      for (var ei = 0; ei < pre.errors.length; ei++) {
        if (pre.errors[ei].indexOf('無法辨識') >= 0) continue
        hard.push(pre.errors[ei])
      }
      if (hard.length) throw new BadRequestError(hard.join('；'))
    }

    const col = e.app.findCollectionByNameOrId(h.COLLECTIONS.attachments)
    const record = new Record(col)
    record.set('owner_student', ownerStudentId)
    if (applicationId) record.set('application', applicationId)
    if (submissionId) record.set('submission', submissionId)
    if (supplementRequestId) record.set('supplement_request', supplementRequestId)
    if (followUpTaskId) record.set('follow_up_task', followUpTaskId)
    record.set('attachment_type', mapContextToType(context))
    if (fieldCode) record.set('field_code', fieldCode)
    record.set('original_filename', originalFilename)
    record.set('stored_filename', storedFilename)
    record.set('file', uploaded)
    record.set('mime_type', pre.mimeType || sec.MIME_BY_EXT[ext] || 'application/octet-stream')
    record.set('extension', ext || 'bin')
    record.set('size_bytes', sizeBytes)
    record.set('sha256', 'pending')
    record.set('status', 'active')
    record.set('uploaded_by_type', uploadedByType)
    if (actorStudent) record.set('uploaded_by_student', actorStudent.id)
    if (actorStaff) record.set('uploaded_by_staff', actorStaff.id)
    const scan = sec.scanAttachment()
    record.set('scan_status', scan.status)
    e.app.save(record)

    // Post-save: read bytes, sniff magic, sha256
    var bytes
    try {
      bytes = readStoredFileBytes(record)
    } catch (readErr) {
      record.set('status', 'quarantined')
      e.app.save(record)
      throw new BadRequestError('檔案寫入後無法讀取，已隔離')
    }

    const headLen = Math.min(64, bytes.length || 0)
    var headBytes = bytes
    // validate with magic
    const checked = sec.validateUpload({
      originalFilename: originalFilename,
      reportedMime: reportedMime,
      sizeBytes: sizeBytes || (bytes.length || 0),
      headBytes: headBytes,
      allowedExtensions: allowed,
      maxSizeMb: maxSizeMb,
    })
    if (!checked.ok) {
      record.set('status', 'quarantined')
      e.app.save(record)
      throw new BadRequestError(checked.errors.join('；'))
    }

    var sha = ''
    try {
      sha = sec.computeSha256(bytes)
    } catch (hashErr) {
      record.set('status', 'quarantined')
      e.app.save(record)
      throw new BadRequestError(String(hashErr.message || hashErr))
    }

    record.set('sha256', sha)
    record.set('mime_type', checked.mimeType)
    record.set('extension', checked.extension || ext)
    record.set('size_bytes', sizeBytes || bytes.length || 0)
    e.app.save(record)

    if (replaceAttachmentId) {
      try {
        const old = e.app.findRecordById(h.COLLECTIONS.attachments, replaceAttachmentId)
        if (old.getString('owner_student') === ownerStudentId && old.getString('status') === 'active') {
          old.set('status', 'superseded')
          e.app.save(old)
        }
      } catch (_) {}
    }

    try {
      h.writeAudit(e.app, {
        actor_type: uploadedByType === 'admin' ? 'admin' : uploadedByType === 'staff' ? 'staff' : 'student',
        actor_student: actorStudent ? actorStudent.id : '',
        actor_staff: actorStaff ? actorStaff.id : '',
        action: replaceAttachmentId ? 'ATTACHMENT_REPLACED' : 'ATTACHMENT_UPLOADED',
        target_type: 'hk_attachments',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
        metadata: {
          context: context,
          extension: record.getString('extension'),
          size_bytes: record.get('size_bytes'),
          replace_attachment_id: replaceAttachmentId || null,
          application_id: applicationId || null,
          submission_id: submissionId || null,
        },
      })
    } catch (_) {}

    return e.json(200, {
      attachment: attachmentToPlain(record),
      message: replaceAttachmentId ? '附件已替換' : '附件已上傳',
    })
  },
  $apis.bodyLimit(20 * 1024 * 1024),
)

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

routerAdd('GET', '/api/hk/attachments/{id}/download', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const sec = require(`${__hooks}/hk_attachment_security.js`)
  const meta = h.requestMeta(e)
  const id = e.request.pathValue('id')
  const record = e.app.findRecordById(h.COLLECTIONS.attachments, id)

  if (record.getString('status') === 'deleted' || record.getString('status') === 'quarantined') {
    throw new NotFoundError('附件不存在或不可用')
  }

  const access = assertCanAccessAttachment(e.app, h, e, record)

  var disposition = 'attachment'
  try {
    disposition = (e.request.url.query().get('disposition') || 'attachment').toLowerCase()
  } catch (_) {}
  if (disposition !== 'inline') disposition = 'attachment'

  const bytes = readStoredFileBytes(record)
  const mime = record.getString('mime_type') || 'application/octet-stream'
  const safe = sec.safeContentDispositionFilename(record.getString('original_filename'))

  try {
    h.writeAudit(e.app, {
      actor_type: access.actorType,
      actor_student: access.actorType === 'student' ? access.actorId : '',
      actor_staff: access.actorType !== 'student' ? access.actorId : '',
      action: 'ATTACHMENT_DOWNLOADED',
      target_type: 'hk_attachments',
      target_id: record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
      metadata: { disposition: disposition },
    })
  } catch (_) {}

  e.response.header().set('Content-Type', mime)
  e.response.header().set('Content-Disposition', safe.headerValue(disposition))
  e.response.header().set('X-Content-Type-Options', 'nosniff')
  e.response.header().set('Cache-Control', 'private, no-store')
  return e.blob(200, mime, bytes)
})

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

routerAdd(
  'POST',
  '/api/hk/attachments/{id}/delete',
  (e) => {
    const h = require(`${__hooks}/hk_helpers.js`)
    const meta = h.requestMeta(e)
    const id = e.request.pathValue('id')
    const record = e.app.findRecordById(h.COLLECTIONS.attachments, id)

    const access = assertCanAccessAttachment(e.app, h, e, record)
    if (access.actorType === 'student' && record.getString('owner_student') !== e.auth.id) {
      throw new ForbiddenError('無權限')
    }

    if (record.getString('status') === 'deleted') {
      return e.json(200, { attachment: attachmentToPlain(record), message: '附件已刪除' })
    }

    if (isAttachmentLocked(e.app, h, record)) {
      throw new BadRequestError('此附件已鎖定，無法刪除')
    }

    record.set('status', 'deleted')
    e.app.save(record)

    try {
      h.writeAudit(e.app, {
        actor_type: access.actorType,
        actor_student: access.actorType === 'student' ? access.actorId : '',
        actor_staff: access.actorType !== 'student' ? access.actorId : '',
        action: 'ATTACHMENT_DELETED',
        target_type: 'hk_attachments',
        target_id: record.id,
        ip: meta.ip,
        user_agent: meta.user_agent,
      })
    } catch (_) {}

    return e.json(200, {
      attachment: attachmentToPlain(record),
      message: '附件已刪除',
    })
  },
)
