import type PocketBase from 'pocketbase'

import { applicationToPlain, maskIdentity } from '../lib/applications'
import { requireStudent, type StudentRecord } from '../lib/auth-student'
import { categoryFromSetting, categoryKey } from '../lib/categories'
import { copyAnswers, validateValues, calculateComputed, type FormValues } from '../lib/form-engine'
import { findPublishedForm, flattenFields, toSchema } from '../lib/forms'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import {
  compareLatestFirst,
  isPeriodEditableNow,
  listVisiblePeriods,
  periodFromSetting,
  type Period,
} from '../lib/periods'
import {
  entryToPlain,
  hasHistory,
  mutateState,
  periodProfileToPlain,
  readState,
} from '../lib/student-state'

/**
 * Student application flow on the six-collection schema.
 *
 * Period profile + category progress live on hk_students.profile_json (see student-state).
 * A form submission is an hk_applications row: created as status "draft" when the student
 * opens a category form (pinned to the published hk_forms version), answers in answers_json,
 * submission meta in workflow_json.submission, and it becomes "submitted" on submit.
 * Paper signatures are collected offline, so submit does not require a server PDF.
 */

type Row = Record<string, unknown>
type Ctx = { pb: PocketBase; student: StudentRecord; body: Row }

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Row = {},
  ) {
    super(message)
  }
}

const str = (value: unknown): string => (value == null ? '' : String(value))
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const nowIso = () => new Date().toISOString()

const EDITABLE_STATUSES = new Set(['draft', 'returned_for_edit'])

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

async function periodContext(pb: PocketBase) {
  const periods = await listVisiblePeriods(pb)
  const latest = periods[0] ?? null
  const open = latest && isPeriodEditableNow(latest, Date.now()) ? latest : null
  const previous = open ? (periods[1] ?? null) : null
  return { open, previous }
}

async function requireOpenPeriod(pb: PocketBase): Promise<{ open: Period; previous: Period | null }> {
  const { open, previous } = await periodContext(pb)
  if (!open) throw new HttpError(403, '目前沒有可申請梯次')
  return { open, previous }
}

async function getPeriod(pb: PocketBase, id: string): Promise<Period> {
  try {
    const row = (await pb.collection('hk_settings').getOne(id)) as Row
    if (row.setting_type !== 'period') throw new Error('not period')
    return periodFromSetting(row)
  } catch {
    throw new HttpError(404, '找不到梯次')
  }
}

async function getCategory(pb: PocketBase, code: string) {
  try {
    const row = await pb
      .collection('hk_settings')
      .getFirstListItem(pb.filter('key = {:key}', { key: categoryKey(code) }))
    return categoryFromSetting(row as Row)
  } catch {
    throw new HttpError(404, '找不到申請項目')
  }
}

