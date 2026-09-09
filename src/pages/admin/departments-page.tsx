import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import {
  adminListCategoryDepartmentAssignments,
  adminListDepartmentsApi,
  adminSaveCategoryDepartmentAssignment,
  adminSaveDepartment,
} from '@/features/applications/api'
import type { CategoryDepartmentAssignment } from '@/features/applications/types'
import { adminListCategories } from '@/features/periods/api'
import type { ApplicationCategory, Department } from '@/types'

export function AdminDepartmentsPage() {
  const { isAdmin } = useBackofficeAuth()
  const [items, setItems] = useState<Department[] | null>(null)
  const [categories, setCategories] = useState<ApplicationCategory[]>([])
  const [assignments, setAssignments] = useState<CategoryDepartmentAssignment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    id: '',
    name: '',
    code: '',
    description: '',
    sort_order: '0',
    active: true,
  })

  const [assignForm, setAssignForm] = useState({
    category: '',
    department: '',
    assignment_type: 'primary',
  })

  async function load() {
    const [depts, cats, assigns] = await Promise.all([
      adminListDepartmentsApi(),
      adminListCategories(),
      adminListCategoryDepartmentAssignments(),
    ])
    setItems(depts)
    setCategories(cats)
    setAssignments(assigns)
  }

  useEffect(() => {
    if (!isAdmin) return
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin])

  if (!isAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (error && !items) return <p className="text-sm font-medium text-danger">{error}</p>
  if (!items) return <PageSkeleton />

  function resetForm() {
    setForm({
      id: '',
      name: '',
      code: '',
      description: '',
      sort_order: '0',
      active: true,
    })
  }

  async function handleSaveDepartment() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await adminSaveDepartment({
        id: form.id || undefined,
        name: form.name,
        code: form.id ? undefined : form.code,
        description: form.description,
        sort_order: Number(form.sort_order) || 0,
        active: form.active,
      })
      setMessage(form.id ? '單位已更新' : '單位已建立')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate(id: string) {
    setBusy(true)
    setError(null)
    try {
      await adminSaveDepartment({ id, deactivate: true })
      setMessage('單位已停用')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '停用失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveAssignment() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await adminSaveCategoryDepartmentAssignment({
        category: assignForm.category,
        department: assignForm.department,
        assignment_type: assignForm.assignment_type,
        active: true,
      })
      setMessage('類別單位指派已儲存')
      setAssignForm({ category: '', department: '', assignment_type: 'primary' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '指派失敗')
    } finally {
      setBusy(false)
    }
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || id
  const departmentName = (id: string) => items.find((d) => d.id === id)?.name || id

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page font-semibold text-foreground">單位管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理承辦單位，以及申請類別對應的主責／協辦單位。
        </p>
      </div>

      {message ? <p className="text-sm font-medium text-success">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-medium">單位列表</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無單位。</p>
          ) : (
            items.map((dept) => (
              <Card key={dept.id}>
                <CardContent className="flex items-start justify-between gap-3 py-4 text-sm">
                  <div>
                    <p className="font-medium">
                      {dept.name}（{dept.code}）
                      {!dept.active ? ' · 停用' : ''}
                    </p>
                    <p className="text-muted-foreground">{dept.description || '—'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({
                          id: dept.id,
                          name: dept.name,
                          code: dept.code,
                          description: dept.description || '',
                          sort_order: String(dept.sort_order ?? 0),
                          active: dept.active,
                        })
                      }
                    >
                      編輯
                    </Button>
                    {dept.active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleDeactivate(dept.id)}
                      >
                        停用
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{form.id ? '編輯單位' : '新增單位'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Input
              placeholder="名稱"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="代碼"
              value={form.code}
              disabled={!!form.id}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Input
              placeholder="說明"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Input
              placeholder="排序"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              啟用
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void handleSaveDepartment()}>
                {busy ? '儲存中…' : '儲存'}
              </Button>
              {form.id ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  取消
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-medium">類別 ↔ 單位指派</h2>
        <Card>
          <CardContent className="grid gap-3 py-4 text-sm sm:grid-cols-3">
            <select
              className="h-10 rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={assignForm.category}
              onChange={(e) => setAssignForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">選擇類別</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={assignForm.department}
              onChange={(e) => setAssignForm((f) => ({ ...f, department: e.target.value }))}
            >
              <option value="">選擇單位</option>
              {items.filter((d) => d.active).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={assignForm.assignment_type}
              onChange={(e) => setAssignForm((f) => ({ ...f, assignment_type: e.target.value }))}
            >
              <option value="primary">主責</option>
              <option value="collaborator">協辦</option>
            </select>
            <Button
              type="button"
              disabled={busy || !assignForm.category || !assignForm.department}
              onClick={() => void handleSaveAssignment()}
            >
              新增指派
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無指派。</p>
          ) : (
            assignments.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                  <div>
                    <p className="font-medium">
                      {categoryName(a.category)} → {departmentName(a.department)}
                    </p>
                    <p className="text-muted-foreground">
                      {a.assignment_type === 'primary' ? '主責' : '協辦'}
                      {!a.active ? ' · 停用' : ''}
                    </p>
                  </div>
                  {a.active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void (async () => {
                          setBusy(true)
                          try {
                            await adminSaveCategoryDepartmentAssignment({
                              id: a.id,
                              active: false,
                              assignment_type: a.assignment_type,
                            })
                            setMessage('指派已停用')
                            await load()
                          } catch (err) {
                            setError(err instanceof Error ? err.message : '停用失敗')
                          } finally {
                            setBusy(false)
                          }
                        })()
                      }}
                    >
                      停用
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
