import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import {
  adminCreateCategoryFollowUpTemplate,
  adminCreateFollowUpTemplate,
  adminListCategoryFollowUpTemplates,
  adminListFollowUpTemplates,
  adminUpdateCategoryFollowUpTemplate,
  adminUpdateFollowUpTemplate,
} from '@/features/follow-up/api'
import type { CategoryFollowUpTemplate, FollowUpTaskTemplate } from '@/features/follow-up/types'
import { followUpTypeLabel } from '@/features/follow-up/utils/status-labels'
import { staffPb } from '@/lib/pocketbase'
import { HAD_COLLECTIONS } from '@/lib/pocketbase/collections'

interface CategoryOption {
  id: string
  code: string
  name: string
}

const EMPTY_TEMPLATE = {
  name: '',
  code: '',
  description: '',
  task_type: 'file_upload',
  allowed_extensions: 'pdf,jpg,jpeg,png',
  max_files: '3',
  max_file_size_mb: '10',
  requires_review: true,
  required: true,
  default_due_offset_days: '30',
  active: true,
  student_instructions: '',
  review_instructions: '',
}

export function AdminFollowUpTemplatesPage() {
  const { isAdmin } = useBackofficeAuth()
  const [templates, setTemplates] = useState<FollowUpTaskTemplate[] | null>(null)
  const [assignments, setAssignments] = useState<CategoryFollowUpTemplate[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_TEMPLATE)
  const [assignForm, setAssignForm] = useState({
    category_id: '',
    task_template_id: '',
    required: true,
    sort_order: '0',
    active: true,
  })

  const load = useCallback(async () => {
    const [tpl, asg, cats] = await Promise.all([
      adminListFollowUpTemplates(),
      adminListCategoryFollowUpTemplates(),
      staffPb.collection(HAD_COLLECTIONS.applicationCategories).getFullList<{
        id: string
        code: string
        name: string
      }>({ sort: 'sort_order' }),
    ])
    setTemplates(tpl)
    setAssignments(asg)
    setCategories(cats.map((c) => ({ id: c.id, code: c.code, name: c.name })))
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin, load])

  if (!isAdmin) return <Navigate to="/admin" replace />
  if (error && !templates) return <p className="text-sm text-red-700">{error}</p>
  if (!templates) return <p className="text-sm text-muted-foreground">載入中…</p>

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_TEMPLATE)
  }

  function startEdit(item: FollowUpTaskTemplate) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      code: item.code,
      description: item.description || '',
      task_type: item.task_type,
      allowed_extensions: (item.allowed_extensions || []).join(','),
      max_files: String(item.max_files ?? ''),
      max_file_size_mb: String(item.max_file_size_mb ?? ''),
      requires_review: item.requires_review,
      required: item.required,
      default_due_offset_days: String(item.default_due_offset_days ?? ''),
      active: item.active,
      student_instructions: item.student_instructions || '',
      review_instructions: item.review_instructions || '',
    })
  }

  async function saveTemplate() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        task_type: form.task_type,
        allowed_extensions: form.allowed_extensions
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        max_files: Number(form.max_files) || undefined,
        max_file_size_mb: Number(form.max_file_size_mb) || undefined,
        requires_review: form.requires_review,
        required: form.required,
        default_due_offset_days: Number(form.default_due_offset_days) || undefined,
        active: form.active,
        student_instructions: form.student_instructions.trim() || undefined,
        review_instructions: form.review_instructions.trim() || undefined,
      }
      if (editingId) {
        await adminUpdateFollowUpTemplate(editingId, payload)
        setMessage('範本已更新')
      } else {
        await adminCreateFollowUpTemplate(payload)
        setMessage('範本已建立')
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function saveAssignment() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await adminCreateCategoryFollowUpTemplate({
        category_id: assignForm.category_id,
        task_template_id: assignForm.task_template_id,
        required: assignForm.required,
        sort_order: Number(assignForm.sort_order) || 0,
        active: assignForm.active,
      })
      setMessage('類別指派已建立')
      setAssignForm({
        category_id: '',
        task_template_id: '',
        required: true,
        sort_order: '0',
        active: true,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '指派失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">追蹤任務範本</h1>
        <p className="mt-2 text-sm text-muted-foreground">管理範本與申請類別的預設指派。</p>
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? '編輯範本' : '新增範本'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-muted-foreground">名稱 *</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">代碼 *</span>
            <Input
              value={form.code}
              disabled={Boolean(editingId)}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">說明</span>
            <Input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">任務類型</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.task_type}
              onChange={(e) => setForm((prev) => ({ ...prev, task_type: e.target.value }))}
            >
              <option value="file_upload">檔案上傳</option>
              <option value="text">文字回報</option>
              <option value="file_and_text">檔案與文字</option>
              <option value="event_attendance">活動出席</option>
              <option value="confirmation">確認事項</option>
              <option value="other">其他</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">允許副檔名（逗號分隔）</span>
            <Input
              value={form.allowed_extensions}
              onChange={(e) => setForm((prev) => ({ ...prev, allowed_extensions: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">最多檔案數</span>
            <Input
              value={form.max_files}
              onChange={(e) => setForm((prev) => ({ ...prev, max_files: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">單檔上限 MB</span>
            <Input
              value={form.max_file_size_mb}
              onChange={(e) => setForm((prev) => ({ ...prev, max_file_size_mb: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">預設截止天數</span>
            <Input
              value={form.default_due_offset_days}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, default_due_offset_days: e.target.value }))
              }
            />
          </label>
          <label className="flex items-center gap-2 self-end">
            <input
              type="checkbox"
              checked={form.requires_review}
              onChange={(e) => setForm((prev) => ({ ...prev, requires_review: e.target.checked }))}
            />
            需審核
          </label>
          <label className="flex items-center gap-2 self-end">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => setForm((prev) => ({ ...prev, required: e.target.checked }))}
            />
            必填任務
          </label>
          <label className="flex items-center gap-2 self-end">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            啟用
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">學生說明</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.student_instructions}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, student_instructions: e.target.value }))
              }
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">審核說明</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.review_instructions}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, review_instructions: e.target.value }))
              }
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" disabled={busy} onClick={() => void saveTemplate()}>
              {busy ? '儲存中…' : editingId ? '更新範本' : '新增範本'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                取消編輯
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">範本列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {templates.length === 0 ? (
            <p className="text-muted-foreground">尚無範本。</p>
          ) : (
            templates.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-medium">
                    {item.name}（{item.code}）
                  </p>
                  <p className="text-muted-foreground">
                    {followUpTypeLabel(item.task_type)} · {item.active ? '啟用' : '停用'} ·{' '}
                    {item.required ? '必填' : '選填'}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                  編輯
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">類別指派</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={assignForm.category_id}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, category_id: e.target.value }))}
            >
              <option value="">選擇類別</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.code}）
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={assignForm.task_template_id}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, task_template_id: e.target.value }))
              }
            >
              <option value="">選擇範本</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="排序"
              value={assignForm.sort_order}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={assignForm.required}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, required: e.target.checked }))}
              />
              必填
            </label>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy || !assignForm.category_id || !assignForm.task_template_id}
            onClick={() => void saveAssignment()}
          >
            新增指派
          </Button>

          <div className="space-y-2 border-t border-border pt-3">
            {assignments.length === 0 ? (
              <p className="text-muted-foreground">尚無類別指派。</p>
            ) : (
              assignments.map((asg) => {
                const category = categories.find((c) => c.id === asg.category)
                const template = templates.find((t) => t.id === asg.task_template)
                return (
                  <div
                    key={asg.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {category?.name || asg.category} → {template?.name || asg.task_template}
                      </p>
                      <p className="text-muted-foreground">
                        排序 {asg.sort_order} · {asg.required ? '必填' : '選填'} ·{' '}
                        {asg.active ? '啟用' : '停用'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void (async () => {
                          setBusy(true)
                          try {
                            await adminUpdateCategoryFollowUpTemplate(asg.id, {
                              active: !asg.active,
                            })
                            await load()
                          } catch (err) {
                            setError(err instanceof Error ? err.message : '更新失敗')
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                    >
                      {asg.active ? '停用' : '啟用'}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
