import { ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { FilterBar, FilterSelect, SearchInput } from '@/components/common/filter-bar'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/states'
import { TaskCard } from '@/components/common/task-card'
import { Button } from '@/components/ui/button'
import { SkeletonList } from '@/components/ui/skeleton'
import { adminListFollowUpTasks } from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import {
  FOLLOW_UP_STATUS_LABELS,
  followUpStatusLabel,
  followUpTypeLabel,
} from '@/features/follow-up/utils/status-labels'
import { followUpStatusTone } from '@/lib/status/tone'
import { formatTaipeiDateTime } from '@/lib/utils'

const STATUS_OPTIONS = [
  'pending',
  'under_review',
  'submitted',
  'supplement_required',
  'approved',
  'rejected',
  'waived',
].map((value) => ({ value, label: FOLLOW_UP_STATUS_LABELS[value] || value }))

export function AdminTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status') || ''
  const [items, setItems] = useState<FollowUpTask[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    setItems(null)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="追蹤任務"
        description="審核學生繳交的追蹤與結案相關任務。"
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/follow-up-templates">範本管理</Link>
          </Button>
        }
      />

      <FilterBar>
        <SearchInput
          ariaLabel="搜尋追蹤任務"
          placeholder="任務名稱／案件 ID"
          defaultValue={q}
          onSearch={setQ}
        />
        <FilterSelect
          label="任務狀態"
          allLabel="全部狀態"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value) next.set('status', value)
            else next.delete('status')
            setSearchParams(next)
          }}
        />
      </FilterBar>

      {error ? <ErrorState message={error} /> : null}
      {!items && !error ? <SkeletonList rows={5} /> : null}

      {items && filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="沒有符合條件的任務"
          description="調整狀態篩選或關鍵字，就能看到其他任務。"
        />
      ) : null}

      {filtered.length > 0 ? (
        <ul className="space-y-2.5">
          {filtered.map((task) => (
            <li key={task.id}>
              <TaskCard
                to={`/admin/tasks/${task.id}`}
                title={task.name}
                statusLabel={task.is_overdue ? '已逾期' : followUpStatusLabel(task.status)}
                statusTone={followUpStatusTone(task.status, task.is_overdue)}
                typeLabel={followUpTypeLabel(task.task_type)}
                dueLabel={task.due_at ? formatTaipeiDateTime(task.due_at) : null}
                overdue={Boolean(task.is_overdue)}
                owner={`案件 ${task.application}`}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
