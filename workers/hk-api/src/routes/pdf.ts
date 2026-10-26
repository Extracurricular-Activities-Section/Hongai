/**
 * PDF generate / list / download / public verify / admin revoke.
 *
 * submission_id in the API is the hk_applications id (six-collection).
 */

import type PocketBase from 'pocketbase'

import { contentDisposition, attachmentsOf } from '../lib/attachments'
import { requireStudent, type StudentRecord } from '../lib/auth-student'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { nowIso, writeAudit } from '../lib/application-workflow'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import {
  applicationIdOfPdf,
  assertSnapshotComplete,
  buildDocumentNumber,
  callPdfRender,
  createVerificationToken,
  nextDocumentSerial,
  newPdfDocumentId,
  pdfDocumentsOf,
  pdfToPlain,
  schemaForRender,
  storePdfFile,
  updateVerifyStatus,
  upsertVerifyIndex,
  withPdfDocuments,
} from '../lib/pdf'

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function servicePb(env: WorkerEnv): Promise<PocketBase> {
  try {
    return await createServicePb(env)
  } catch (err) {
    throw new HttpError(
      503,
      err instanceof Error ? err.message : 'Service account required',
    )
  }
}

async function loadApplication(pb: PocketBase, id: string): Promise<Row> {
  try {
    return (await pb.collection('hk_applications').getOne(id)) as Row
  } catch {
    throw new HttpError(404, '找不到申請')
  }
}

function submissionMeta(application: Row): Row {
  return obj(obj(application.workflow_json).submission)
}

function periodFields(application: Row): {
  academic_year: number | null
  semester: string | null
  period_key: string
} {
  const period = obj(application.period_json)
  return {
    academic_year: Number(period.academic_year) || null,
    semester: period.semester ? str(period.semester) : null,
    period_key: str(application.period_key) || str(period.id),
  }
}

function verifyBase(env: WorkerEnv, request: Request): string {
  const configured = (env as WorkerEnv & { HK_VERIFY_BASE_URL?: string }).HK_VERIFY_BASE_URL
  if (configured) return configured.replace(/\/$/, '')
  return (env.HK_STUDENT_APP_URL || new URL(request.url).origin).replace(/\/$/, '')
}

async function generate(
  request: Request,
  env: WorkerEnv,
  student: StudentRecord,
  body: Row,
): Promise<Response> {
  const applicationId = str(body.submission_id).trim()
  if (!applicationId) throw new HttpError(400, '缺少 submission_id')

  const pb = await servicePb(env)
  const application = await loadApplication(pb, applicationId)
  if (str(application.student) !== str(student.id)) throw new HttpError(403, '無權限')
  if (str(submissionMeta(application).status) !== 'completed') {
    throw new HttpError(400, '請先完成填寫')
  }

  const snapshot = obj(application.submission_snapshot_json)
  try {
    assertSnapshotComplete(snapshot)
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'snapshot 無效')
  }

  if (!snapshot.period) snapshot.period = application.period_json
  if (!snapshot.category) {
    snapshot.category = { code: application.category_code, name: application.category_name }
  }

  let form: Row
  try {
    form = (await pb.collection('hk_forms').getOne(str(application.form))) as Row
  } catch {
    throw new HttpError(400, '找不到表單版本')
  }
  const schema = schemaForRender(form)
  snapshot.schema = schema

  const { academic_year, semester, period_key } = periodFields(application)
  if (!academic_year || !semester) throw new HttpError(400, '申請缺少學年度／學期資料')

  const categoryCode = str(application.category_code)
  const serial = await nextDocumentSerial(pb, academic_year, semester, categoryCode)
  const documentNumber = buildDocumentNumber(academic_year, semester, categoryCode, serial)
  const existing = pdfDocumentsOf(application)
  const nextVersion =
    existing.reduce((max, doc) => Math.max(max, Number(doc.document_version) || 0), 0) + 1
  const token = createVerificationToken()
  const verificationUrl = `${verifyBase(env, request)}/verify/${token}`

  let rendered: { bytes: Uint8Array; sha256: string }
  try {
    rendered = await callPdfRender(env, {
      snapshot,
      schema,
      documentNumber,
      documentVersion: nextVersion,
      verificationUrl,
    })
  } catch (err) {
    throw new HttpError(503, err instanceof Error ? err.message : 'PDF 產生失敗')
  }

  const documentId = newPdfDocumentId(applicationId)
  const now = nowIso()
  const { file, filesJson } = await storePdfFile(pb, application, rendered.bytes, {
    documentId,
    documentNumber,
    documentVersion: nextVersion,
    sha256: rendered.sha256,
    studentId: str(student.id),
  })

  const document: Row = {
    id: documentId,
    student: str(student.id),
    period: period_key,
    category: categoryCode,
    submission: applicationId,
    submission_version: str(obj(snapshot).version_number || submissionMeta(application).current_version_number || nextVersion),
    document_number: documentNumber,
    document_version: nextVersion,
    status: 'valid',
    file,
    file_sha256: rendered.sha256,
    verification_token: token,
    generated_at: now,
    generated_by_type: 'student',
    superseded_by: null,
    revoked_at: null,
    revoke_reason: null,
    created: now,
    updated: now,
  }

  const nextDocs = existing.map((doc) =>
    str(doc.status) === 'valid'
      ? { ...doc, status: 'superseded', superseded_by: documentId, updated: now }
      : doc,
  )
  nextDocs.push(document)

  await pb.collection('hk_applications').update(applicationId, {
    files_json: filesJson,
    workflow_json: withPdfDocuments(application, nextDocs),
  })

  for (const doc of existing) {
    if (str(doc.status) !== 'valid') continue
    if (doc.verification_token) {
      await updateVerifyStatus(pb, str(doc.verification_token), str(doc.id), 'superseded', {
        superseded_by: documentId,
      })
    }
  }

  await upsertVerifyIndex(pb, {
    token,
    applicationId,
    documentId,
    status: 'valid',
    document_number: documentNumber,
    document_version: nextVersion,
    category_name: str(application.category_name),
    academic_year,
    semester,
    generated_at: now,
    student_no: str(student.student_no),
  })

  await writeAudit(pb, {
    actorStudent: str(student.id),
    action: 'PDF_GENERATED',
    targetId: applicationId,
    payload: { document_id: documentId, document_number: documentNumber, document_version: nextVersion },
  })

  return json({ document: pdfToPlain(document), message: 'PDF 已產生' })
}

