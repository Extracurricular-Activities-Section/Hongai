/**
 * CSV (Excel-openable) export / import for the case list.
 *
 *   GET  /api/hk/admin/applications/export.csv   authorized cases, one row per application
 *        ?format=items                           funding-item template for the import below
 *   POST /api/hk/admin/applications/import.csv   admin only — update approved amounts
 *        columns: application_number,item_code,approved_amount
 *
 * Import goes through the same createFunding path as the case page, so status, per-item cap,
 * annual limit and audit rules all apply. It cannot override the annual limit.
 */

import type PocketBase from 'pocketbase'

import {
  WorkflowError,
  extractRequestedFunding,
  latestFinalDecision,
  writeAudit,
} from '../lib/application-workflow'
import { applicationToPlain } from '../lib/applications'
import { contentDisposition } from '../lib/attachments'
import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { authorizedCategoryCodes } from '../lib/category-funding-stats'
import { numericCell, parseCsvRecords, toCsv } from '../lib/csv'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import { applicationFilter } from './admin-read'
import { createFunding, extractedFor } from './admin-applications'

type Row = Record<string, unknown>

const str = (value: unknown): string => (value == null ? '' : String(value)).trim()
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
const arr = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const MAX_EXPORT_ROWS = 5000
const MAX_IMPORT_ROWS = 1000
const MAX_IMPORT_APPLICATIONS = 50
const MAX_CSV_CHARS = 1_000_000
const DEFAULT_CHANGE_REASON = 'CSV 批次調整核定金額'

const STATUS_LABELS: Record<string, string> = {
  submitted: '已送件',
  teacher_signed: '老師已簽核',
  eligibility_review: '資格審核中',
  under_review: '內容審核中',
  supplement_required: '待補件',
  returned_for_edit: '退回修改',
  approved: '審核通過',
  rejected: '不通過',
  funding_pending: '待核定',
  funding_decided: '已核定',
  closed: '已結案',
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDisposition(filename, 'attachment'),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

async function scopedFilter(pb: PocketBase, staff: StaffAuthContext, url: URL): Promise<string | null> {
  const base = applicationFilter(pb, url)
  const allowed = await authorizedCategoryCodes(pb, staff)
  if (allowed === null) return base
  if (allowed.size === 0) return null
  const params: Record<string, string> = {}
  const terms = [...allowed].map((code, index) => {
    params[`c${index}`] = code
    return `category_code = {:c${index}}`
  })
  return `${base} && (${pb.filter(terms.join(' || '), params)})`
}

async function fetchApplications(pb: PocketBase, filter: string): Promise<Row[]> {
  const probe = await pb.collection('hk_applications').getList(1, 1, { filter, fields: 'id' })
  if (probe.totalItems > MAX_EXPORT_ROWS) {
    throw new HttpError(400, `符合條件的案件有 ${probe.totalItems} 筆，超過匯出上限 ${MAX_EXPORT_ROWS}，請縮小篩選範圍。`)
  }
  return (await pb.collection('hk_applications').getFullList({
    filter,
    sort: '-created',
    expand: 'student',
    batch: 200,
  })) as Row[]
}

async function exportApplications(pb: PocketBase, staff: StaffAuthContext, url: URL): Promise<Response> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const itemsMode = url.searchParams.get('format') === 'items'
  const filter = await scopedFilter(pb, staff, url)

  const headers = itemsMode
    ? ['application_number', 'item_code', 'approved_amount', 'student_no', 'name', 'item_label', 'requested_amount']
    : ['申請編號', '學號', '姓名', '系所', '項目', '梯次', '狀態', '申請額', '核定額']
  if (filter === null) return csvResponse(toCsv(headers, []), `applications-${stamp}.csv`)

  const rows: Array<Array<unknown>> = []

  if (!itemsMode) {
    for (const record of await fetchApplications(pb, filter)) {
      const app = applicationToPlain(record)
      rows.push([
        app.application_number,
        app.student_no,
        app.student_name,
        app.department_name,
        app.category_name,
        app.period_name,
        STATUS_LABELS[str(app.status)] || app.status,
        app.requested_amount == null ? '' : numericCell(app.requested_amount),
        app.approved_amount == null ? '' : numericCell(app.approved_amount),
      ])
    }
    return csvResponse(toCsv(headers, rows), `applications-${stamp}.csv`)
  }

  // Item template: only cases whose funding can be decided/revised.
  const itemFilter = `${filter} && (status = "funding_pending" || status = "funding_decided")`
  const forms = new Map<string, Row | null>()
  for (const record of await fetchApplications(pb, itemFilter)) {
    const app = applicationToPlain(record)
    const formId = str(record.form)
    if (!forms.has(formId)) {
      forms.set(
        formId,
        await pb
          .collection('hk_forms')
          .getOne(formId)
          .then((form) => form as Row)
          .catch(() => null),
      )
    }
    const form = forms.get(formId)
    if (!form) continue
    const snapshot = obj(record.submission_snapshot_json)
    const extracted = extractRequestedFunding(
      form,
      obj(snapshot.answers ?? record.answers_json),
      str(record.category_code),
    )
    const approvedByCode = new Map(
      arr(latestFinalDecision(record)?.items).map((item) => [str(item.item_code), num(item.approved_amount)]),
    )
    for (const item of extracted.items) {
      rows.push([
        app.application_number,
        item.item_code,
        approvedByCode.has(item.item_code) ? numericCell(approvedByCode.get(item.item_code)) : '',
        app.student_no,
        app.student_name,
        item.item_label,
        numericCell(item.requested_amount),
      ])
    }
  }
  return csvResponse(toCsv(headers, rows), `funding-items-${stamp}.csv`)
}

