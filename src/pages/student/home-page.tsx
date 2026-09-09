import { ArrowRight, CalendarClock, CheckCircle2, FileClock, Inbox } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Metric, MetricRow } from '@/components/common/metric'
import { SectionHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/states'
import { AttentionRow } from '@/components/common/task-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonMetrics } from '@/components/ui/skeleton'
import { listMyApplications } from '@/features/applications/api'
import type { Application } from '@/features/applications/types'
import { applicationStatusLabel } from '@/features/applications/utils/status-labels'
import { fetchStudentMe } from '@/features/auth/student/api'
import { listMyFollowUpTasks } from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import {
  countPendingStudentTasks,
  followUpStatusLabel,
} from '@/features/follow-up/utils/status-labels'
import { fetchCurrentPeriodState } from '@/features/periods/api'
import { applicationStatusTone, followUpStatusTone } from '@/lib/status/tone'
import { formatTaipeiDateTime } from '@/lib/utils'
import { computeAcademicYearProgress } from '@/shared/rules/academic-funding'
import type { CurrentPeriodState, StudentMeResponse } from '@/types'

const NEEDS_ACTION_STATUSES = new Set(['returned_for_edit', 'supplement_required'])

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  const diff = Math.ceil((end - Date.now()) / 86_400_000)
  return diff
}

