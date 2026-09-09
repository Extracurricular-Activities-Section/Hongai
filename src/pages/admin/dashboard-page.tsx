import { ArrowRight, MailWarning } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Metric, MetricRow } from '@/components/common/metric'
import { PageHeader, SectionHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonMetrics } from '@/components/ui/skeleton'
import { adminApplicationsSummary } from '@/features/applications/api'
import type { ApplicationStatus } from '@/features/applications/types'
import { APPLICATION_STATUS_LABELS } from '@/features/applications/utils/status-labels'
import { adminListFollowUpTasks } from '@/features/follow-up/api'
import { adminGetNotificationDashboard } from '@/features/notifications/api'
import type { NotificationDashboardSummary } from '@/features/notifications/types'
import { applicationStatusTone } from '@/lib/status/tone'
import { cn } from '@/lib/utils'

/** Statuses grouped by who is expected to act next. */
const AWAITING_STAFF: ApplicationStatus[] = ['submitted', 'eligibility_review', 'under_review']
const AWAITING_STUDENT: ApplicationStatus[] = ['supplement_required', 'returned_for_edit']
const BREAKDOWN_ORDER: ApplicationStatus[] = [
  'submitted',
  'eligibility_review',
  'under_review',
  'supplement_required',
  'returned_for_edit',
  'funding_pending',
  'funding_decided',
  'approved',
  'rejected',
  'closed',
]

const BAR_TONE: Record<string, string> = {
  neutral: 'bg-border-strong',
  progress: 'bg-info',
  attention: 'bg-warning',
  positive: 'bg-success',
  critical: 'bg-danger',
  brand: 'bg-accent-strong',
  ink: 'bg-ink',
  outline: 'bg-border-strong',
}

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

  const counts = useMemo(() => {
    const byStatus = summary?.by_status ?? {}
    const sum = (list: ApplicationStatus[]) =>
      list.reduce((total, status) => total + (byStatus[status] || 0), 0)
    return {
      awaitingStaff: sum(AWAITING_STAFF),
      awaitingStudent: sum(AWAITING_STUDENT),
      fundingPending: byStatus.funding_pending || 0,
    }
  }, [summary])

  if (error && !summary) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <SkeletonMetrics />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  const maxCount = Math.max(
    1,
    ...BREAKDOWN_ORDER.map((status) => summary.by_status[status] || 0),
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="弘愛築夢管理系統"
        description="依你的權限範圍彙整目前待辦。點擊任一數字可直接進入對應清單。"
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/applications">
              前往案件管理
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <MetricRow>
        <Metric
          emphasis
          label="等我處理"
          value={counts.awaitingStaff}
          hint="已送件、資格審核中、內容審核中"
          to="/admin/applications?status=submitted"
        />
        <Metric
          label="等待學生回應"
          value={counts.awaitingStudent}
          tone={counts.awaitingStudent > 0 ? 'attention' : 'default'}
          hint="待補件與退回修改"
          to="/admin/applications?status=supplement_required"
        />
        <Metric
          label="待核定補助"
          value={counts.fundingPending}
          hint="已通過審核，尚未核定金額"
          to="/admin/applications?status=funding_pending"
        />
        <Metric
          label="追蹤任務待審"
          value={followUpReview ?? '—'}
          tone={followUpReview ? 'attention' : 'default'}
          hint={followUpPending != null ? `另有 ${followUpPending} 項尚未繳交` : undefined}
          to="/admin/tasks?status=under_review"
        />
      </MetricRow>

      <MetricRow className="lg:grid-cols-3">
        <Metric
          label="本年度申請件數"
          value={summary.total}
          hint="權限範圍內全部案件"
          to="/admin/applications"
        />
        <Metric
          label="待核發（流程）"
          value={counts.fundingPending}
          hint="核定後進入分階段核發；實際匯款另由財務狀態更新"
          to="/admin/applications?status=funding_decided"
        />
        <Metric
          label="成果／追蹤待審"
          value={followUpReview ?? '—'}
          tone={followUpReview ? 'attention' : 'default'}
          to="/admin/tasks?status=under_review"
        />
      </MetricRow>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <SectionHeader
            title="案件狀態分布"
            count={summary.total}
            description="以權限範圍內的全部案件計算。"
          />
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {BREAKDOWN_ORDER.map((status) => {
              const count = summary.by_status[status] || 0
              const tone = applicationStatusTone(status)
              return (
                <Link
                  key={status}
                  to={`/admin/applications?status=${status}`}
                  className="group flex items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-muted/70"
                >
                  <span className="w-24 shrink-0 text-sm text-foreground">
                    {APPLICATION_STATUS_LABELS[status]}
                  </span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
                    <span
                      aria-hidden
                      className={cn('block h-full rounded-pill', BAR_TONE[tone])}
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-medium text-foreground tabular">
                    {count}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="space-y-3">
            <SectionHeader title="追蹤任務" />
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Link
                to="/admin/tasks?status=pending"
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface-muted/70"
              >
                <span className="text-sm text-foreground">待學生繳交</span>
                <span className="text-sm font-medium text-foreground tabular">
                  {followUpPending ?? '—'}
                </span>
              </Link>
              <Link
                to="/admin/tasks?status=under_review"
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/70"
              >
                <span className="text-sm text-foreground">已繳交待審核</span>
                <span className="text-sm font-medium text-foreground tabular">
                  {followUpReview ?? '—'}
                </span>
              </Link>
            </div>
          </section>

          {notifSummary ? (
            <section className="space-y-3">
              <SectionHeader title="通知寄送" />
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <span className="text-sm text-subtle">佇列中</span>
                  <span className="text-sm font-medium text-foreground tabular">
                    {notifSummary.deliveries_queued}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <span className="text-sm text-subtle">已寄出</span>
                  <span className="text-sm font-medium text-foreground tabular">
                    {notifSummary.deliveries_sent}
                  </span>
                </div>
                <Link
                  to="/admin/notifications"
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/70',
                    notifSummary.deliveries_failed > 0 && 'bg-danger-soft',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-sm',
                      notifSummary.deliveries_failed > 0 ? 'font-medium text-danger' : 'text-subtle',
                    )}
                  >
                    {notifSummary.deliveries_failed > 0 ? (
                      <MailWarning className="size-4" aria-hidden />
                    ) : null}
                    寄送失敗
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium tabular',
                      notifSummary.deliveries_failed > 0 ? 'text-danger' : 'text-foreground',
                    )}
                  >
                    {notifSummary.deliveries_failed}
                  </span>
                </Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
