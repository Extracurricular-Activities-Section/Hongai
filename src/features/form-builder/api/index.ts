import { ClientResponseError } from 'pocketbase'

import { staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { FormSchema } from '@/features/forms/types'
import type { BuilderDocument, FormBuilderSession, FormVersionSummary } from '../types'
import { schemaToDocument } from '../types'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) return new Error(message)
    if (Array.isArray(error.response?.issues) && error.response.issues[0]?.message) {
      return new Error(String(error.response.issues[0].message))
    }
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

function toSession(payload: {
  schema: FormSchema
  form?: { id: string; name: string; category_code?: string | null; category_name?: string | null }
}): FormBuilderSession {
  const schema = payload.schema
  return {
    meta: {
      formId: schema.form.id,
      formName: schema.form.name,
      categoryCode: schema.form.category_code || payload.form?.category_code || null,
      categoryName: schema.form.category_name || payload.form?.category_name || null,
      versionId: schema.version.id,
      versionNumber: schema.version.version_number,
      status: schema.version.status,
    },
    document: schemaToDocument(schema),
  }
}

export async function adminListFormVersions(formId: string): Promise<FormVersionSummary[]> {
  try {
    const data = await staffPb.send<{ items: FormVersionSummary[] }>(
      `/api/hk/admin/forms/${formId}/versions`,
      { method: 'GET' },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入表單版本')
  }
}

export async function adminGetFormDraft(formId: string): Promise<FormBuilderSession | null> {
  try {
    const data = await staffPb.send<{ schema: FormSchema }>(
      `/api/hk/admin/forms/${formId}/draft`,
      { method: 'GET' },
    )
    return toSession(data)
  } catch (error) {
    if (error instanceof ClientResponseError && (error.status === 404 || error.status === 400)) {
      return null
    }
    throw mapError(error, '無法載入草稿')
  }
}

export async function adminCreateFormDraft(
  formId: string,
  input?: { from_version_id?: string },
): Promise<FormBuilderSession> {
  try {
    const data = await staffPb.send<{ schema: FormSchema }>(
      `/api/hk/admin/forms/${formId}/draft`,
      {
        method: 'POST',
        body: input || {},
      },
    )
    return toSession(data)
  } catch (error) {
    throw mapError(error, '無法建立草稿')
  }
}

export async function adminLoadOrCreateDraft(
  formId: string,
  fromVersionId?: string,
): Promise<FormBuilderSession> {
  if (fromVersionId) {
    return adminCreateFormDraft(formId, { from_version_id: fromVersionId })
  }
  const existing = await adminGetFormDraft(formId)
  if (existing) return existing
  return adminCreateFormDraft(formId)
}

export async function adminSaveFormSchema(
  formId: string,
  versionId: string,
  document: BuilderDocument,
): Promise<FormBuilderSession> {
  try {
    const data = await staffPb.send<{ schema: FormSchema; saved_at?: string }>(
      `/api/hk/admin/forms/${formId}/versions/${versionId}/schema`,
      {
        method: 'PUT',
        body: {
          sections: document.sections,
          rules: document.rules,
        },
      },
    )
    return toSession(data)
  } catch (error) {
    throw mapError(error, '儲存失敗')
  }
}

export async function adminPublishFormVersion(
  formId: string,
  versionId: string,
): Promise<FormBuilderSession> {
  try {
    const data = await staffPb.send<{ schema: FormSchema }>(
      `/api/hk/admin/forms/${formId}/versions/${versionId}/publish`,
      { method: 'POST', body: {} },
    )
    return toSession(data)
  } catch (error) {
    throw mapError(error, '發布失敗')
  }
}

export { adminPreviewFormVersion } from '@/features/forms/api'
