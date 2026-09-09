import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { ErrorState, InlineNotice, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { adminListFaq, adminSaveFaq, type FaqArticle } from '@/features/faq/api'

export function AdminFaqPage() {
  const { isAdmin } = useBackofficeAuth()
  const [items, setItems] = useState<FaqArticle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    id: '',
    slug: '',
    title: '',
    body: '',
    audience: 'both' as FaqArticle['audience'],
    sort_order: '0',
    published: false,
  })

  async function load() {
    const list = await adminListFaq()
    setItems(list)
  }

  useEffect(() => {
    if (!isAdmin) return
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/admin" replace />
  if (error && !items) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!items) return <PageSkeleton />

  function resetForm() {
    setForm({
      id: '',
      slug: '',
      title: '',
      body: '',
      audience: 'both',
      sort_order: '0',
      published: false,
    })
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await adminSaveFaq({
        id: form.id || undefined,
        slug: form.slug,
        title: form.title,
        body: form.body,
        audience: form.audience,
        sort_order: Number(form.sort_order) || 0,
        published: form.published,
      })
      setMessage(form.id ? '已更新' : '已新增')
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="常見問題" description="CMS 內容，供申請端／管理端 FAQ 頁面讀取。" />

      {error ? <InlineNotice tone="attention">{error}</InlineNotice> : null}
      {message ? <InlineNotice tone="positive">{message}</InlineNotice> : null}

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">{form.id ? '編輯文章' : '新增文章'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="faq-slug">Slug</Label>
            <Input
              id="faq-slug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-title">標題</Label>
            <Input
              id="faq-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="faq-body">內容</Label>
            <Textarea
              id="faq-body"
              rows={5}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-audience">對象</Label>
            <select
              id="faq-audience"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  audience: e.target.value as FaqArticle['audience'],
                }))
              }
            >
              <option value="student">學生</option>
              <option value="staff">職員</option>
              <option value="both">雙方</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-sort">排序</Label>
            <Input
              id="faq-sort"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
          />
          發佈
        </label>
        <div className="flex gap-2">
          <Button type="button" disabled={busy} onClick={() => void handleSave()}>
            {busy ? '儲存中…' : '儲存'}
          </Button>
          {form.id ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              取消編輯
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">文章列表</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-subtle">尚無 FAQ。</li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-subtle">
                    {item.slug} · {item.audience}
                    {item.published ? ' · 已發佈' : ' · 草稿'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: item.id,
                      slug: item.slug,
                      title: item.title,
                      body: item.body,
                      audience: item.audience,
                      sort_order: String(item.sort_order ?? 0),
                      published: Boolean(item.published),
                    })
                  }
                >
                  編輯
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
