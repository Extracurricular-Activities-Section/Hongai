import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApplicationsSummary } from '@/features/applications/api'
import type { ApplicationStatus } from '@/features/applications/types'
import { APPLICATION_STATUS_LABELS } from '@/features/applications/utils/status-labels'
import { adminListFollowUpTasks } from '@/features/follow-up/api'
import { adminGetNotificationDashboard } from '@/features/notifications/api'
import type { NotificationDashboardSummary } from '@/features/notifications/types'

const SUMMARY_LINKS: Array<{ status: ApplicationStatus; hint: string }> = [
  { status: 'submitted', hint: '待開始審核' },
  { status: 'eligibility_review', hint: '資格審核中' },
  { status: 'under_review', hint: '內容審核中' },
  { status: 'supplement_required', hint: '等待學生補件' },
  { status: 'returned_for_edit', hint: '已退回學生' },
  { status: 'funding_pending', hint: '待核定補助' },
  { status: 'funding_decided', hint: '已核定' },
  { status: 'rejected', hint: '不通過' },
]

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof adminApplicationsSummary>
  > | null>(null)
  const [followUpPending, setFollowUpPending] = useState<number | null>(null)
  const [followUpReview, setFollowUpReview] = useState<number | null>(null)
  const [notifSummary, setNotifSummary] = useState<NotificationDashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void adminApplicationsSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))

    void Promise.all([
      adminListFollowUpTasks({ status: 'pending' }).catch(() => []),
      adminListFollowUpTasks({ status: 'under_review' }).catch(() => []),
      adminListFollowUpTasks({ status: 'submitted' }).catch(() => []),
    ])
      .then(([pending, underReview, submitted]) => {
        setFollowUpPending(pending.length)
        setFollowUpReview(underReview.length + submitted.length)
      })
      .catch(() => {
        setFollowUpPending(null)
        setFollowUpReview(null)
      })

    void adminGetNotificationDashboard()
      .then(setNotifSummary)
      .catch(() => setNotifSummary(null))
  }, [])

  if (error && !summary) return <p className="text-sm text-red-700">{error}</p>
  if (!summary) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">儀表板</h1>
          <p className="mt-2 text-sm text-muted-foreground">依你的權限範圍統計案件狀態。</p>
        </div>
        <Link className="text-sm underline" to="/admin/applications">
          前往案件管理
        </Link>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">案件總數</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{summary.total}</p>
            <Link className="mt-2 inline-block text-xs underline" to="/admin/applications">
              查看全部
            </Link>
          </CardContent>
        </Card>

        {followUpPending != null ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                追蹤待繳交
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{followUpPending}</p>
              <p className="mt-1 text-xs text-muted-foreground">學生尚未繳交</p>
              <Link className="mt-2 inline-block text-xs underline" to="/admin/tasks?status=pending">
                查看任務
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {followUpReview != null ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                追蹤待審核
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{followUpReview}</p>
              <p className="mt-1 text-xs text-muted-foreground">已繳交待審核</p>
              <Link
                className="mt-2 inline-block text-xs underline"
                to="/admin/tasks?status=under_review"
              >
                前往審核
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {notifSummary ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  郵件佇列中
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{notifSummary.deliveries_queued}</p>
                <p className="mt-1 text-xs text-muted-foreground">待寄送</p>
                <Link className="mt-2 inline-block text-xs underline" to="/admin/notifications">
                  通知中心
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  郵件已寄出
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{notifSummary.deliveries_sent}</p>
                <p className="mt-1 text-xs text-muted-foreground">含模擬寄出</p>
                <Link className="mt-2 inline-block text-xs underline" to="/admin/notifications">
                  查看寄送紀錄
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  郵件失敗
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{notifSummary.deliveries_failed}</p>
                <p className="mt-1 text-xs text-muted-foreground">需檢查或重送</p>
                <Link className="mt-2 inline-block text-xs underline" to="/admin/notifications">
                  處理失敗項目
                </Link>
              </CardContent>
            </Card>
          </>
        ) : null}

        {SUMMARY_LINKS.map(({ status, hint }) => {
          const count = summary.by_status[status] || 0
          return (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {APPLICATION_STATUS_LABELS[status]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                <Link
                  className="mt-2 inline-block text-xs underline"
                  to={`/admin/applications?status=${status}`}
                >
                  篩選此狀態
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