async function listBySubmission(
  env: WorkerEnv,
  student: StudentRecord,
  submissionId: string,
): Promise<Response> {
  const pb = await servicePb(env)
  const application = await loadApplication(pb, submissionId)
  if (str(application.student) !== str(student.id)) throw new HttpError(403, '無權限')
  return json({ items: pdfDocumentsOf(application).map((doc) => pdfToPlain(doc)) })
}

async function download(
  request: Request,
  env: WorkerEnv,
  actor: { kind: 'student'; student: StudentRecord } | { kind: 'staff'; staff: StaffAuthContext },
  documentId: string,
): Promise<Response> {
  const applicationId = applicationIdOfPdf(documentId)
  if (!applicationId) throw new HttpError(404, '找不到文件')

  const pb = await servicePb(env)
  const application = await loadApplication(pb, applicationId)
  if (actor.kind === 'student' && str(application.student) !== str(actor.student.id)) {
    throw new HttpError(403, '無權限')
  }

  const doc = pdfDocumentsOf(application).find((item) => str(item.id) === documentId)
  if (!doc) throw new HttpError(404, '找不到文件')
  const fileName = str(doc.file)
  if (!fileName) throw new HttpError(404, 'PDF 檔案不存在')

  const base = env.HK_POCKETBASE_URL.replace(/\/$/, '')
  const token = await pb.files.getToken()
  const upstream = await fetch(
    `${base}/api/files/hk_applications/${applicationId}/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token)}`,
  )
  if (!upstream.ok || !upstream.body) throw new HttpError(404, 'PDF 檔案讀取失敗')

  const filename = `${str(doc.document_number)}-V${Number(doc.document_version) || 1}.pdf`
  await writeAudit(pb, {
    actorStudent: actor.kind === 'student' ? str(actor.student.id) : undefined,
    actorStaff: actor.kind === 'staff' ? actor.staff.id : undefined,
    action: 'PDF_DOWNLOADED',
    targetId: applicationId,
    payload: { document_id: documentId },
  })

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(filename, 'attachment'),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

async function verify(env: WorkerEnv, token: string): Promise<Response> {
  const unknown = {
    status: 'unknown',
    message: '查無此文件或驗證碼無效。',
  }
  if (!token || token.length < 16) return json(unknown)

  const pb = await servicePb(env)
  let row: Row
  try {
    row = (await pb.collection('hk_events').getFirstListItem(
      pb.filter('event_type = "system" && event_key = {:key}', { key: `pdf_token:${token}` }),
    )) as Row
  } catch {
    return json(unknown)
  }

  const payload = obj(row.payload_json)
  const status = str(row.status) || 'unknown'
  let message = '此文件為目前有效版本'
  if (status === 'superseded') message = '此文件已被較新版本取代'
  if (status === 'revoked') message = '此文件已撤銷'
  if (status !== 'valid' && status !== 'superseded' && status !== 'revoked') {
    return json(unknown)
  }

  return json({
    status,
    message,
    document_number: str(payload.document_number) || undefined,
    document_version: Number(payload.document_version) || undefined,
    category_name: payload.category_name ? str(payload.category_name) : null,
    academic_year: payload.academic_year != null ? Number(payload.academic_year) : null,
    semester: payload.semester ? str(payload.semester) : null,
    generated_at: payload.generated_at ? str(payload.generated_at) : null,
  })
}

async function adminList(env: WorkerEnv, url: URL): Promise<Response> {
  const pb = await servicePb(env)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const page = await pb.collection('hk_events').getList(1, 100, {
    filter: 'event_type = "system" && event_key ~ "pdf_document:"',
    sort: '-created',
  })
  const items = (page.items as Row[])
    .map((row) => {
      const payload = obj(row.payload_json)
      return pdfToPlain(
        {
          id: str(payload.document_id) || str(row.target_id),
          student: '',
          period: '',
          category: '',
          submission: str(payload.application_id),
          submission_version: '',
          document_number: payload.document_number,
          document_version: payload.document_version,
          status: row.status,
          file_sha256: '',
          generated_at: payload.generated_at,
          generated_by_type: 'student',
          created: row.created,
          updated: row.updated,
        },
        {
          student_no: str(payload.student_no),
          category_name: str(payload.category_name),
        },
      )
    })
    .filter((item) => {
      if (!q) return true
      return (
        str(item.document_number).toLowerCase().includes(q) ||
        str(item.student_no).toLowerCase().includes(q) ||
        str(item.category_name).toLowerCase().includes(q)
      )
    })
  return json({ items })
}

async function adminRevoke(
  env: WorkerEnv,
  staff: StaffAuthContext,
  documentId: string,
  body: Row,
): Promise<Response> {
  if (!staff.is_admin) throw new HttpError(403, '需要管理員權限')
  const reason = str(body.revoke_reason).trim()
  if (!reason) throw new HttpError(400, '請填寫撤銷原因')

  const applicationId = applicationIdOfPdf(documentId)
  if (!applicationId) throw new HttpError(404, '找不到文件')

  const pb = await servicePb(env)
  const application = await loadApplication(pb, applicationId)
  const docs = pdfDocumentsOf(application)
  const index = docs.findIndex((doc) => str(doc.id) === documentId)
  if (index < 0) throw new HttpError(404, '找不到文件')

  const now = nowIso()
  const current = docs[index]
  if (str(current.status) === 'revoked') throw new HttpError(400, '文件已撤銷')

  const next = docs.map((doc, i) =>
    i === index
      ? { ...doc, status: 'revoked', revoked_at: now, revoke_reason: reason, updated: now }
      : doc,
  )
  const filesJson = attachmentsOf(application).map((entry) =>
    str(entry.id) === documentId ? { ...entry, status: 'revoked', updated: now } : entry,
  )

  await pb.collection('hk_applications').update(applicationId, {
    workflow_json: withPdfDocuments(application, next),
    files_json: filesJson,
  })

  if (current.verification_token) {
    await updateVerifyStatus(pb, str(current.verification_token), documentId, 'revoked', {
      revoke_reason: reason,
      revoked_at: now,
    })
  }

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'PDF_REVOKED',
    targetId: applicationId,
    payload: { document_id: documentId, reason },
  })

  return json({ document: pdfToPlain(next[index]) })
}

