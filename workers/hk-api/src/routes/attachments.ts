import type PocketBase from 'pocketbase'

import { WorkflowError, nowIso, workflowOf, writeAudit } from '../lib/application-workflow'
import {
  ATTACHMENT_CONTEXTS,
  ATTACHMENT_ID_PATTERN,
  DEFAULT_MAX_UPLOAD_MB,
  SCHEMA_MAX_UPLOAD_MB,
  allowedExtensionsFor,
  attachmentToPlain,
  attachmentsOf,
  contentDisposition,
  newAttachmentId,
  ownActiveAttachmentIds,
  sanitizeOriginalFilename,
  sha256Hex,
  storedFilename,
  validateUpload,
  type AttachmentContext,
} from '../lib/attachments'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { canStudentSubmit, findTask, taskAttachments } from '../lib/follow-up'
import { requireStudent, type StudentRecord } from '../lib/auth-student'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * Attachment upload / download / delete and signed-document registration.
 * Students reach only their own applications; any active staff may read case files.
 */

type Row = Record<string, unknown>
type Actor = { kind: 'student'; student: StudentRecord } | { kind: 'staff'; staff: StaffAuthContext }
type Ctx = { pb: PocketBase; env: WorkerEnv; actor: Actor; request: Request }

const str = (value: unknown): string => (value == null ? '' : String(value))
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

const ID = '([a-z0-9]{15})'
/** Field-level uploads are only open while the student can still edit answers. */
const ANSWER_EDITABLE = new Set(['draft', 'returned_for_edit'])
const SIGNED_EDITABLE = new Set(['draft', 'returned_for_edit', 'supplement_required'])

function maxUploadMb(): number {
  return Math.min(DEFAULT_MAX_UPLOAD_MB, SCHEMA_MAX_UPLOAD_MB)
}

async function loadApplication(pb: PocketBase, id: string): Promise<Row> {
  try {
    return (await pb.collection('hk_applications').getOne(id)) as Row
  } catch {
    throw new WorkflowError(404, '找不到申請')
  }
}

function assertCanRead(actor: Actor, application: Row) {
  if (actor.kind === 'student' && str(application.student) !== actor.student.id) {
    throw new WorkflowError(403, '無權限')
  }
}

function findEntry(application: Row, attachmentId: string): Row {
  const entry = attachmentsOf(application).find((item) => item.id === attachmentId)
  if (!entry || entry.status === 'deleted' || entry.status === 'quarantined') {
    throw new WorkflowError(404, '附件不存在或不可用')
  }
  return entry
}

