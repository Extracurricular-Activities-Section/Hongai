import type PocketBase from 'pocketbase'

import { requireStaff, type StaffAuthContext } from '../lib/auth-staff'
import { categoryFromSetting, categoryKey } from '../lib/categories'
import { schemaJson, toSchema } from '../lib/forms'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * Form Builder APIs on hk_forms.
 * One hk_forms row = one form version; rows are grouped by form_code, which the
 * frontend uses as the form id. Sections / fields / rules live in schema_json.
 */

type Row = Record<string, unknown>

const FORM_CODE_PATTERN = /^[a-z][a-z0-9_]{1,49}$/

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const str = (value: unknown): string => (value == null ? '' : String(value))
const nullable = (value: unknown): string | null => (value ? String(value) : null)
const asArray = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

function toVersionSummary(record: Row) {
  return {
    id: str(record.id),
    version_number: Number(record.version) || 1,
    status: str(record.status),
    published_at: nullable(record.published_at),
    notes: nullable(record.notes),
    created: str(record.created),
    updated: str(record.updated),
  }
}

/** Fill in ids / sort orders and drop rules that point at unknown fields. */
function normalizeSchema(sectionsInput: unknown, rulesInput: unknown) {
  const fieldCodes = new Set<string>()
  const sections = asArray(sectionsInput).map((section, s) => {
    const fields = asArray(section.fields).map((field, f) => {
      const code = str(field.code) || `field_${s + 1}_${f + 1}`
      fieldCodes.add(code)
      return {
        ...field,
        id: str(field.id) || crypto.randomUUID(),
        code,
        label: str(field.label) || '欄位',
        field_type: str(field.field_type) || 'text',
        required: Boolean(field.required),
        sort_order: Number(field.sort_order) || f + 1,
        pdf_visible: field.pdf_visible !== false,
        copy_previous: field.copy_previous !== false,
        active: field.active !== false,
        options: asArray(field.options).map((option, o) => ({
          ...option,
          id: str(option.id) || crypto.randomUUID(),
          value: str(option.value) || `option_${o + 1}`,
          label: str(option.label) || '選項',
          sort_order: Number(option.sort_order) || o + 1,
          active: option.active !== false,
        })),
      }
    })
    return {
      ...section,
      id: str(section.id) || crypto.randomUUID(),
      code: str(section.code) || `section_${s + 1}`,
      title: str(section.title) || '區塊',
      sort_order: Number(section.sort_order) || s + 1,
      visible: section.visible !== false,
      pdf_visible: section.pdf_visible !== false,
      fields,
    }
  })
  const rules = asArray(rulesInput)
    .filter((rule) => fieldCodes.has(str(rule.field_code)))
    .map((rule, r) => ({
      ...rule,
      id: str(rule.id) || crypto.randomUUID(),
      rule_type: str(rule.rule_type) || 'show_if',
      operator: str(rule.operator) || 'equals',
      sort_order: Number(rule.sort_order) || r + 1,
    }))
  return { sections, rules }
}

async function listVersions(pb: PocketBase, formCode: string): Promise<Row[]> {
  return (await pb.collection('hk_forms').getFullList({
    filter: pb.filter('form_code = {:code}', { code: formCode }),
    sort: '-version',
  })) as Row[]
}

async function requireVersions(pb: PocketBase, formCode: string): Promise<Row[]> {
  const versions = await listVersions(pb, formCode)
  if (!versions.length) throw new HttpError(404, '找不到表單')
  return versions
}

function findVersion(versions: Row[], versionId: string): Row {
  const version = versions.find((v) => v.id === versionId)
  if (!version) throw new HttpError(400, '版本與表單不符')
  return version
}

async function writeAudit(
  pb: PocketBase,
  staff: StaffAuthContext,
  action: string,
  targetId: string,
  payload: Row,
) {
  try {
    await pb.collection('hk_events').create({
      event_type: 'audit',
      event_key: action,
      actor_staff: staff.id,
      target_type: 'form_version',
      target_id: targetId,
      payload_json: payload,
      occurred_at: new Date().toISOString(),
    })
  } catch {
    // audit is best-effort
  }
}

async function createForm(pb: PocketBase, staff: StaffAuthContext, body: Row) {
  const formCode = str(body.form_code).trim()
  const name = str(body.name).trim()
  const categoryCode = str(body.category_code).trim()
  if (!FORM_CODE_PATTERN.test(formCode)) {
    throw new HttpError(400, '表單代碼須為小寫英文開頭，只能包含小寫英文、數字與底線（2–50 字）')
  }
  if (!name) throw new HttpError(400, '請填寫表單名稱')
  if ((await listVersions(pb, formCode)).length) throw new HttpError(400, '表單代碼已存在')

  let categoryName = ''
  if (categoryCode) {
    try {
      const category = await pb
        .collection('hk_settings')
        .getFirstListItem(pb.filter('key = {:key}', { key: categoryKey(categoryCode) }))
      categoryName = categoryFromSetting(category as Row).name
    } catch {
      throw new HttpError(400, '找不到申請項目')
    }
  }

  const record = (await pb.collection('hk_forms').create({
    form_code: formCode,
    name,
    description: str(body.description).trim(),
    category_code: categoryCode,
    category_name: categoryName,
    version: 1,
    status: 'draft',
    schema_json: { sections: [], rules: [] },
    active: true,
    notes: '新建表單',
  })) as Row
  await writeAudit(pb, staff, 'form_created', str(record.id), { form_code: formCode })
  return record
}

