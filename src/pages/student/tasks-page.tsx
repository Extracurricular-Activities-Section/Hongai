import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listMyFollowUpTasks } from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import {
  countPendingStudentTasks,
  followUpStatusLabel,
  followUpTypeLabel,
} from '@/features/follow-up/utils/status-labels'
import { formatTaipeiDateTime } from '@/lib/utils'

export function StudentTasksPage() {
  const [items, setItems] = useState<FollowUpTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listMyFollowUpTasks()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [])

  if (error && !items) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  const pendingCount = countPendingStudentTasks(items)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">追蹤任務</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          獲補助後需繳交的報告、證明或活動相關任務。
          {pendingCount > 0 ? ` 目前有 ${pendingCount} 項待處理。` : ''}
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">目前沒有追蹤任務。</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{task.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  狀態：{followUpStatusLabel(task.status)}
                  {task.is_overdue ? '（逾期）' : ''}
                  {task.required ? ' · 必填' : ''}
                </p>
                <p className="text-muted-foreground">類型：{followUpTypeLabel(task.task_type)}</p>
                {task.due_at ? (
                  <p className="text-muted-foreground">截止：{formatTaipeiDateTime(task.due_at)}</p>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link to={`/student/tasks/${task.id}`}>查看／繳交</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
