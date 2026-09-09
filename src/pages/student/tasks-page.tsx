import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/states'
import { TaskCard } from '@/components/common/task-card'
import { Badge } from '@/components/ui/badge'
import { SkeletonList } from '@/components/ui/skeleton'
import { listMyFollowUpTasks } from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import {
  countPendingStudentTasks,
  followUpStatusLabel,
  followUpTypeLabel,
} from '@/features/follow-up/utils/status-labels'
import { followUpStatusTone } from '@/lib/status/tone'
import { formatTaipeiDateTime } from '@/lib/utils'

export function StudentTasksPage() {
  const [items, setItems] = useState<FollowUpTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listMyFollowUpTasks()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [])

  const pendingCount = items ? countPendingStudentTasks(items) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="追蹤任務"
        backTo="/student"
        backLabel="返回首頁"
        description="獲補助後需繳交的報告、證明或活動相關任務。"
        meta={
          pendingCount > 0 ? (
            <Badge tone="attention">{pendingCount} 項待處理</Badge>
          ) : null
        }
      />

      {error ? <ErrorState message={error} /> : null}
      {!items && !error ? <SkeletonList rows={3} /> : null}

      {items && items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="目前沒有追蹤任務"
          description="申請核定後若有需要繳交的報告或證明，會出現在這裡。"
        />
      ) : null}

      {items && items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((task) => (
            <li key={task.id}>
              <TaskCard
                to={`/student/tasks/${task.id}`}
                title={task.name}
                statusLabel={task.is_overdue ? '已逾期' : followUpStatusLabel(task.status)}
                statusTone={followUpStatusTone(task.status, task.is_overdue)}
                typeLabel={followUpTypeLabel(task.task_type)}
                dueLabel={task.due_at ? formatTaipeiDateTime(task.due_at) : null}
                overdue={Boolean(task.is_overdue)}
                required={task.required}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
