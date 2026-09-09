import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { adminListFollowUpTasks } from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import { followUpStatusLabel, followUpTypeLabel } from '@/features/follow-up/utils/status-labels'
import { formatTaipeiDateTime } from '@/lib/utils'

export function AdminTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') || ''
  const [items, setItems] = useState<FollowUpTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    void adminListFollowUpTasks(statusFilter ? { status: statusFilter } : undefined)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [statusFilter])

  const filtered = useMemo(() => {
    if (!items) return []
    const keyword = q.trim().toLowerCase()
    if (!keyword) return items
    return items.filter(
      (task) =>
        task.name.toLowerCase().includes(keyword) ||
        task.application.toLowerCase().includes(keyword) ||
        task.status.toLowerCase().includes(keyword),
    )
  }, [items, q])

  if (error && !items) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">追蹤任務</h1>
          <p className="mt-2 text-sm text-muted-foreground">審核學生繳交的追蹤／結案相關任務。</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/follow-up-templates">範本管理</Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="搜尋任務名稱／案件 ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams)
            if (e.target.value) next.set('status', e.target.value)
            else next.delete('status')
            setSearchParams(next)
          }}
        >
          <option value="">全部狀態</option>
          <option value="pending">待繳交</option>
          <option value="under_review">審核中</option>
          <option value="submitted">已繳交</option>
          <option value="supplement_required">需補件</option>
          <option value="approved">已核准</option>
          <option value="rejected">未通過</option>
          <option value="waived">已豁免</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">沒有符合的任務。</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{task.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="space-y-1">
                  <p>
                    {followUpStatusLabel(task.status)}
                    {task.is_overdue ? '（逾期）' : ''} · {followUpTypeLabel(task.task_type)}
                  </p>
                  <p className="text-muted-foreground">
                    案件：
                    <Link className="underline" to={`/admin/applications/${task.application}`}>
                      {task.application}
                    </Link>
                    {task.due_at ? ` · 截止 ${formatTaipeiDateTime(task.due_at)}` : ''}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/tasks/${task.id}`}>處理</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