function actorAudit(actor: Actor) {
  return actor.kind === 'student' ? { actorStudent: actor.student.id } : { actorStaff: actor.staff.id }
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

async function upload({ pb, actor, request }: Ctx) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new WorkflowError(400, '請以 multipart/form-data 上傳檔案')
  }
  const field = (key: string) => str(form.get(key)).trim()
  const context = field('context') as AttachmentContext
  if (!ATTACHMENT_CONTEXTS.includes(context)) throw new WorkflowError(400, 'context 無效')
  if (actor.kind === 'staff' && context !== 'supplement') {
    throw new WorkflowError(403, '工作人員僅可於補件情境上傳')
  }

  const applicationId = field('application_id') || field('submission_id')
  if (!/^[a-z0-9]{15}$/.test(applicationId)) throw new WorkflowError(400, '缺少申請編號')
  const file = form.get('file')
  if (!(file instanceof File)) throw new WorkflowError(400, '請上傳檔案（欄位名稱：file）')

  const application = await loadApplication(pb, applicationId)
  assertCanRead(actor, application)
  const status = str(application.status)
  const workflow = workflowOf(application)
  let supplementRequest: string | null = null
  let followUpTask: string | null = null
  let allowedExtensions = allowedExtensionsFor(context)
  let maxSizeMb = maxUploadMb()

  if (context === 'follow_up') {
    followUpTask = field('follow_up_task_id')
    const { tasks, index } = findTask(application, followUpTask)
    if (index < 0) throw new WorkflowError(404, '找不到追蹤任務')
    const task = tasks[index]
    if (!canStudentSubmit(task)) throw new WorkflowError(400, '此任務目前不可上傳附件')
    const maxFiles = Number(task.max_files) > 0 ? Number(task.max_files) : 5
    if (taskAttachments(application, followUpTask).length >= maxFiles) {
      throw new WorkflowError(400, `此任務附件最多 ${maxFiles} 個`)
    }
    const taskExtensions = Array.isArray(task.allowed_extensions)
      ? (task.allowed_extensions as unknown[]).map((ext) => str(ext).toLowerCase())
      : []
    if (taskExtensions.length) allowedExtensions = allowedExtensions.filter((ext) => taskExtensions.includes(ext))
    if (Number(task.max_file_size_mb) > 0) maxSizeMb = Math.min(Number(task.max_file_size_mb), SCHEMA_MAX_UPLOAD_MB)
  } else if (context === 'application') {
    const overridden =
      Boolean(application.edit_override_until) &&
      Date.parse(str(application.edit_override_until)) > Date.now()
    if (!ANSWER_EDITABLE.has(status) && !overridden) throw new WorkflowError(400, '此申請已送件，不可再上傳附件')
  } else if (context === 'supplement') {
    if (status !== 'supplement_required') throw new WorkflowError(400, '目前沒有待處理的補件要求')
    const pending = arr(workflow.supplements).filter((item) => item.status === 'pending')
    if (!pending.length) throw new WorkflowError(400, '目前沒有待處理的補件要求')
    supplementRequest = str(pending[pending.length - 1].id)
  } else if (context === 'signed_document') {
    if (!SIGNED_EDITABLE.has(status)) throw new WorkflowError(400, '目前狀態不可上傳已簽文件')
  }

  const originalFilename = sanitizeOriginalFilename(file.name || field('filename'))
  const bytes = new Uint8Array(await file.arrayBuffer())
  const checked = validateUpload({
    filename: originalFilename,
    bytes,
    allowedExtensions,
    maxSizeMb,
  })
  if (!checked.ok) throw new WorkflowError(400, checked.errors.join('；'))
  const sha256 = await sha256Hex(bytes)

  const before = new Set(Array.isArray(application.files) ? (application.files as string[]) : [])
  const payload = new FormData()
  payload.append(
    'files+',
    new File([bytes], storedFilename(checked.extension), { type: checked.mimeType }),
  )
  const uploaded = (await pb.collection('hk_applications').update(applicationId, payload)) as Row
  const storedName = (Array.isArray(uploaded.files) ? (uploaded.files as string[]) : []).find(
    (name) => !before.has(name),
  )
  if (!storedName) throw new WorkflowError(502, '檔案儲存失敗，請重試')

  const now = nowIso()
  const entry: Row = {
    id: newAttachmentId(applicationId),
    file: storedName,
    attachment_type: context,
    field_code: field('field_code') || null,
    supplement_request: supplementRequest,
    follow_up_task: followUpTask,
    original_filename: originalFilename,
    mime_type: checked.mimeType,
    extension: checked.extension,
    size_bytes: bytes.byteLength,
    sha256,
    status: 'active',
    uploaded_by_type: actor.kind === 'student' ? 'student' : actor.staff.is_admin ? 'admin' : 'staff',
    uploaded_by_student: actor.kind === 'student' ? actor.student.id : null,
    uploaded_by_staff: actor.kind === 'staff' ? actor.staff.id : null,
    scan_status: 'not_configured',
    created: now,
    updated: now,
  }

  const replaceId = field('replace_attachment_id')
  // Re-read so a concurrent upload's metadata is not overwritten.
  const fresh = await loadApplication(pb, applicationId)
  const entries = attachmentsOf(fresh).map((item) =>
    replaceId && item.id === replaceId && item.status === 'active'
      ? { ...item, status: 'superseded', updated: now }
      : item,
  )
  entries.push(entry)
  const saved = (await pb.collection('hk_applications').update(applicationId, { files_json: entries })) as Row

  await writeAudit(pb, {
    ...actorAudit(actor),
    action: replaceId ? 'ATTACHMENT_REPLACED' : 'ATTACHMENT_UPLOADED',
    targetId: applicationId,
    payload: { attachment_id: entry.id, context, extension: checked.extension, size_bytes: bytes.byteLength },
  })
  return json({
    attachment: attachmentToPlain(saved, entry),
    message: replaceId ? '附件已替換' : '附件已上傳',
  })
}

