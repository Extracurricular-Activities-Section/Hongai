import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/notifications/api'
import type { NotificationPreferences } from '@/features/notifications/types'
import {
  STUDENT_PREF_TOGGLES,
  buildPreferencesUpdate,
  type StudentPrefToggleKey,
} from '@/features/notifications/utils/preferences'

export function StudentNotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const data = await getNotificationPreferences()
    setPrefs(data)
  }, [])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  async function toggle(key: StudentPrefToggleKey, value: boolean) {
    if (!prefs) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await updateNotificationPreferences(
        buildPreferencesUpdate(prefs, { [key]: value }),
      )
      setPrefs(result.preferences)
      setMessage(result.message || '偏好設定已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗')
    } finally {
      setBusy(false)
    }
  }

  if (error && !prefs) return <p className="text-sm font-medium text-danger">{error}</p>
  if (!prefs) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page font-semibold text-foreground">通知設定</h1>
          <p className="mt-2 text-sm text-muted-foreground">調整提醒與 Email 偏好。</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/student/notifications">返回通知</Link>
        </Button>
      </div>

      {message ? <p className="text-sm font-medium text-success">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">可調整項目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {STUDENT_PREF_TOGGLES.map((item) => {
            const checked = prefs[item.key]
            return (
              <label
                key={item.key}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-border p-3"
              >
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checked}
                  disabled={busy}
                  onChange={(e) => void toggle(item.key, e.target.checked)}
                />
              </label>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">關鍵系統通知</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            關鍵系統 Email（例如帳號安全、重大狀態變更）無法完全關閉，以確保重要訊息送達。
          </p>
          <p>
            目前狀態：
            <span className="ml-1 font-medium">
              {prefs.system_critical_email ? '已啟用（不可關閉）' : '未啟用'}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
