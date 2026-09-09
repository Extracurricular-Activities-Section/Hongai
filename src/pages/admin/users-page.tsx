import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import {
  adminCreateStaffUser,
  adminListDepartmentsApi,
  adminListStaffUsers,
  adminUpdateStaffUser,
} from '@/features/applications/api'
import type { StaffUserAdmin } from '@/features/applications/types'
import type { Department } from '@/types'

export function AdminUsersPage() {
  const { isAdmin } = useBackofficeAuth()
  const [items, setItems] = useState<StaffUserAdmin[] | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    job_title: '',
    notes: '',
    is_staff: true,
    is_admin: false,
    active: true,
    department_ids: [] as string[],
  })

  async function load() {
    const [users, depts] = await Promise.all([
      adminListStaffUsers(),
      adminListDepartmentsApi().catch(() => [] as Department[]),
    ])
    setItems(users)
    setDepartments(depts)
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
    setEditingId(null)
    setForm({
      email: '',
      password: '',
      name: '',
      phone: '',
      job_title: '',
      notes: '',
      is_staff: true,
      is_admin: false,
      active: true,
      department_ids: [],
    })
  }

  function startEdit(user: StaffUserAdmin) {
    setEditingId(user.id)
    setForm({
      email: user.email,
      password: '',
      name: user.name,
      phone: user.phone || '',
      job_title: user.job_title || '',
      notes: user.notes || '',
      is_staff: user.is_staff,
      is_admin: user.is_admin,
      active: user.active,
      department_ids: (user.departments || []).map((d) => d.department),
    })
  }

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (editingId) {
        await adminUpdateStaffUser(editingId, {
          email: form.email,
          name: form.name,
          phone: form.phone,
          job_title: form.job_title,
          notes: form.notes,
          is_staff: form.is_staff,
          is_admin: form.is_admin,
          active: form.active,
          password: form.password || undefined,
        })
        setMessage('帳號已更新')
      } else {
        await adminCreateStaffUser({
          email: form.email,
          password: form.password,
          name: form.name,
          phone: form.phone,
          job_title: form.job_title,
          notes: form.notes,
          is_staff: form.is_staff,
          is_admin: form.is_admin,
          active: form.active,
          department_ids: form.department_ids,
        })
        setMessage('帳號已建立')
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page font-semibold text-foreground">帳號管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">管理承辦／管理員帳號（僅 Admin）。</p>
      </div>

      {message ? <p className="text-sm font-medium text-success">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無帳號。</p>
          ) : (
            items.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex items-start justify-between gap-3 py-4 text-sm">
                  <div>
                    <p className="font-medium">
                      {user.name}
                      {!user.active ? '（停用）' : ''}
                    </p>
                    <p className="text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.is_admin ? 'Admin' : ''}
                      {user.is_admin && user.is_staff ? ' · ' : ''}
                      {user.is_staff ? 'Staff' : ''}
                      {user.job_title ? ` · ${user.job_title}` : ''}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(user)}>
                    編輯
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? '編輯帳號' : '新增帳號'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Input
              placeholder="姓名"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              type="password"
              placeholder={editingId ? '新密碼（空白則不變更）' : '密碼（至少 8 碼）'}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Input
              placeholder="職稱"
              value={form.job_title}
              onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            />
            <Input
              placeholder="電話"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              placeholder="備註"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_staff}
                  onChange={(e) => setForm((f) => ({ ...f, is_staff: e.target.checked }))}
                />
                Staff
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_admin}
                  onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))}
                />
                Admin
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                啟用
              </label>
            </div>
            {!editingId && departments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">所屬單位</p>
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.department_ids.includes(d.id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          department_ids: e.target.checked
                            ? [...f.department_ids, d.id]
                            : f.department_ids.filter((id) => id !== d.id),
                        }))
                      }}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void handleSubmit()}>
                {busy ? '儲存中…' : editingId ? '更新' : '建立'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  取消編輯
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
