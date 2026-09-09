import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/features/applications/components/status-badge'
import { adminListApplications } from '@/features/applications/api'
import type { Application } from '@/features/applications/types'
import {
  APPLICATION_STATUS_LABELS,
  ELIGIBILITY_STATUS_LABELS,
  formatAmount,
} from '@/features/applications/utils/status-labels'
import { adminListCategories, adminListPeriods } from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { ApplicationCategory, ApplicationPeriod } from '@/types'

export function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Application[] | null>(null)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [periods, setPeriods] = useState<ApplicationPeriod[]>([])
  const [categories, setCategories] = useState<ApplicationCategory[]>([])

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const eligibility = searchParams.get('eligibility_status') || ''
  const period = searchParams.get('period') || ''
  const category = searchParams.get('category') || ''
  const page = Math.max(1, Number(searchParams.get('page') || 1))

  const queryKey = useMemo(
    () => ({ q, status, eligibility, period, category, page }),
    [q, status, eligibility, period, category, page],
  )

  useEffect(() => {
    void Promise.all([adminListPeriods(), adminListCategories()])
      .then(([p, c]) => {
        setPeriods(p)
        setCategories(c)
      })
      .catch(() => {
        /* filters optional */
      })
  }, [])

  useEffect(() => {
    setItems(null)
    setError(null)
    void adminListApplications({
      q: queryKey.q || undefined,
      status: queryKey.status || undefined,
      eligibility_status: queryKey.eligibility || undefined,
      period: queryKey.period || undefined,
      category: queryKey.category || undefined,
      page: queryKey.page,
      perPage: 20,
    })
      .then((data) => {
        setItems(data.items)
        setTotalItems(data.totalItems)
        setTotalPages(data.totalPages)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [queryKey])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">案件管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          可依狀態、梯次、類別與關鍵字篩選。Staff 僅顯示授權範圍內案件。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="搜尋編號／學號／姓名／項目"
          defaultValue={q}
          onBlur={(e) => updateParam('q', e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam('q', (e.target as HTMLInputElement).value.trim())
            }
          }}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => updateParam('status', e.target.value)}
        >
          <option value="">全部狀態</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={eligibility}
          onChange={(e) => updateParam('eligibility_status', e.target.value)}
        >
          <option value="">全部資格</option>
          {Object.entries(ELIGIBILITY_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={period}
          onChange={(e) => updateParam('period', e.target.value)}
        >
          <option value="">全部梯次</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => updateParam('category', e.target.value)}
        >
          <option value="">全部類別</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!items && !error ? <p className="text-sm text-muted-foreground">載入中…</p> : null}

      {items && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">沒有符合的案件。</p>
      ) : null}

      {items && items.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto rounded-md border border-border md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">申請編號</th>
                  <th className="px-3 py-2 font-medium">學生</th>
                  <th className="px-3 py-2 font-medium">項目</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">金額</th>
                  <th className="px-3 py-2 font-medium">送件時間</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-3 py-2 font-medium">{item.application_number}</td>
                    <td className="px-3 py-2">
                      <div>{item.student_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{item.student_no}</div>
                    </td>
                    <td className="px-3 py-2">{item.category_name || item.category}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">
                      {item.approved_amount != null
                        ? formatAmount(item.approved_amount)
                        : formatAmount(item.requested_amount)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatTaipeiDateTime(item.submitted_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/applications/${item.id}`}>詳情</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-2 py-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.application_number}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p>
                    {item.student_name}（{item.student_no}）
                  </p>
                  <p className="text-muted-foreground">{item.category_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTaipeiDateTime(item.submitted_at)}
                  </p>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/admin/applications/${item.id}`}>查看詳情</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              共 {totalItems} 筆 · 第 {page} / {totalPages} 頁
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                上一頁
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                下一頁
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
