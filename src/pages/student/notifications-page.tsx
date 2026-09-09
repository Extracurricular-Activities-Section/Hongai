import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
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

  if (error && !items) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">通知</h1>
          <p className="mt-2 text-sm text-muted-foreground">查看申請、補件與追蹤相關通知。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/student/settings/notifications">通知設定</Link>
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void handleReadAll()}>
            {busy ? '處理中…' : '全部標示已讀'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          全部
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filter === 'unread' ? 'default' : 'outline'}
          onClick={() => setFilter('unread')}
        >
          未讀
        </Button>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="通知分類"
        >
          {NOTIFICATION_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <NotificationList
        items={items}
        emptyText={filter === 'unread' ? '目前沒有未讀通知。' : '目前沒有通知。'}
        onMarkRead={(id) => void handleMarkRead(id)}
        markingId={markingId}
      />
    </div>
  )
}