// ---------------------------------------------------------------------------
// Import (approved amounts)
// ---------------------------------------------------------------------------

type ImportError = { application_number: string; message: string }

async function importApprovedAmounts(
  pb: PocketBase,
  staff: StaffAuthContext,
  request: Request,
): Promise<Response> {
  const contentType = request.headers.get('content-type') || ''
  let csv = ''
  let changeReason = DEFAULT_CHANGE_REASON
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Row
    csv = typeof body.csv === 'string' ? body.csv : ''
    changeReason = str(body.change_reason) || DEFAULT_CHANGE_REASON
  } else {
    csv = await request.text()
  }
  if (!csv.trim()) throw new HttpError(400, '請上傳 CSV 內容')
  if (csv.length > MAX_CSV_CHARS) throw new HttpError(400, 'CSV 檔案過大（上限約 1MB）')

  const { headers, records } = parseCsvRecords(csv)
  if (!headers.includes('application_number') || !headers.includes('approved_amount')) {
    throw new HttpError(400, 'CSV 需包含欄位：application_number,item_code,approved_amount（item_code 在單一項目案件可留空）')
  }
  if (records.length === 0) throw new HttpError(400, 'CSV 沒有資料列')
  if (records.length > MAX_IMPORT_ROWS) throw new HttpError(400, `資料列超過上限 ${MAX_IMPORT_ROWS}`)

  const errors: ImportError[] = []
  const byApplication = new Map<string, Array<{ item_code: string; amount: number; line: number }>>()
  records.forEach((record, index) => {
    const line = index + 2
    const number = record.application_number
    const raw = record.approved_amount
    const amount = Number(raw)
    if (!number) {
      errors.push({ application_number: `第 ${line} 列`, message: '缺少 application_number' })
    } else if (raw === '' || !Number.isFinite(amount) || amount < 0) {
      errors.push({ application_number: number, message: `第 ${line} 列：approved_amount 必須為不小於 0 的數字` })
    } else {
      const list = byApplication.get(number) ?? []
      list.push({ item_code: record.item_code || '', amount, line })
      byApplication.set(number, list)
    }
  })
  if (byApplication.size > MAX_IMPORT_APPLICATIONS) {
    throw new HttpError(400, `單次最多更新 ${MAX_IMPORT_APPLICATIONS} 件案件（目前 ${byApplication.size} 件），請分批匯入。`)
  }

  const updated: Array<{ application_number: string; approved_total: number }> = []

  for (const [number, lines] of byApplication) {
    try {
      const application = (await pb.collection('hk_applications').getFirstListItem(
        pb.filter('application_number = {:n} && status != "draft"', { n: number }),
        { expand: 'student' },
      )) as Row
      const status = str(application.status)
      if (status !== 'funding_pending' && status !== 'funding_decided') {
        throw new WorkflowError(400, `目前狀態「${STATUS_LABELS[status] || status}」不可更新核定金額`)
      }

      const extracted = await extractedFor(pb, application)
      const codes = new Set(extracted.items.map((item) => item.item_code))
      const amounts = new Map<string, number>()
      for (const line of lines) {
        let code = line.item_code
        if (!code) {
          if (extracted.items.length !== 1) {
            throw new WorkflowError(400, `第 ${line.line} 列：此案件有多個項目，請填寫 item_code`)
          }
          code = extracted.items[0].item_code
        }
        if (!codes.has(code)) throw new WorkflowError(400, `第 ${line.line} 列：未知項目 ${code}`)
        if (amounts.has(code)) throw new WorkflowError(400, `項目 ${code} 重複出現`)
        amounts.set(code, line.amount)
      }

      // Items not in the CSV keep their current approved amount; with no prior decision all items are required.
      const previous = new Map(
        arr(latestFinalDecision(application)?.items).map((item) => [str(item.item_code), num(item.approved_amount)]),
      )
      const items = extracted.items.map((item) => {
        if (amounts.has(item.item_code)) return { item_code: item.item_code, approved_amount: amounts.get(item.item_code) }
        if (previous.has(item.item_code)) {
          return { item_code: item.item_code, approved_amount: previous.get(item.item_code) }
        }
        throw new WorkflowError(400, `尚無核定紀錄，請提供所有項目（缺少 ${item.item_code}）`)
      })

      await createFunding(
        {
          pb,
          staff,
          body: {
            items,
            change_reason: changeReason,
            decision_note: 'CSV 批次匯入',
            notify_student: false,
          },
        },
        str(application.id),
      )
      updated.push({
        application_number: number,
        approved_total: items.reduce((sum, item) => sum + num(item.approved_amount), 0),
      })
    } catch (err) {
      const message =
        err instanceof WorkflowError || err instanceof HttpError
          ? err.message
          : (err as { status?: number })?.status === 404
            ? '找不到案件'
            : err instanceof Error
              ? err.message
              : '更新失敗'
      errors.push({ application_number: number, message })
    }
  }

  await writeAudit(pb, {
    actorStaff: staff.id,
    action: 'APPLICATIONS_CSV_IMPORTED',
    targetId: 'applications_csv',
    payload: { updated: updated.length, errors: errors.length },
  })

  return json({
    updated,
    errors,
    message: `已更新 ${updated.length} 件案件核定金額${errors.length ? `，${errors.length} 筆失敗` : ''}。`,
  })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const EXPORT_PATH = '/api/hk/admin/applications/export.csv'
const IMPORT_PATH = '/api/hk/admin/applications/import.csv'

export async function handleAdminApplicationsCsv(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  const isExport = request.method === 'GET' && path === EXPORT_PATH
  const isImport = request.method === 'POST' && path === IMPORT_PATH
  if (!isExport && !isImport) return null

  const staff = await requireStaff(request, env, { adminOnly: isImport })
  if (staff instanceof Response) return staff

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
    return isExport
      ? await exportApplications(pb, staff, new URL(request.url))
      : await importApprovedAmounts(pb, staff, request)
  } catch (err) {
    if (err instanceof HttpError || err instanceof WorkflowError) {
      return json({ error: 'request_failed', message: err.message }, { status: err.status })
    }
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '操作失敗' },
      { status: 502 },
    )
  }
}
