import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { adminListFormVersions, adminPreviewFormVersion } from '@/features/form-builder/api'
import type { FormVersionSummary } from '@/features/form-builder/types'
import { adminCreateForm, adminListForms } from '@/features/forms/api'
import { adminListCategories } from '@/features/periods/api'
import type { ApplicationCategory } from '@/types'
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
  const [categories, setCategories] = useState<ApplicationCategory[]>([])
  const [newForm, setNewForm] = useState({ form_code: '', name: '', category_code: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) return
    void adminListForms()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
    void adminListCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [isAdmin])

  async function onCreateForm(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const { schema } = await adminCreateForm({
        form_code: newForm.form_code.trim(),
        name: newForm.name.trim(),
        category_code: newForm.category_code || undefined,
      })
      navigate(`/admin/forms/${schema.form.id}/builder`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '建立表單失敗')
    } finally {
      setCreating(false)
    }
  }

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
  if (error && !items) return <p className="text-sm font-medium text-danger">{error}</p>
  if (!items) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page font-semibold text-foreground">表單主檔</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理表單版本、預覽與開啟 Form Builder。
        </p>
      </div>

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增表單</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={(e) => void onCreateForm(e)}>
            <div className="space-y-2">
              <Label htmlFor="new-form-name">表單名稱</Label>
              <Input
                id="new-form-name"
                value={newForm.name}
                disabled={creating}
                onChange={(e) => setNewForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-form-code">表單代碼</Label>
              <Input
                id="new-form-code"
                value={newForm.form_code}
                placeholder="例：academic_learning"
                pattern="[a-z][a-z0-9_]{1,49}"
                title="小寫英文開頭，只能包含小寫英文、數字與底線"
                disabled={creating}
                onChange={(e) => setNewForm((prev) => ({ ...prev, form_code: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-form-category">申請項目</Label>
              <select
                id="new-form-category"
                className="flex h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-colors hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
                value={newForm.category_code}
                disabled={creating}
                onChange={(e) => setNewForm((prev) => ({ ...prev, category_code: e.target.value }))}
              >
                <option value="">不綁定申請項目</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            {createError ? (
              <p className="text-sm font-medium text-danger sm:col-span-3">{createError}</p>
            ) : null}
            <div className="sm:col-span-3">
              <Button type="submit" disabled={creating}>
                {creating ? '建立中…' : '建立並開啟 Builder'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無表單，請先在上方新增。</p>
        ) : null}
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
