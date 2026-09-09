import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/features/applications/components/confirm-dialog'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import {
  adminGetMailStatus,
  adminListDeliveries,
  adminListNotifications,
  adminResendDelivery,
} from '@/features/notifications/api'
import { NotificationList } from '@/features/notifications/components/notification-list'
import type {
  HadNotification,
  MailProviderStatus,
  NotificationDelivery,
} from '@/features/notifications/types'
import {
  NOTIFICATION_CATEGORY_OPTIONS,
  deliveryStatusLabel,
  mailProviderBanner,
} from '@/features/notifications/utils/labels'
import { formatTaipeiDateTime } from '@/lib/utils'

const DELIVERY_STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'queued', label: '佇列中' },
  { value: 'sent', label: '已寄出' },
  { value: 'sent_simulated', label: '模擬寄出' },
  { value: 'failed', label: '失敗' },
]

type Tab = 'notifications' | 'deliveries'

export function AdminNotificationsPage() {
  const { isAdmin } = useBackofficeAuth()
  const [tab, setTab] = useState<Tab>('notifications')
  const [notifications, setNotifications] = useState<HadNotification[] | null>(null)
  const [deliveries, setDeliveries] = useState<NotificationDelivery[] | null>(null)
  const [mailStatus, setMailStatus] = useState<MailProviderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [studentId, setStudentId] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [resendId, setResendId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadMail = useCallback(async () => {
    const status = await adminGetMailStatus()
    setMailStatus(status)
  }, [])

  const loadNotifications = useCallback(async () => {
    const items = await adminListNotifications({
      category: category || undefined,
      student_id: studentId.trim() || undefined,
      application_id: applicationId.trim() || undefined,
    })
    setNotifications(items)
  }, [category, studentId, applicationId])

  const loadDeliveries = useCallback(async () => {
    const items = await adminListDeliveries({
      status: deliveryStatus || undefined,
      application_id: applicationId.trim() || undefined,
    })
    setDeliveries(items)
  }, [deliveryStatus, applicationId])

  useEffect(() => {
    void loadMail().catch(() => setMailStatus(null))
  }, [loadMail])

  useEffect(() => {
    setError(null)
    if (tab === 'notifications') {
      void loadNotifications().catch((err) =>
        setError(err instanceof Error ? err.message : '載入失敗'),
      )
    } else {
      void loadDeliveries().catch((err) =>
        setError(err instanceof Error ? err.message : '載入失敗'),
      )
    }
  }, [tab, loadNotifications, loadDeliveries])

  async function confirmResend() {
    if (!resendId) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await adminResendDelivery(resendId)
      setMessage(result.message || '已重新排入寄送佇列')
      setResendId(null)
      await loadDeliveries()
      await loadMail().catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新寄送失敗')
    } finally {
      setBusy(false)
    }
  }

  const banner = mailStatus ? mailProviderBanner(mailStatus) : null
  const loading =
    (tab === 'notifications' && !notifications) || (tab === 'deliveries' && !deliveries)

  if (error && loading) return <p className="text-sm font-medium text-danger">{error}</p>
  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page font-semibold text-foreground">通知中心</h1>
          <p className="mt-2 text-sm text-muted-foreground">檢視站內通知與 Email 寄送紀錄。</p>
        </div>
        {isAdmin ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/notifications/templates">通知範本</Link>
          </Button>
        ) : null}
      </div>

      {banner ? (
        <Card
          className={
            banner.tone === 'warning'
              ? 'border-amber-300 bg-amber-50'
              : banner.tone === 'info'
                ? 'border-sky-300 bg-sky-50'
                : undefined
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{banner.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{banner.description}</p>
            {mailStatus?.provider ? (
              <p className="mt-2 text-xs">
                provider={mailStatus.provider}
                {mailStatus.from ? ` · from=${mailStatus.from}` : ''}
                {mailStatus.configured ? ' · configured=true' : ' · configured=false'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === 'notifications' ? 'default' : 'outline'}
          onClick={() => setTab('notifications')}
        >
          站內通知
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === 'deliveries' ? 'default' : 'outline'}
          onClick={() => setTab('deliveries')}
        >
          寄送紀錄
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tab === 'notifications' ? (
          <>
            <select
              className="h-9 rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
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
            <Input
              className="max-w-xs"
              placeholder="學生 ID（選填）"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </>
        ) : (
          <select
            className="h-9 rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
            value={deliveryStatus}
            onChange={(e) => setDeliveryStatus(e.target.value)}
            aria-label="寄送狀態"
          >
            {DELIVERY_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        <Input
          className="max-w-xs"
          placeholder="案件 ID（選填）"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
        />
      </div>

      {message ? <p className="text-sm font-medium text-success">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      {tab === 'notifications' && notifications ? (
        <NotificationList
          items={notifications}
          emptyText="目前沒有符合條件的通知。"
          showRecipient
        />
      ) : null}

      {tab === 'deliveries' && deliveries ? (
        deliveries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              目前沒有符合條件的寄送紀錄。
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {deliveries.map((item) => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">{item.subject || '（無主旨）'}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {formatTaipeiDateTime(item.created)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    狀態：{deliveryStatusLabel(item.status)}
                    {item.channel ? ` · 通道 ${item.channel}` : ''}
                  </p>
                  <p className="text-muted-foreground">收件：{item.recipient || '—'}</p>
                  {item.error_message ? (
                    <p className="text-red-700">
                      錯誤：{item.error_code ? `${item.error_code} · ` : ''}
                      {item.error_message}
                    </p>
                  ) : null}
                  {item.sent_at ? (
                    <p className="text-xs text-muted-foreground">
                      寄出時間：{formatTaipeiDateTime(item.sent_at)}
                      {item.status === 'sent_simulated' ? '（模擬）' : ''}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setResendId(item.id)}
                  >
                    重新寄送
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={Boolean(resendId)}
        title="確認重新寄送？"
        description={
          mailStatus && !mailStatus.configured
            ? '目前郵件提供者未設定。重新排入佇列後仍可能無法真正寄出，請先確認後端 HK_MAIL_PROVIDER。'
            : mailStatus &&
                (mailStatus.provider === 'development' || mailStatus.provider === 'console')
              ? '目前為開發模式，重新寄送只會模擬發送，不會真正寄出。'
              : '將建立新的寄送佇列項目。'
        }
        confirmLabel="確認重新寄送"
        busy={busy}
        onConfirm={() => void confirmResend()}
        onCancel={() => setResendId(null)}
      />
    </div>
  )
}