function PeriodHero({
  state,
  onlyHistory,
}: {
  state: CurrentPeriodState
  onlyHistory: boolean
}) {
  const period = state.latest_period
  const remaining = daysUntil(period?.end_at)

  if (!period || state.ui_state === 'none') {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <p className="text-section font-semibold text-foreground">目前沒有開放中的申請</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-subtle">
          {onlyHistory
            ? '新梯次開放時會以通知提醒你。在此之前，可以先查看過往的申請紀錄。'
            : '新梯次開放時會以通知提醒你，屆時即可開始填寫申請。'}
        </p>
        {onlyHistory ? (
          <Button asChild variant="outline" className="mt-5">
            <Link to="/student/history">
              <FileClock />
              查看歷史申請
            </Link>
          </Button>
        ) : null}
      </section>
    )
  }

  const open = state.ui_state === 'open'
  const scheduled = state.ui_state === 'scheduled'

  return (
    <section className="on-ink overflow-hidden rounded-xl bg-ink p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={open ? 'brand' : 'neutral'} className={open ? '' : 'border-ink-border bg-white/10 text-ink-subtle'}>
              {open ? '申請開放中' : scheduled ? '尚未開放' : '已截止'}
            </Badge>
            {open && remaining != null && remaining >= 0 ? (
              <span className="text-meta text-ink-subtle">
                {remaining === 0 ? '今日截止' : `剩餘 ${remaining} 天`}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-section font-semibold text-ink-foreground sm:text-page">
            {period.name}
          </h2>
          <p className="mt-2 inline-flex items-center gap-1.5 text-meta text-ink-subtle">
            <CalendarClock className="size-3.5" aria-hidden />
            {formatTaipeiDateTime(period.start_at)} ～ {formatTaipeiDateTime(period.end_at)}
          </p>
        </div>

        {open ? (
          <Button asChild variant="brand" size="lg">
            <Link to="/student/current">
              進入申請
              <ArrowRight />
            </Link>
          </Button>
        ) : scheduled ? (
          <Button
            asChild
            variant="outline"
            className="border-ink-border bg-transparent text-ink-foreground hover:bg-white/10 hover:text-ink-foreground"
          >
            <Link to="/student/history">查看申請資訊</Link>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

export function StudentHomePage() {
  const [me, setMe] = useState<StudentMeResponse | null>(null)
  const [periodState, setPeriodState] = useState<CurrentPeriodState | null>(null)
  const [tasks, setTasks] = useState<FollowUpTask[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [meData, periodData, taskData, appData] = await Promise.all([
          fetchStudentMe(),
          fetchCurrentPeriodState(),
          listMyFollowUpTasks().catch(() => [] as FollowUpTask[]),
          listMyApplications().catch(() => [] as Application[]),
        ])
        if (cancelled) return
        setMe(meData)
        setPeriodState(periodData)
        setTasks(taskData)
        setApplications(appData)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '無法載入資料')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pendingTasks = useMemo(() => countPendingStudentTasks(tasks), [tasks])

  const attention = useMemo(() => {
    const fromApplications = applications
      .filter((app) => NEEDS_ACTION_STATUSES.has(app.status))
      .map((app) => ({
        key: `app-${app.id}`,
        to: '/student/current',
        title: app.category_name || app.application_number || '申請項目',
        detail: app.application_number ? `編號 ${app.application_number}` : undefined,
        label: applicationStatusLabel(app.status),
        tone: applicationStatusTone(app.status),
      }))

    const fromTasks = tasks
      .filter(
        (task) =>
          task.status === 'pending' ||
          task.status === 'supplement_required' ||
          task.status === 'rejected' ||
          Boolean(task.is_overdue && task.status !== 'approved' && task.status !== 'waived'),
      )
      .map((task) => ({
        key: `task-${task.id}`,
        to: `/student/tasks/${task.id}`,
        title: task.name,
        detail: task.due_at ? `截止 ${formatTaipeiDateTime(task.due_at)}` : undefined,
        label: task.is_overdue ? '已逾期' : followUpStatusLabel(task.status),
        tone: followUpStatusTone(task.status, task.is_overdue),
      }))

    return [...fromApplications, ...fromTasks]
  }, [applications, tasks])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <SkeletonMetrics count={3} />
      </div>
    )
  }

  if (error || !me || !periodState) {
    return <ErrorState message={error ?? '無法載入資料'} onRetry={() => window.location.reload()} />
  }

  const submittedCount = applications.filter((app) => app.status !== 'closed').length
  const grade = periodState.period_profile?.grade || me.profile.grade
  const yearProgress = computeAcademicYearProgress({
    academic_year: periodState.latest_period?.name?.slice(0, 4) || 'default',
    completed_category_codes: applications
      .filter((app) =>
        ['approved', 'funding_decided', 'funding_pending', 'closed'].includes(app.status),
      )
      .map((app) => app.category_code || app.category_name || app.id),
  })
  const approvedGrantTotal = applications.reduce((sum, app) => {
    const amount = Number(app.approved_amount ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-page font-semibold text-foreground">您好，{me.profile.name}</h1>
        <p className="mt-1.5 text-sm text-subtle">
          {me.student.student_no} · {me.profile.department_name}
          {grade ? ` · ${grade}` : ''}
        </p>
      </header>

      <PeriodHero state={periodState} onlyHistory={periodState.has_history} />

      <section className="rounded-lg border border-border bg-card px-5 py-4">
        <p className="text-meta text-muted-foreground">本學年度執行進度</p>
        <p className="mt-1 text-section font-semibold text-foreground tabular">
          {yearProgress.completed_categories} / {yearProgress.minimum_categories}
        </p>
        <p className="mt-1 text-sm text-subtle">{yearProgress.message}</p>
      </section>

      <MetricRow className="lg:grid-cols-4">
        <Metric
          label="進行中的申請"
          value={submittedCount}
          hint="含草稿與審核中項目"
          to="/student/current"
        />
        <Metric
          label="待處理任務"
          value={pendingTasks}
          tone={pendingTasks > 0 ? 'attention' : 'default'}
          hint={pendingTasks > 0 ? '需要你繳交或補件' : '目前沒有待辦'}
          to="/student/tasks"
        />
        <Metric
          label="目前核定總額"
          value={approvedGrantTotal > 0 ? `NT$ ${approvedGrantTotal.toLocaleString('zh-TW')}` : '—'}
          hint="助學金（不含獎勵金）"
          to="/student/current"
        />
        <Metric label="歷史紀錄" value={periodState.has_history ? '可查看' : '尚無'} to="/student/history" />
      </MetricRow>

      <section className="space-y-3">
        <SectionHeader
          title="需要你處理"
          count={attention.length || null}
          description="退回修改、補件與待繳交的任務會集中在這裡。"
        />
        {attention.length === 0 ? (
          <EmptyState
            compact
            icon={CheckCircle2}
            title="目前沒有待辦事項"
            description="有新的補件要求或追蹤任務時，會出現在這裡並同步寄出通知。"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {attention.map((item) => (
              <AttentionRow
                key={item.key}
                to={item.to}
                title={item.title}
                detail={item.detail}
                badge={<Badge tone={item.tone}>{item.label}</Badge>}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/student/profile"
          className="group flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface-muted/60"
        >
          <Inbox className="size-5 shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">我的資料</span>
            <span className="block text-meta text-muted-foreground">
              共用基本資料、聯絡方式與通知設定
            </span>
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>

        <Link
          to="/student/history"
          className="group flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface-muted/60"
        >
          <FileClock className="size-5 shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">歷史申請</span>
            <span className="block text-meta text-muted-foreground">
              過往梯次的申請內容與核定結果
            </span>
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </section>
    </div>
  )
}
