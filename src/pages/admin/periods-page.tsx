import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminCreatePeriod,
  adminListCategories,
  adminListPeriods,
  adminUpdateCategory,
  adminUpdatePeriod,
  type AdminPeriodInput,
} from '@/features/periods/api'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { ApplicationCategory, ApplicationPeriod } from '@/types'

const emptyForm: AdminPeriodInput = {
  name: '',
  academic_year: 115,
  semester: '1',
  start_at: '',
  end_at: '',
  status: 'draft',
  active: true,
  description: '',
  min_application_count: 2,
  min_application_rule: 'warning_only',
  sort_order: 0,
}

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

export function AdminPeriodsPage() {
  const { isAdmin } = useBackofficeAuth()
  const [periods, setPeriods] = useState<ApplicationPeriod[] | null>(null)
  const [categories, setCategories] = useState<ApplicationCategory[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminPeriodInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setError(null)
    try {
      const [periodItems, categoryItems] = await Promise.all([
        adminListPeriods(),
        adminListCategories(),
      ])
      setPeriods(periodItems)
      setCategories(categoryItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    void load()
  }, [isAdmin])

  const title = useMemo(
    () => (editingId ? '編輯申請梯次' : '新增申請梯次'),
    [editingId],
  )

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">僅管理員可管理申請梯次。</p>
  }

  if (error && !periods) return <p className="text-sm font-medium text-danger">{error}</p>
  if (!periods || !categories) {
    return <PageSkeleton />
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setMessage(null)
    setError(null)
  }

  function startEdit(period: ApplicationPeriod) {
    setEditingId(period.id)
    setForm({
      name: period.name,
      academic_year: period.academic_year,
      semester: period.semester,
      start_at: toDatetimeLocalValue(period.start_at),
      end_at: toDatetimeLocalValue(period.end_at),
      status: period.status,
      active: period.active,
      description: period.description || '',
      min_application_count: period.min_application_count,
      min_application_rule: period.min_application_rule,
      sort_order: period.sort_order,
    })
    setMessage(null)
    setError(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload: AdminPeriodInput = {
        ...form,
        start_at: fromDatetimeLocalValue(form.start_at),
        end_at: fromDatetimeLocalValue(form.end_at),
      }
      if (editingId) {
        await adminUpdatePeriod(editingId, payload)
        setMessage('梯次已更新')
      } else {
        await adminCreatePeriod(payload)
        setMessage('梯次已建立')
      }
      startCreate()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page font-semibold text-foreground">申請梯次</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          同一時間僅允許一個可重疊的 open 梯次。已有學生資料的梯次請改為停用或 archived，勿硬刪。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2 sm:col-span-2">
              <Label>梯次名稱</Label>
              <Input
                value={form.name}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>學年度</Label>
              <Input
                type="number"
                value={form.academic_year}
                disabled={saving}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, academic_year: Number(e.target.value) }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>學期</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
                value={form.semester}
                disabled={saving}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    semester: e.target.value === '2' ? '2' : '1',
                  }))
                }
              >
                <option value="1">第一學期</option>
                <option value="2">第二學期</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>開始時間</Label>
              <Input
                type="datetime-local"
                value={form.start_at}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>截止時間</Label>
              <Input
                type="datetime-local"
                value={form.end_at}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>狀態</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
                value={form.status}
                disabled={saving}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as ApplicationPeriod['status'],
                  }))
                }
              >
                <option value="draft">draft</option>
                <option value="scheduled">scheduled</option>
                <option value="open">open</option>
                <option value="closed">closed</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>最低申請項數</Label>
              <Input
                type="number"
                min={0}
                value={form.min_application_count}
                disabled={saving}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    min_application_count: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>最低申請規則</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
                value={form.min_application_rule}
                disabled={saving}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    min_application_rule:
                      e.target.value === 'enforced' ? 'enforced' : 'warning_only',
                  }))
                }
              >
                <option value="warning_only">warning_only</option>
                <option value="enforced">enforced（預留）</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>排序</Label>
              <Input
                type="number"
                value={form.sort_order}
                disabled={saving}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))
                }
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="period-active"
                type="checkbox"
                checked={form.active}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              />
              <Label htmlFor="period-active">啟用 active</Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>說明</Label>
              <Input
                value={form.description || ''}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            {error ? <p className="text-sm font-medium text-danger sm:col-span-2">{error}</p> : null}
            {message ? <p className="text-sm text-foreground sm:col-span-2">{message}</p> : null}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? '儲存中…' : editingId ? '更新梯次' : '建立梯次'}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" disabled={saving} onClick={startCreate}>
                  取消編輯
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">既有梯次</h2>
        {periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無梯次。</p>
        ) : (
          periods.map((period) => (
            <Card key={period.id}>
              <CardContent className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{period.name}</p>
                  <p>
                    {period.academic_year}-{period.semester} · {period.status} ·{' '}
                    {period.active ? 'active' : 'inactive'}
                  </p>
                  <p className="text-muted-foreground">
                    {formatTaipeiDateTime(period.start_at)} ～ {formatTaipeiDateTime(period.end_at)}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(period)}>
                  編輯
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">9 大申請項目（主檔）</h2>
        <p className="text-sm text-muted-foreground">
          可調整名稱、說明、排序、啟用。code 不可修改或刪除。
        </p>
        {categories.map((category) => (
          <Card key={category.id}>
            <CardContent className="grid gap-3 py-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-muted-foreground">code: {category.code}</p>
              </div>
              <div className="space-y-2">
                <Input
                  defaultValue={category.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (!name || name === category.name) return
                    void adminUpdateCategory(category.id, { name })
                      .then(load)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : '更新項目失敗'),
                      )
                  }}
                />
                <Input
                  defaultValue={category.description || ''}
                  placeholder="說明"
                  onBlur={(e) => {
                    const description = e.target.value.trim()
                    if (description === (category.description || '')) return
                    void adminUpdateCategory(category.id, { description })
                      .then(load)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : '更新項目失敗'),
                      )
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2">
                    <span>排序</span>
                    <Input
                      className="w-24"
                      type="number"
                      defaultValue={category.sort_order}
                      onBlur={(e) => {
                        const sort_order = Number(e.target.value)
                        if (sort_order === category.sort_order) return
                        void adminUpdateCategory(category.id, { sort_order })
                          .then(load)
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : '更新項目失敗'),
                          )
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={category.active}
                      onChange={(e) => {
                        void adminUpdateCategory(category.id, { active: e.target.checked })
                          .then(load)
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : '更新項目失敗'),
                          )
                      }}
                    />
                    啟用
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
