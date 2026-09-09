import { Settings2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { FilterBar, FilterChips, FilterSelect } from '@/components/common/filter-bar'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, InlineNotice } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { SkeletonList } from '@/components/ui/skeleton'
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api'
import { NotificationList } from '@/features/notifications/components/notification-list'
import type { HadNotification } from '@/features/notifications/types'
import { NOTIFICATION_CATEGORY_OPTIONS } from '@/features/notifications/utils/labels'

type ReadFilter = 'all' | 'unread'

export function StudentNotificationsPage() {
  const [items, setItems] = useState<HadNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<ReadFilter>('all')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await listMyNotifications({
      filter,
      category: category || undefined,
    })
    setItems(data)
  }, [filter, category])

  useEffect(() => {
    setError(null)
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  async function handleMarkRead(id: string) {
    setMarkingId(id)
    setError(null)
    setMessage(null)
    try {
      await markNotificationRead(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '標示已讀失敗')
    } finally {
      setMarkingId(null)
    }
  }

  async function handleReadAll() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await markAllNotificationsRead()
      setMessage(result.message || `已標示 ${result.updated} 則為已讀`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '全部標示已讀失敗')
    } finally {
      setBusy(false)
    }
  }

  const categoryOptions = NOTIFICATION_CATEGORY_OPTIONS.filter((option) => option.value)

  return (
    <div className="space-y-6">
      <PageHeader
        title="通知"
        description="申請進度、補件要求與追蹤任務的提醒都會集中在這裡。"
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/student/settings/notifications">
                <Settings2 />
                通知設定
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void handleReadAll()}>
              {busy ? '處理中…' : '全部標示已讀'}
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterChips
          label="閱讀狀態"
          value={filter}
          options={[
            { value: 'all', label: '全部' },
            { value: 'unread', label: '未讀' },
          ]}
          onChange={(value) => setFilter(value as ReadFilter)}
        />
        <FilterSelect
          label="通知分類"
          allLabel="全部分類"
          value={category}
          options={categoryOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={setCategory}
        />
      </FilterBar>

      {message ? <InlineNotice tone="positive">{message}</InlineNotice> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!items ? (
        <SkeletonList rows={4} />
      ) : (
        <NotificationList
          items={items}
          emptyText={filter === 'unread' ? '目前沒有未讀通知' : '目前沒有通知'}
          onMarkRead={(id) => void handleMarkRead(id)}
          markingId={markingId}
        />
      )}
    </div>
  )
}
