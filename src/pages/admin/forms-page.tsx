import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { adminListFormVersions, adminPreviewFormVersion } from '@/features/form-builder/api'
import type { FormVersionSummary } from '@/features/form-builder/types'
import { adminListForms } from '@/features/forms/api'
import { DynamicFormRenderer } from '@/features/forms/components/dynamic-form-renderer'
import { buildInitialValues, evaluateRules } from '@/features/forms/engine'
import type { FormSchema } from '@/features/forms/types'

function versionStatusLabel(status: string): string {
  if (status === 'draft') return '草稿'
  if (status === 'published') return '已發布'
  if (status === 'retired') return '已退役'
  return status
}

export function AdminFormsPage() {
  const { isAdmin } = useBackofficeAuth()
  const [items, setItems] = useState<Awaited<ReturnType<typeof adminListForms>> | null>(null)
  const [versionsByForm, setVersionsByForm] = useState<Record<string, FormVersionSummary[]>>({})
  const [previewSchema, setPreviewSchema] = useState<FormSchema | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingVersions, setLoadingVersions] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    void adminListForms()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin])

  const previewValues = useMemo(
    () => (previewSchema ? buildInitialValues(previewSchema) : {}),
    [previewSchema],
  )
  const fieldState = useMemo(
    () => (previewSchema ? evaluateRules(previewSchema, previewValues) : {}),
    [previewSchema, previewValues],
  )

  async function ensureVersions(formId: string) {
    if (versionsByForm[formId]) return versionsByForm[formId]
    setLoadingVersions(formId)
    try {
      const versions = await adminListFormVersions(formId)
      setVersionsByForm((current) => ({ ...current, [formId]: versions }))
      return versions
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入版本失敗')
      return []
    } finally {
      setLoadingVersions(null)
    }
  }

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">僅管理員可查看表單主檔。</p>
  }
  if (error && !items) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">表單主檔</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理表單版本、預覽與開啟 Form Builder。
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        {items.map((item) => {
          const versions = versionsByForm[item.id] || []
          const draft = versions.find((version) => version.status === 'draft')
          return (
            <Card key={item.id}>
              <CardContent className="space-y-3 py-4 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">
                      {item.category_name}（{item.category_code}）· Published V
                      {item.current_published_version_number ?? '—'} · {item.current_published_status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!item.current_published_version_id}
                      onClick={() => {
                        if (!item.current_published_version_id) return
                        void adminPreviewFormVersion(item.id, item.current_published_version_id)
                          .then((data) => setPreviewSchema(data.schema))
                          .catch((err) => setError(err instanceof Error ? err.message : '預覽失敗'))
                      }}
                    >
                      Preview
                    </Button>
                    <Button type="button" size="sm" asChild>
                      <Link to={`/admin/forms/${item.id}/builder`}>開啟 Builder</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void ensureVersions(item.id)}
                    >
                      {loadingVersions === item.id ? '載入版本…' : '顯示版本'}
                    </Button>
                  </div>
                </div>

                {versions.length > 0 ? (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">版本列表</p>
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p>
                          V{version.version_number} · {versionStatusLabel(version.status)}
                          {draft?.id === version.id ? '（目前草稿）' : ''}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void adminPreviewFormVersion(item.id, version.id)
                                .then((data) => setPreviewSchema(data.schema))
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : '預覽失敗'),
                                )
                            }}
                          >
                            Preview
                          </Button>
                          {version.status === 'draft' ? (
                            <Button type="button" size="sm" asChild>
                              <Link to={`/admin/forms/${item.id}/builder`}>開啟 Builder</Link>
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link to={`/admin/forms/${item.id}/builder?from=${version.id}`}>
                                從某版建立 Draft
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {previewSchema ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Preview：{previewSchema.form.name}（V{previewSchema.version.version_number}）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicFormRenderer
              schema={previewSchema}
              values={previewValues}
              fieldState={fieldState}
              mode="readonly"
            />
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="outline">
        <Link to="/admin">返回儀表板</Link>
      </Button>
    </div>
  )
}