// ---------------------------------------------------------------------------
// Metadata + download
// ---------------------------------------------------------------------------

async function metadata({ pb, actor }: Ctx, applicationId: string, attachmentId: string) {
  const application = await loadApplication(pb, applicationId)
  assertCanRead(actor, application)
  return json({ attachment: attachmentToPlain(application, findEntry(application, attachmentId)) })
}

async function download({ pb, env, actor, request }: Ctx, applicationId: string, attachmentId: string) {
  const application = await loadApplication(pb, applicationId)
  assertCanRead(actor, application)
  const entry = findEntry(application, attachmentId)

  const base = env.HK_POCKETBASE_URL.replace(/\/$/, '')
  const token = await pb.files.getToken()
  const upstream = await fetch(
    `${base}/api/files/hk_applications/${applicationId}/${encodeURIComponent(str(entry.file))}?token=${encodeURIComponent(token)}`,
  )
  if (!upstream.ok || !upstream.body) throw new WorkflowError(404, '檔案讀取失敗')

  const disposition =
    new URL(request.url).searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'
  await writeAudit(pb, {
    ...actorAudit(actor),
    action: 'ATTACHMENT_DOWNLOADED',
    targetId: applicationId,
    payload: { attachment_id: attachmentId, disposition },
  })
  return new Response(upstream.body, {
    headers: {
      'Content-Type': str(entry.mime_type) || 'application/octet-stream',
      'Content-Disposition': contentDisposition(str(entry.original_filename), disposition),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

function isLocked(application: Row, entry: Row): boolean {
  const status = str(application.status)
  switch (entry.attachment_type) {
    case 'application':
      return !ANSWER_EDITABLE.has(status)
    case 'supplement': {
      if (status !== 'supplement_required') return true
      const request = arr(workflowOf(application).supplements).find(
        (item) => item.id === entry.supplement_request,
      )
      return !request || request.status !== 'pending'
    }
    case 'signed_document':
      return !SIGNED_EDITABLE.has(status)
    case 'follow_up': {
      const { tasks, index } = findTask(application, str(entry.follow_up_task))
      return index < 0 || !canStudentSubmit(tasks[index])
    }
    default:
      return true
  }
}

async function remove({ pb, actor }: Ctx, applicationId: string, attachmentId: string) {
  const application = await loadApplication(pb, applicationId)
  assertCanRead(actor, application)
  const entry = findEntry(application, attachmentId)
  if (actor.kind === 'staff' && entry.uploaded_by_staff !== actor.staff.id) {
    throw new WorkflowError(403, '僅可刪除自己上傳的附件')
  }
  if (isLocked(application, entry)) throw new WorkflowError(400, '此附件已鎖定，無法刪除')

  const now = nowIso()
  const deleted = { ...entry, status: 'deleted', updated: now }
  const entries = attachmentsOf(application).map((item) => (item.id === attachmentId ? deleted : item))
  const saved = (await pb.collection('hk_applications').update(applicationId, {
    files_json: entries,
    'files-': [str(entry.file)],
  })) as Row

  await writeAudit(pb, {
    ...actorAudit(actor),
    action: 'ATTACHMENT_DELETED',
    targetId: applicationId,
    payload: { attachment_id: attachmentId },
  })
  return json({ attachment: attachmentToPlain(saved, deleted), message: '附件已刪除' })
}

// ---------------------------------------------------------------------------
// Signed documents (workflow_json.signed_documents[])
// ---------------------------------------------------------------------------

function signedDocuments(application: Row): Row[] {
  return arr(workflowOf(application).signed_documents)
}

async function registerSigned({ pb, actor, request }: Ctx) {
  if (actor.kind !== 'student') throw new WorkflowError(403, '僅學生可登錄已簽文件')
  const body = ((await request.json().catch(() => ({}))) as Row) ?? {}
  const applicationId = str(body.application_id).trim()
  const attachmentId = str(body.attachment_id).trim()
  const application = await loadApplication(pb, applicationId)
  assertCanRead(actor, application)
  if (!SIGNED_EDITABLE.has(str(application.status))) throw new WorkflowError(400, '目前狀態不可登錄已簽文件')
  if (!ownActiveAttachmentIds(application, [attachmentId], 'signed_document').length) {
    throw new WorkflowError(400, '附件不存在或類型不符')
  }

  const now = nowIso()
  const previous = signedDocuments(application)
  const document: Row = {
    id: crypto.randomUUID(),
    application: applicationId,
    student: actor.student.id,
    source_pdf: '',
    attachment: attachmentId,
    version_number: previous.length + 1,
    status: 'active',
    uploaded_at: now,
    student_note: str(body.student_note).trim() || null,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created: now,
    updated: now,
  }
  const workflow = {
    ...workflowOf(application),
    signed_document: attachmentId,
    signed_documents: [
      ...previous.map((item) => (item.status === 'active' ? { ...item, status: 'superseded', updated: now } : item)),
      document,
    ],
  }
  await pb.collection('hk_applications').update(applicationId, { workflow_json: workflow })
  await writeAudit(pb, {
    ...actorAudit(actor),
    action: 'SIGNED_DOCUMENT_REGISTERED',
    targetId: applicationId,
    payload: { attachment_id: attachmentId, version_number: document.version_number },
  })
  return json({ signed_document: document, message: '已簽文件已登錄' })
}

async function listSigned({ pb, actor }: Ctx, applicationId: string) {
  const application = await loadApplication(pb, applicationId)
  assertCanRead(actor, application)
  return json({ items: signedDocuments(application).slice().reverse() })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type Route = {
  method: 'GET' | 'POST'
  pattern: RegExp
  handler: (ctx: Ctx, params: string[]) => Promise<Response>
}

const routes: Route[] = [
  { method: 'POST', pattern: /^\/api\/hk\/attachments\/upload$/, handler: (c) => upload(c) },
  {
    method: 'GET',
    pattern: new RegExp(`^/api/hk/attachments/${ATTACHMENT_ID_PATTERN}$`),
    handler: (c, [app, id]) => metadata(c, app, `${app}-${id}`),
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/api/hk/attachments/${ATTACHMENT_ID_PATTERN}/download$`),
    handler: (c, [app, id]) => download(c, app, `${app}-${id}`),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/api/hk/attachments/${ATTACHMENT_ID_PATTERN}/delete$`),
    handler: (c, [app, id]) => remove(c, app, `${app}-${id}`),
  },
  { method: 'POST', pattern: /^\/api\/hk\/signed-documents\/upload$/, handler: (c) => registerSigned(c) },
  {
    method: 'GET',
    pattern: new RegExp(`^/api/hk/signed-documents/by-application/${ID}$`),
    handler: (c, [app]) => listSigned(c, app),
  },
]

async function resolveActor(request: Request, env: WorkerEnv): Promise<Actor | Response> {
  const student = await requireStudent(request, env)
  if (!(student instanceof Response)) return { kind: 'student', student }
  const staff = await requireStaff(request, env)
  return staff instanceof Response ? student : { kind: 'staff', staff }
}

export async function handleAttachments(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  let params: string[] = []
  const route = routes.find((candidate) => {
    if (candidate.method !== request.method) return false
    const match = path.match(candidate.pattern)
    if (!match) return false
    params = match.slice(1)
    return true
  })
  if (!route) return null

  const actor = await resolveActor(request, env)
  if (actor instanceof Response) return actor

  let pb: PocketBase
  try {
    pb = await createServicePb(env)
  } catch (err) {
    return json(
      {
        error: 'service_account_required',
        message: err instanceof Error ? err.message : 'Service account required',
      },
      { status: 503 },
    )
  }

  try {
    return await route.handler({ pb, env, actor, request }, params)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return json({ error: 'request_failed', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '操作失敗' },
      { status: 502 },
    )
  }
}