export async function handlePdf(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  try {
    if (path === '/api/hk/pdf/generate' && request.method === 'POST') {
      const student = await requireStudent(request, env)
      if (student instanceof Response) return student
      const body = (await request.json().catch(() => ({}))) as Row
      return await generate(request, env, student, body)
    }

    const listMatch = path.match(/^\/api\/hk\/pdf\/by-submission\/([^/]+)$/)
    if (listMatch && request.method === 'GET') {
      const student = await requireStudent(request, env)
      if (student instanceof Response) return student
      return await listBySubmission(env, student, decodeURIComponent(listMatch[1]))
    }

    const downloadMatch = path.match(/^\/api\/hk\/pdf\/([^/]+)\/download$/)
    if (downloadMatch && request.method === 'GET') {
      const student = await requireStudent(request, env)
      if (!(student instanceof Response)) {
        return await download(request, env, { kind: 'student', student }, decodeURIComponent(downloadMatch[1]))
      }
      const staff = await requireStaff(request, env)
      if (staff instanceof Response) return staff
      return await download(request, env, { kind: 'staff', staff }, decodeURIComponent(downloadMatch[1]))
    }

    const verifyMatch = path.match(/^\/api\/hk\/pdf\/verify\/([^/]+)$/)
    if (verifyMatch && request.method === 'GET') {
      return await verify(env, decodeURIComponent(verifyMatch[1]))
    }

    if (path === '/api/hk/admin/documents' && request.method === 'GET') {
      const staff = await requireStaff(request, env, { adminOnly: true })
      if (staff instanceof Response) return staff
      return await adminList(env, new URL(request.url))
    }

    const revokeMatch = path.match(/^\/api\/hk\/admin\/pdf\/([^/]+)\/revoke$/)
    if (revokeMatch && request.method === 'POST') {
      const staff = await requireStaff(request, env, { adminOnly: true })
      if (staff instanceof Response) return staff
      const body = (await request.json().catch(() => ({}))) as Row
      return await adminRevoke(env, staff, decodeURIComponent(revokeMatch[1]), body)
    }

    return null
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: 'pdf_error', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pdf_error', message: err instanceof Error ? err.message : 'PDF 操作失敗' },
      { status: 502 },
    )
  }
}