async function createDraft(pb: PocketBase, staff: StaffAuthContext, formCode: string, body: Row) {
  const versions = await requireVersions(pb, formCode)
  const fromVersionId = str(body.from_version_id).trim()
  const existingDraft = versions.find((v) => v.status === 'draft')

  if (existingDraft && !fromVersionId) return existingDraft

  const source = fromVersionId
    ? findVersion(versions, fromVersionId)
    : versions.find((v) => v.status === 'published') || versions[0]
  const sourceNumber = Number(source.version) || 1

  let draft: Row
  if (existingDraft) {
    draft = (await pb.collection('hk_forms').update(str(existingDraft.id), {
      schema_json: schemaJson(source),
      notes: `Cloned from V${sourceNumber}`,
    })) as Row
  } else {
    draft = (await pb.collection('hk_forms').create({
      form_code: formCode,
      name: source.name,
      description: source.description,
      category_code: source.category_code,
      category_name: source.category_name,
      category_json: source.category_json,
      version: (Number(versions[0].version) || 0) + 1,
      status: 'draft',
      schema_json: schemaJson(source),
      active: true,
      notes: `Draft from V${sourceNumber}`,
    })) as Row
  }
  await writeAudit(pb, staff, 'form_draft_created', str(draft.id), {
    form_code: formCode,
    from_version_id: source.id,
  })
  return draft
}

export async function handleAdminForms(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  const match = path.match(
    /^\/api\/hk\/admin\/forms(?:\/([^/]+)(?:\/(versions|draft)(?:\/([^/]+)\/(schema|publish|preview))?)?)?$/,
  )
  if (!match) return null
  const [, rawCode, segment, rawVersionId, action] = match
  const method = request.method
  // GET /api/hk/admin/forms (list) is served by admin-read.
  if (!rawCode && method === 'GET') return null

  const staff = await requireStaff(request, env)
  if (staff instanceof Response) return staff
  const canManage = staff.is_admin || Boolean(staff.can_manage_forms)
  const canPublish = staff.is_admin || Boolean(staff.can_publish_forms)
  if (!canManage) {
    return json({ error: 'forbidden', message: '沒有管理表單的權限' }, { status: 403 })
  }

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

  const formCode = rawCode ? decodeURIComponent(rawCode) : ''
  const versionId = rawVersionId ? decodeURIComponent(rawVersionId) : ''
  const body = method === 'GET' ? {} : (((await request.json().catch(() => ({}))) as Row) ?? {})

  try {
    if (!rawCode && method === 'POST') {
      const record = await createForm(pb, staff, body)
      return json({ schema: toSchema(record) })
    }

    if (segment === 'versions' && !action && method === 'GET') {
      const versions = await requireVersions(pb, formCode)
      return json({ items: versions.map(toVersionSummary) })
    }

    if (segment === 'draft' && !action && method === 'GET') {
      const versions = await requireVersions(pb, formCode)
      const draft = versions.find((v) => v.status === 'draft')
      if (!draft) return json({ error: 'not_found', message: '尚無草稿' }, { status: 404 })
      return json({ schema: toSchema(draft) })
    }

    if (segment === 'draft' && !action && method === 'POST') {
      const draft = await createDraft(pb, staff, formCode, body)
      return json({ schema: toSchema(draft) })
    }

    if (segment === 'versions' && action === 'preview' && method === 'GET') {
      const version = findVersion(await requireVersions(pb, formCode), versionId)
      return json({ schema: toSchema(version) })
    }

    if (segment === 'versions' && action === 'schema' && method === 'PUT') {
      const version = findVersion(await requireVersions(pb, formCode), versionId)
      if (version.status !== 'draft') throw new HttpError(400, '僅草稿可儲存 schema')
      const saved = (await pb.collection('hk_forms').update(versionId, {
        schema_json: normalizeSchema(body.sections, body.rules),
      })) as Row
      await writeAudit(pb, staff, 'form_draft_saved', versionId, { form_code: formCode })
      return json({ schema: toSchema(saved), saved_at: new Date().toISOString() })
    }

    if (segment === 'versions' && action === 'publish' && method === 'POST') {
      if (!canPublish) {
        return json({ error: 'forbidden', message: '沒有發布表單的權限' }, { status: 403 })
      }
      const versions = await requireVersions(pb, formCode)
      const version = findVersion(versions, versionId)
      if (version.status !== 'draft') throw new HttpError(400, '僅草稿可發布')
      if (!schemaJson(version).sections.length) throw new HttpError(400, '至少需要一個區塊')

      for (const previous of versions) {
        if (previous.status === 'published' && previous.id !== versionId) {
          await pb.collection('hk_forms').update(str(previous.id), { status: 'retired' })
        }
      }
      const published = (await pb.collection('hk_forms').update(versionId, {
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: staff.id,
        active: true,
      })) as Row
      await writeAudit(pb, staff, 'form_version_published', versionId, {
        form_code: formCode,
        version_number: published.version,
      })
      return json({ schema: toSchema(published) })
    }

    return null
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: 'bad_request', message: err.message }, { status: err.status })
    }
    const status = (err as { status?: number }).status === 404 ? 404 : 502
    return json(
      {
        error: status === 404 ? 'not_found' : 'pb_error',
        message: status === 404 ? '找不到表單' : err instanceof Error ? err.message : '操作失敗',
      },
      { status },
    )
  }
}