async function listActiveCategories(pb: PocketBase) {
  const rows = await pb.collection('hk_settings').getFullList({
    filter: 'setting_type = "category" && active = true',
  })
  return rows
    .map((row) => categoryFromSetting(row as Row))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function requireConfirmedProfile(student: Row, periodId: string): Row {
  const stored = readState(student).period_profiles[periodId]
  if (!stored?.confirmed_at) throw new HttpError(403, '請先完成本學期資料確認')
  return stored
}

function applicantView(student: Row): Row {
  return {
    name: str(student.name),
    student_no: str(student.student_no),
    department_name: str(student.department_name),
    gender: str(student.gender),
    program_type: str(student.program_type),
    division: str(student.division),
    grade: str(student.grade),
    phone: str(student.phone),
    line_id: str(student.line_id),
    email: str(obj(student.profile_json).contact_email),
    identity_number_masked: maskIdentity(student.identity_last4),
  }
}

async function findApplication(
  pb: PocketBase,
  studentId: string,
  periodId: string,
  categoryCode: string,
): Promise<Row | null> {
  const result = await pb.collection('hk_applications').getList(1, 1, {
    filter: pb.filter('student = {:sid} && period_key = {:pid} && category_code = {:code}', {
      sid: studentId,
      pid: periodId,
      code: categoryCode,
    }),
  })
  return (result.items[0] as Row | undefined) ?? null
}

async function getOwnApplication(pb: PocketBase, studentId: string, id: string): Promise<Row> {
  let row: Row
  try {
    row = (await pb.collection('hk_applications').getOne(id)) as Row
  } catch {
    throw new HttpError(404, '找不到申請資料')
  }
  if (row.student !== studentId) throw new HttpError(403, '無權限')
  return row
}

function submissionMeta(application: Row): Row {
  return obj(obj(application.workflow_json).submission)
}

function submissionToPlain(application: Row): Row {
  const meta = submissionMeta(application)
  return {
    id: str(application.id),
    status: str(meta.status) || 'draft',
    current_version_number: Number(meta.current_version_number) || 1,
    last_saved_at: meta.last_saved_at || null,
    completed_at: meta.completed_at || null,
    form_version: str(application.form),
  }
}

function withSubmission(application: Row, patch: Row): Row {
  const workflow = obj(application.workflow_json)
  return { ...workflow, submission: { ...submissionMeta(application), ...patch } }
}

async function writeAudit(
  pb: PocketBase,
  studentId: string,
  action: string,
  targetId: string,
  payload: Row = {},
) {
  try {
    await pb.collection('hk_events').create({
      event_type: 'audit',
      event_key: action,
      actor_student: studentId,
      target_type: 'application',
      target_id: targetId,
      payload_json: payload,
      occurred_at: nowIso(),
    })
  } catch {
    // audit is best-effort
  }
}

/** Ensure category entry + draft application exist for the open period. */
async function ensureWorkspace(pb: PocketBase, student: StudentRecord, categoryCode: string) {
  const { open, previous } = await requireOpenPeriod(pb)
  requireConfirmedProfile(student, open.id)
  const category = await getCategory(pb, categoryCode)
  if (!category.active) throw new HttpError(403, '此申請項目未開放')

  let application = await findApplication(pb, student.id, open.id, categoryCode)
  if (!application) {
    const form = await findPublishedForm(pb, categoryCode)
    if (!form) throw new HttpError(400, '此申請項目的表單尚未發布')
    application = (await pb.collection('hk_applications').create({
      student: student.id,
      form: form.id,
      application_number: `DRAFT-${crypto.randomUUID()}`,
      period_key: open.id,
      period_json: open,
      category_code: category.code,
      category_name: category.name,
      status: 'draft',
      answers_json: {},
      workflow_json: {
        submission: {
          status: 'draft',
          current_version_number: 1,
          last_saved_at: nowIso(),
          completed_at: null,
        },
        status_history: [],
      },
    })) as Row
    await writeAudit(pb, student.id, 'FORM_SUBMISSION_CREATED', str(application.id), {
      category_code: categoryCode,
      period_id: open.id,
    })
  }

  await mutateState(pb, student.id, (state) => {
    const entries = { ...(state.category_entries[open.id] || {}) }
    const now = nowIso()
    const current = entries[categoryCode]
    entries[categoryCode] = current
      ? { ...current, status: 'draft', last_opened_at: now, updated: now }
      : { id: crypto.randomUUID(), status: 'draft', last_opened_at: now, created: now, updated: now }
    state.category_entries[open.id] = entries
  })

  return { open, previous, category, application }
}

async function loadFormVersion(pb: PocketBase, formId: string): Promise<Row> {
  return (await pb.collection('hk_forms').getOne(formId)) as Row
}

function assertCanEdit(application: Row, open: Period | null) {
  const overrideUntil = Date.parse(str(application.edit_override_until))
  const overridden = !Number.isNaN(overrideUntil) && overrideUntil > Date.now()
  if (!EDITABLE_STATUSES.has(str(application.status)) && !overridden) {
    throw new HttpError(403, '此申請已送件，目前不可修改')
  }
  if (!overridden && (!open || open.id !== application.period_key)) {
    throw new HttpError(403, '目前不可編輯此申請梯次')
  }
}

function allowlistAnswers(fields: ReturnType<typeof flattenFields>, incoming: Row): FormValues {
  const allowed: FormValues = {}
  for (const field of fields) {
    if (field.active === false) continue
    if (field.field_type === 'computed' || field.field_type === 'display') continue
    if (Object.prototype.hasOwnProperty.call(incoming, field.code)) {
      allowed[field.code] = incoming[field.code]
    }
  }
  return allowed
}

// ---------------------------------------------------------------------------
// Period profile
// ---------------------------------------------------------------------------

function parseProfileBody(body: Row) {
  const types = Array.isArray(body.application_identity_types)
    ? body.application_identity_types.map(String)
    : []
  const profile = {
    grade: str(body.grade).trim(),
    application_identity_types: types,
    disability_level: str(body.disability_level).trim(),
    weak_aid_level: str(body.weak_aid_level).trim(),
    bank_account_registered: Boolean(body.bank_account_registered),
    bank_account_note: str(body.bank_account_note).trim(),
    qualification_note: str(body.qualification_note).trim(),
  }
  if (!profile.grade) throw new HttpError(400, '請填寫年級')
  if (!profile.bank_account_registered && !profile.bank_account_note) {
    throw new HttpError(400, '請說明無法提供銀行帳號原因')
  }
  if (types.includes('other_special') && !profile.qualification_note) {
    throw new HttpError(400, '請填寫其他特殊情況說明')
  }
  return profile
}

async function bootstrap({ pb, student }: Ctx) {
  const { open, previous } = await requireOpenPeriod(pb)
  const state = readState(student)
  return json({
    period: open,
    existing_profile: periodProfileToPlain(student.id, open.id, state.period_profiles[open.id]),
    previous_period: previous,
    previous_profile: previous
      ? periodProfileToPlain(student.id, previous.id, state.period_profiles[previous.id])
      : null,
    defaults: {
      grade: str(student.grade),
      bank_account_registered: Boolean(student.bank_account_registered),
      bank_account_note: str(student.bank_account_note),
      has_applied_before: hasHistory(state, open.id),
    },
  })
}

async function confirmProfile({ pb, student, body }: Ctx) {
  const { open, previous } = await requireOpenPeriod(pb)
  const parsed = parseProfileBody(body)
  let isNew = false
  let copied = false
  const { state } = await mutateState(pb, student.id, (s) => {
    const now = nowIso()
    const existing = s.period_profiles[open.id]
    isNew = !existing
    const next: Row = { ...(existing || { created: now }), ...parsed }
    if (isNew && body.copy_from_previous && previous) {
      const prev = s.period_profiles[previous.id]
      if (prev) {
        if (!parsed.application_identity_types.length && Array.isArray(prev.application_identity_types)) {
          next.application_identity_types = prev.application_identity_types
        }
        next.source_period = previous.id
        next.copied_from_previous = true
        copied = true
      }
    }
    next.has_applied_before = hasHistory(s, open.id)
    next.confirmed_at = now
    next.updated = now
    s.period_profiles[open.id] = next
  })
  if (isNew) {
    await writeAudit(
      pb,
      student.id,
      copied ? 'PERIOD_PROFILE_COPIED' : 'PERIOD_PROFILE_CREATED',
      `${student.id}:${open.id}`,
    )
  }
  await writeAudit(pb, student.id, 'PERIOD_PROFILE_CONFIRMED', `${student.id}:${open.id}`)
  return json({ profile: periodProfileToPlain(student.id, open.id, state.period_profiles[open.id]) })
}

async function updateProfile({ pb, student, body }: Ctx) {
  const { open } = await periodContext(pb)
  if (!open) throw new HttpError(403, '目前不可修改本學期資料')
  if (!readState(student).period_profiles[open.id]) {
    throw new HttpError(404, '請先完成本學期資料確認')
  }
  const parsed = parseProfileBody(body)
  const { state } = await mutateState(pb, student.id, (s) => {
    s.period_profiles[open.id] = {
      ...s.period_profiles[open.id],
      ...parsed,
      has_applied_before: hasHistory(s, open.id),
      updated: nowIso(),
    }
  })
  await writeAudit(pb, student.id, 'PERIOD_PROFILE_UPDATED', `${student.id}:${open.id}`)
  return json({ profile: periodProfileToPlain(student.id, open.id, state.period_profiles[open.id]) })
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

async function currentCategories({ pb, student }: Ctx) {
  const { open, previous } = await requireOpenPeriod(pb)
  const profile = requireConfirmedProfile(student, open.id)
  const state = readState(student)
  const entries = state.category_entries[open.id] || {}
  const previousEntries = previous ? state.category_entries[previous.id] || {} : {}
  const categories = await listActiveCategories(pb)

  const items = categories.map((category) => {
    const entry = entryToPlain(student.id, open.id, category.id, entries[category.code])
    const previousEntry =
      !entry && previous && category.allow_copy_previous
        ? entryToPlain(student.id, previous.id, category.id, previousEntries[category.code])
        : null
    return { category, entry, previous_entry: previousEntry }
  })

  return json({
    period: open,
    period_profile: periodProfileToPlain(student.id, open.id, profile),
    items,
    started_count: Object.values(entries).filter((e) => e.status !== 'not_started').length,
    min_application_count: open.min_application_count,
    min_application_rule: open.min_application_rule,
  })
}

async function startCategory({ pb, student }: Ctx, code: string, fromPrevious: boolean) {
  const { open, previous } = await requireOpenPeriod(pb)
  requireConfirmedProfile(student, open.id)
  const category = await getCategory(pb, code)
  if (!category.active) throw new HttpError(403, '此申請項目未開放')

  let copiedFrom: string | null = null
  if (fromPrevious) {
    const state = readState(student)
    if (state.category_entries[open.id]?.[code]) throw new HttpError(400, '此項目已開始，無需重複建立')
    if (!previous) throw new HttpError(400, '找不到上一期資料')
    const prevEntry = state.category_entries[previous.id]?.[code]
    if (!prevEntry) throw new HttpError(400, '上一期未申請此項目')
    copiedFrom = str(prevEntry.id)
  }

  const { state } = await mutateState(pb, student.id, (s) => {
    const now = nowIso()
    const entries = { ...(s.category_entries[open.id] || {}) }
    const current = entries[code]
    entries[code] = current
      ? { ...current, status: 'draft', last_opened_at: now, updated: now }
      : {
          id: crypto.randomUUID(),
          status: 'draft',
          last_opened_at: now,
          copied_from_entry: copiedFrom,
          created: now,
          updated: now,
        }
    s.category_entries[open.id] = entries
  })
  const entry = entryToPlain(student.id, open.id, category.id, state.category_entries[open.id][code])
  await writeAudit(
    pb,
    student.id,
    fromPrevious ? 'CATEGORY_ENTRY_COPIED' : 'CATEGORY_ENTRY_OPENED',
    str(entry?.id),
    { category_code: code, period_id: open.id },
  )
  return json(
    fromPrevious
      ? { entry, category, message: '已建立新梯次草稿，申請內容將在表單階段進行複製。' }
      : { entry, category },
  )
}

// ---------------------------------------------------------------------------
// Form workspace
// ---------------------------------------------------------------------------

async function workspace({ pb, student }: Ctx, code: string) {
  const { open, category, application } = await ensureWorkspace(pb, student, code)
  const form = await loadFormVersion(pb, str(application.form))
  const answers = calculateComputed(flattenFields(form), obj(application.answers_json))
  return json({
    period: open,
    category: { id: category.id, code: category.code, name: category.name },
    submission: submissionToPlain(application),
    schema: toSchema(form),
    answers,
    applicant: applicantView(student),
    period_profile:
      periodProfileToPlain(student.id, open.id, readState(student).period_profiles[open.id]) || {},
  })
}

async function saveSubmission({ pb, student, body }: Ctx, mode: 'draft' | 'complete') {
  const application = await getOwnApplication(pb, student.id, str(body.submission_id).trim())
  const { open } = await periodContext(pb)
  assertCanEdit(application, open)

  const form = await loadFormVersion(pb, str(application.form))
  const fields = flattenFields(form)
  const merged = { ...obj(application.answers_json), ...allowlistAnswers(fields, obj(body.answers)) }
  const validated = validateValues(fields, toSchema(form).rules, merged, mode)
  const blocking = validated.issues.filter(
    (issue) => issue.severity === 'error' && (mode === 'complete' || issue.code !== 'required'),
  )
  if (blocking.length) {
    throw new HttpError(400, mode === 'complete' ? '尚有必填或缺漏項目' : '草稿內容格式有誤', {
      issues: blocking,
    })
  }

  const now = nowIso()
  const meta = submissionMeta(application)
  const reopened = mode === 'draft' && meta.status === 'completed'
  const bumpVersion = mode === 'complete' || Boolean(body.create_snapshot)
  const versionNumber = (Number(meta.current_version_number) || 1) + (bumpVersion ? 1 : 0)
  const patch: Row = {
    last_saved_at: now,
    current_version_number: versionNumber,
    ...(mode === 'complete' ? { status: 'completed', completed_at: now } : {}),
    ...(reopened ? { status: 'draft', completed_at: null } : {}),
  }
  const update: Row = {
    answers_json: validated.values,
    workflow_json: withSubmission(application, patch),
  }
  if (bumpVersion) {
    update.submission_snapshot_json = {
      formVersion: { id: form.id, version_number: Number(form.version) || 1 },
      answers: validated.values,
      studentProfileSnapshot: applicantView(student),
      periodProfileSnapshot:
        readState(student).period_profiles[str(application.period_key)] || {},
      period: application.period_json,
      category: { code: application.category_code, name: application.category_name },
      reason: mode === 'complete' ? 'completed' : 'manual_save',
      version_number: versionNumber,
      created: now,
      timestamps: { saved_at: now, completed_at: mode === 'complete' ? now : null },
    }
  }
  await pb.collection('hk_applications').update(str(application.id), update)
  await writeAudit(
    pb,
    student.id,
    mode === 'complete' ? 'FORM_COMPLETED' : reopened ? 'FORM_REOPENED' : 'FORM_DRAFT_SAVED',
    str(application.id),
  )

  if (mode === 'complete') {
    return json({
      submission_id: application.id,
      status: 'completed',
      completed_at: now,
      issues: validated.issues,
    })
  }
  return json({
    submission_id: application.id,
    status: reopened ? 'draft' : str(meta.status) || 'draft',
    last_saved_at: now,
    answers: validated.values,
    issues: validated.issues,
  })
}

async function copyPreviousAnswers({ pb, student, body }: Ctx) {
  const code = str(body.category_code).trim()
  const { open, previous, application } = await ensureWorkspace(pb, student, code)
  assertCanEdit(application, open)
  if (!previous) throw new HttpError(404, '找不到上一期資料')
  const source = await findApplication(pb, student.id, previous.id, code)
  if (!source) throw new HttpError(404, '上一期尚未有此項目申請內容')

  const [sourceForm, targetForm] = await Promise.all([
    loadFormVersion(pb, str(source.form)),
    loadFormVersion(pb, str(application.form)),
  ])
  const copied = copyAnswers(
    flattenFields(sourceForm),
    obj(source.answers_json),
    flattenFields(targetForm),
  )
  await pb.collection('hk_applications').update(str(application.id), {
    answers_json: copied,
    workflow_json: withSubmission(application, {
      status: 'draft',
      completed_at: null,
      last_saved_at: nowIso(),
      copied_from_submission: source.id,
    }),
  })
  await writeAudit(pb, student.id, 'FORM_PREVIOUS_COPIED', str(application.id), {
    from_submission: source.id,
  })
  return json({
    submission_id: application.id,
    answers: copied,
    message: '已套用上一期答案至目前表單版本（不相容欄位已略過）',
  })
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

async function generateApplicationNumber(pb: PocketBase, period: Row, categoryCode: string) {
  const prefix = `HK${str(period.academic_year)}${str(period.semester)}-${categoryCode
    .slice(0, 3)
    .toUpperCase()}-`
  const existing = await pb.collection('hk_applications').getList(1, 1, {
    filter: pb.filter('application_number ~ {:prefix}', { prefix: `${prefix}%` }),
    fields: 'id',
  })
  return `${prefix}${String(existing.totalItems + 1).padStart(4, '0')}`
}

async function submitApplication({ pb, student, body }: Ctx) {
  const id = str(body.submission_id).trim()
  if (!id) throw new HttpError(400, '缺少 submission_id')
  const application = await getOwnApplication(pb, student.id, id)
  if (submissionMeta(application).status !== 'completed') {
    throw new HttpError(400, '請先完成表單填寫')
  }
  const fromStatus = str(application.status)
  if (!EDITABLE_STATUSES.has(fromStatus)) throw new HttpError(400, '此類別已送件，不可重複申請')
  requireConfirmedProfile(student, str(application.period_key))
  const { open } = await periodContext(pb)
  assertCanEdit(application, open)

  const isResubmit = fromStatus === 'returned_for_edit'
  const now = nowIso()
  const workflow = obj(application.workflow_json)
  const history = Array.isArray(workflow.status_history) ? workflow.status_history : []
  const nextWorkflow = {
    ...workflow,
    return_reason: '',
    reject_reason: '',
    supplement_message: '',
    supplement_due_at: null,
    status_history: [
      ...history,
      {
        from_status: isResubmit ? fromStatus : null,
        to_status: 'submitted',
        changed_by_type: 'student',
        changed_by_student: student.id,
        reason: isResubmit ? '學生重新送件' : '學生送件',
        created: now,
      },
    ],
  }

  let saved: Row | null = null
  for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
    const number = str(application.application_number).startsWith('DRAFT-')
      ? await generateApplicationNumber(pb, obj(application.period_json), str(application.category_code))
      : str(application.application_number)
    try {
      saved = (await pb.collection('hk_applications').update(id, {
        application_number: number,
        status: 'submitted',
        submitted_at: now,
        eligibility_status: 'pending',
        edit_override_until: null,
        workflow_json: nextWorkflow,
      })) as Row
    } catch (err) {
      if (attempt >= 4) throw err
    }
  }

  await writeAudit(
    pb,
    student.id,
    isResubmit ? 'APPLICATION_RESUBMITTED' : 'APPLICATION_SUBMITTED',
    id,
    { application_number: saved?.application_number, category: application.category_code },
  )
  return json({
    application: applicationToPlain(saved as Row, student),
    message: isResubmit ? '已重新送件' : '送件成功',
  })
}

async function myApplications({ pb, student }: Ctx) {
  const rows = (await pb.collection('hk_applications').getFullList({
    filter: pb.filter('student = {:sid} && status != "draft"', { sid: student.id }),
    sort: '-submitted_at',
  })) as Row[]
  return json({ items: rows.map((row) => applicationToPlain(row, student)) })
}

async function myApplicationDetail({ pb, student }: Ctx, id: string) {
  const application = await getOwnApplication(pb, student.id, id)
  const workflow = obj(application.workflow_json)
  return json({
    application: applicationToPlain(application, student),
    reviews: [],
    funding: null,
    pending_supplements: [],
    status_history: Array.isArray(workflow.status_history) ? workflow.status_history : [],
  })
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

async function history({ pb, student }: Ctx) {
  const state = readState(student)
  const { open } = await periodContext(pb)
  const periodIds = new Set([
    ...Object.keys(state.period_profiles),
    ...Object.keys(state.category_entries),
  ])
  const categories = await listActiveCategories(pb)
  const nameByCode = new Map(categories.map((c) => [c.code, c.name]))
  const items: Row[] = []
  for (const periodId of periodIds) {
    let period: Period
    try {
      period = await getPeriod(pb, periodId)
    } catch {
      continue
    }
    const entries = state.category_entries[periodId] || {}
    const profile = state.period_profiles[periodId]
    if (!profile && Object.keys(entries).length === 0) continue
    items.push({
      period,
      profile: periodProfileToPlain(student.id, periodId, profile || {}),
      entry_count: Object.keys(entries).length,
      category_names: Object.keys(entries).map((code) => nameByCode.get(code) || code),
      is_current_editable: Boolean(open && open.id === periodId),
    })
  }
  items.sort((a, b) => compareLatestFirst(a.period as Period, b.period as Period))
  return json({ items })
}

async function historyDetail({ pb, student }: Ctx, periodId: string) {
  const { open } = await periodContext(pb)
  if (open && open.id === periodId) throw new HttpError(403, '目前可編輯梯次請至申請頁查看')
  const period = await getPeriod(pb, periodId)
  const state = readState(student)
  const entries = state.category_entries[periodId] || {}
  const profile = state.period_profiles[periodId]
  if (!profile && Object.keys(entries).length === 0) throw new HttpError(403, '無權查看此歷史紀錄')
  const categories = await listActiveCategories(pb)
  const byCode = new Map(categories.map((c) => [c.code, c]))
  return json({
    period,
    profile: periodProfileToPlain(student.id, periodId, profile || {}),
    entries: Object.entries(entries).map(([code, stored]) => {
      const category = byCode.get(code) || null
      return {
        entry: entryToPlain(student.id, periodId, category?.id || code, stored),
        category,
      }
    }),
  })
}

async function formHistory({ pb, student }: Ctx, periodId: string, code: string) {
  const { open } = await periodContext(pb)
  if (open && open.id === periodId) throw new HttpError(403, '目前可編輯梯次請至申請頁查看')
  const [period, category] = await Promise.all([getPeriod(pb, periodId), getCategory(pb, code)])
  const application = await findApplication(pb, student.id, periodId, code)
  if (!application) throw new HttpError(403, '無權查看此歷史表單')
  const form = await loadFormVersion(pb, str(application.form))
  const snapshot = obj(application.submission_snapshot_json)
  const submission = submissionToPlain(application)
  return json({
    period,
    category: { id: category.id, code: category.code, name: category.name },
    submission: {
      id: submission.id,
      status: submission.status,
      current_version_number: submission.current_version_number,
      completed_at: submission.completed_at,
    },
    latest_version: {
      id: `${application.id}:${submission.current_version_number}`,
      version_number: submission.current_version_number,
      reason: str(snapshot.reason) || 'other',
      created: str(snapshot.created) || str(application.updated),
      snapshot,
    },
    schema: toSchema(form),
    answers: obj(snapshot.answers ?? application.answers_json),
    applicant: obj(snapshot.studentProfileSnapshot),
    period_profile: obj(snapshot.periodProfileSnapshot),
  })
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
  { method: 'GET', pattern: /^\/api\/hk\/student\/period-profile\/bootstrap$/, handler: bootstrap },
  { method: 'POST', pattern: /^\/api\/hk\/student\/period-profile\/confirm$/, handler: confirmProfile },
  { method: 'POST', pattern: /^\/api\/hk\/student\/period-profile\/update$/, handler: updateProfile },
  { method: 'GET', pattern: /^\/api\/hk\/student\/current\/categories$/, handler: currentCategories },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/student\/current\/categories\/([^/]+)\/start$/,
    handler: (ctx, [code]) => startCategory(ctx, code, false),
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/student\/current\/categories\/([^/]+)\/copy-previous$/,
    handler: (ctx, [code]) => startCategory(ctx, code, true),
  },
  {
    method: 'GET',
    pattern: /^\/api\/hk\/forms\/by-category\/([^/]+)\/workspace$/,
    handler: (ctx, [code]) => workspace(ctx, code),
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/forms\/submission\/save$/,
    handler: (ctx) => saveSubmission(ctx, 'draft'),
  },
  {
    method: 'POST',
    pattern: /^\/api\/hk\/forms\/submission\/complete$/,
    handler: (ctx) => saveSubmission(ctx, 'complete'),
  },
  { method: 'POST', pattern: /^\/api\/hk\/forms\/submission\/copy-previous$/, handler: copyPreviousAnswers },
  {
    method: 'GET',
    pattern: /^\/api\/hk\/forms\/history\/([^/]+)\/([^/]+)$/,
    handler: (ctx, [periodId, code]) => formHistory(ctx, periodId, code),
  },
  { method: 'POST', pattern: /^\/api\/hk\/applications\/submit$/, handler: submitApplication },
  { method: 'GET', pattern: /^\/api\/hk\/applications\/mine$/, handler: myApplications },
  {
    method: 'GET',
    pattern: /^\/api\/hk\/applications\/mine\/([^/]+)$/,
    handler: (ctx, [id]) => myApplicationDetail(ctx, id),
  },
  { method: 'GET', pattern: /^\/api\/hk\/student\/history$/, handler: history },
  {
    method: 'GET',
    pattern: /^\/api\/hk\/student\/history\/([^/]+)$/,
    handler: (ctx, [periodId]) => historyDetail(ctx, periodId),
  },
]

export async function handleStudentFlow(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  let params: string[] = []
  const route = routes.find((candidate) => {
    if (candidate.method !== request.method) return false
    const match = path.match(candidate.pattern)
    if (!match) return false
    params = match.slice(1).map(decodeURIComponent)
    return true
  })
  if (!route) return null

  const student = await requireStudent(request, env)
  if (student instanceof Response) return student

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

  const body =
    request.method === 'POST' ? (((await request.json().catch(() => ({}))) as Row) ?? {}) : {}

  try {
    return await route.handler({ pb, student, body }, params)
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: 'request_failed', message: err.message, ...err.extra }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '操作失敗' },
      { status: 502 },
    )
  }
}
