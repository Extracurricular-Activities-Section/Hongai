import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import {
  adminListNotificationTemplates,
  adminPreviewNotificationTemplate,
  adminSeedNotificationTemplates,
  adminUpsertNotificationTemplate,
} from '@/features/notifications/api'
import type {
  NotificationTemplate,
  NotificationTemplatePreviewResult,
} from '@/features/notifications/types'
import {
  NOTIFICATION_CATEGORY_LABELS,
  templateChannelLabel,
} from '@/features/notifications/utils/labels'

const SAMPLE_VARS: Record<string, string> = {
  student_name: '測試同學',
  category_name: '學術學習',
  application_number: 'HAD-TEST-0001',
  approved_amount: '10000',
  student_message: '（範例學生可見訊息）',
  due_at: '2026-12-31T23:59:00.000Z',
  task_name: '成果報告繳交',
  task_description: '請上傳成果報告 PDF。',
  event_name: '成果發表會',
  event_start_at: '2026-06-01T09:00:00.000Z',
  event_location: '活動中心',
  event_note: '請準時出席。',
  reset_status_label: '已核准',
}

const EMPTY_FORM = {
  code: '',
  name: '',
  channel: 'both',
  category: 'system',
  subject_template: '',
  body_template: '',
  active: true,
  is_critical: false,
}

export function AdminNotificationTemplatesPage() {
  const { isAdmin } = useBackofficeAuth()
  const [templates, setTemplates] = useState<NotificationTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [preview, setPreview] = useState<NotificationTemplatePreviewResult | null>(null)

  const load = useCallback(async () => {
    const items = await adminListNotificationTemplates()
    setTemplates(items)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin, load])

  if (!isAdmin) return <Navigate to="/admin" replace />
  if (error && !templates) return <p className="text-sm font-medium text-danger">{error}</p>
  if (!templates) return <PageSkeleton />

  function resetForm() {
    setEditingCode(null)
    setForm(EMPTY_FORM)
    setPreview(null)
  }

  function startEdit(item: NotificationTemplate) {
    setEditingCode(item.code)
    setForm({
      code: item.code,
      name: item.name,
      channel: item.channel || 'both',
      category: item.category || 'system',
      subject_template: item.subject_template || '',
      body_template: item.body_template || '',
      active: item.active,
      is_critical: item.is_critical,
    })
    setPreview(null)
  }

  async function saveTemplate() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await adminUpsertNotificationTemplate({
        code: form.code.trim(),
        name: form.name.trim(),
        channel: form.channel,
        category: form.category,
        subject_template: form.subject_template,
        body_template: form.body_template,
        active: form.active,
        is_critical: form.is_critical,
      })
      setMessage(result.message || '範本已儲存')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function runPreview(templateId?: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await adminPreviewNotificationTemplate(
        templateId
          ? { template_id: templateId, variables: SAMPLE_VARS }
          : {
              subject_template: form.subject_template,
              body_template: form.body_template,
              variables: SAMPLE_VARS,
            },
      )
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '預覽失敗')
    } finally {
      setBusy(false)
    }
  }

  async function seedTemplates() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await adminSeedNotificationTemplates()
      setMessage(result.message || '種子資料已確保')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '種子失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page font-semibold text-foreground">通知範本</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理通知主旨與本文範本。預覽僅使用假資料（測試同學 / U0000000）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/notifications">返回通知中心</Link>
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void seedTemplates()}>
            確保種子範本
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm font-medium text-success">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingCode ? `編輯範本（${editingCode}）` : '新增／更新範本'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-muted-foreground">代碼 *</span>
            <Input
              value={form.code}
              disabled={Boolean(editingCode)}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">名稱 *</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">分類</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">通道</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={form.channel}
              onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
            >
              <option value="both">站內與 Email</option>
              <option value="email">僅 Email</option>
              <option value="in_app">僅站內</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">主旨範本</span>
            <Input
              value={form.subject_template}
              onChange={(e) => setForm((prev) => ({ ...prev, subject_template: e.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground">本文範本 *</span>
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 py-2 text-sm"
              value={form.body_template}
              onChange={(e) => setForm((prev) => ({ ...prev, body_template: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            <span>啟用</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_critical}
              onChange={(e) => setForm((prev) => ({ ...prev, is_critical: e.target.checked }))}
            />
            <span>關鍵範本（不可被偏好完全關閉）</span>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" disabled={busy} onClick={() => void saveTemplate()}>
              {busy ? '處理中…' : editingCode ? '更新範本' : '儲存範本'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void runPreview()}
            >
              預覽目前內容
            </Button>
            {editingCode ? (
              <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>
                取消編輯
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">預覽結果（假資料）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              範例學號：{preview.sample_student_no}
            </p>
            <p>
              <span className="text-muted-foreground">主旨：</span>
              {preview.subject?.text || '—'}
            </p>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
              {preview.body?.text || '—'}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">既有範本（{templates.length}）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無範本，可先執行「確保種子範本」。</p>
          ) : (
            templates.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {item.name}{' '}
                    <span className="text-xs font-normal text-muted-foreground">({item.code})</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {NOTIFICATION_CATEGORY_LABELS[item.category] || item.category}
                    {' · '}
                    {templateChannelLabel(item.channel)}
                    {' · v'}
                    {item.version}
                    {item.is_critical ? ' · 關鍵' : ''}
                    {item.active ? '' : ' · 停用'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                    編輯
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runPreview(item.id)}
                  >
                    預覽
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
