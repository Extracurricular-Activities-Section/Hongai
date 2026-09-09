import { ArrowRight, CalendarClock, CopyPlus, Lock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { ErrorState, InlineNotice } from '@/components/common/states'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listMyApplications } from '@/features/applications/api'
import type { Application } from '@/features/applications/types'
import {
  applicationStatusLabel,
  formatAmount,
} from '@/features/applications/utils/status-labels'
import { copyPreviousFormSubmission } from '@/features/forms/api'
import {
  copyPreviousCategory,
  fetchCurrentCategories,
  fetchCurrentPeriodState,
  startCategory,
  type CurrentCategoriesResponse,
} from '@/features/periods/api'
import { applicationStatusTone } from '@/lib/status/tone'
import { cn, formatTaipeiDateTime } from '@/lib/utils'

type CategoryItem = CurrentCategoriesResponse['items'][number]

function entryStateLabel(
  application: Application | null,
  entryStatus: string | null | undefined,
): { label: string; tone: BadgeTone } {
  if (application) {
    return { label: applicationStatusLabel(application.status), tone: applicationStatusTone(application.status) }
  }
  if (entryStatus === 'draft') return { label: '草稿', tone: 'neutral' }
  if (entryStatus) return { label: entryStatus, tone: 'neutral' }
  return { label: '尚未開始', tone: 'neutral' }
}

export function StudentCurrentPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CurrentCategoriesResponse | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [needConfirm, setNeedConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const state = await fetchCurrentPeriodState()
      if (!state.current_open_period) {
        setError('目前沒有可申請梯次')
        setData(null)
        return
      }
      if (!state.period_profile?.confirmed_at) {
        setNeedConfirm(true)
        setData(null)
        return
      }
      setNeedConfirm(false)
      const [categories, apps] = await Promise.all([
        fetchCurrentCategories(),
        listMyApplications().catch(() => [] as Application[]),
      ])
      setData(categories)
      setApplications(apps)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const appsByCategory = useMemo(() => {
    const map = new Map<string, Application>()
    for (const app of applications) {
      if (data?.period?.id && app.period !== data.period.id) continue
      map.set(app.category, app)
      if (app.category_code) map.set(app.category_code, app)
    }
    return map
  }, [applications, data?.period?.id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (needConfirm) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardContent className="p-7 text-center">
            <h1 className="text-section font-semibold text-foreground">本學期申請資料確認</h1>
            <p className="mt-2.5 text-sm leading-relaxed text-subtle">
              開始申請前，請先確認本學期的科系、年級與聯絡方式。確認後即可填寫各申請項目。
            </p>
            <Button asChild variant="brand" size="lg" className="mt-6">
              <Link to="/student/current/confirm">
                確認本學期資料
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <ErrorState title="無法載入申請項目" message={error ?? '載入失敗'} onRetry={() => void load()} />
        <Button asChild variant="outline">
          <Link to="/student">返回首頁</Link>
        </Button>
      </div>
    )
  }

  const warning =
    data.min_application_rule === 'warning_only' && data.started_count < data.min_application_count

  async function handleStart(item: CategoryItem) {
    setBusyCode(item.category.code)
    setMessage(null)
    try {
      await startCategory(item.category.code)
      navigate(`/student/current/category/${item.category.code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setBusyCode(null)
    }
  }

  async function handleCopyPrevious(item: CategoryItem) {
    setBusyCode(item.category.code)
    setMessage(null)
    try {
      await copyPreviousCategory(item.category.code)
      const formCopy = await copyPreviousFormSubmission(item.category.code)
      setMessage(formCopy.message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setBusyCode(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.period.name}
        backTo="/student"
        backLabel="返回首頁"
        description={
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden />
            申請期間 {formatTaipeiDateTime(data.period.start_at)} ～{' '}
            {formatTaipeiDateTime(data.period.end_at)}
          </span>
        }
        meta={
          <Badge tone="neutral">
            已開始 {data.started_count} 項
          </Badge>
        }
      />

      {warning ? (
        <InlineNotice tone="attention" title="申請項目數量提醒">
          本計畫原則至少提出 {data.min_application_count} 項以上申請，你目前已開始{' '}
          {data.started_count} 項。
        </InlineNotice>
      ) : null}

      {message ? <InlineNotice tone="positive">{message}</InlineNotice> : null}
      {error ? <ErrorState message={error} /> : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => {
          const { category, entry, previous_entry } = item
          const application = appsByCategory.get(category.id) || appsByCategory.get(category.code) || null
          const frozen =
            application &&
            application.status !== 'returned_for_edit' &&
            application.status !== 'supplement_required'
          const state = entryStateLabel(application, entry?.status)
          const busy = busyCode === category.code
          const href = `/student/current/category/${category.code}`

          return (
            <li key={category.id}>
              <article
                className={cn(
                  'flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors',
                  entry ? 'hover:border-border-strong' : 'border-dashed',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-card font-semibold text-foreground">
                    {entry ? (
                      <Link to={href} className="rounded-sm hover:text-accent-strong">
                        {category.name}
                      </Link>
                    ) : (
                      category.name
                    )}
                  </h2>
                  <Badge tone={state.tone} className="shrink-0">
                    {state.label}
                  </Badge>
                </div>

                {category.description ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-subtle">
                    {category.description}
                  </p>
                ) : null}

                <dl className="mt-4 space-y-1 text-meta text-muted-foreground">
                  {application?.application_number ? (
                    <div className="flex justify-between gap-2">
                      <dt>申請編號</dt>
                      <dd className="tabular text-foreground">{application.application_number}</dd>
                    </div>
                  ) : null}
                  {application?.status === 'funding_decided' && application.approved_amount != null ? (
                    <div className="flex justify-between gap-2">
                      <dt>核定金額</dt>
                      <dd className="tabular font-medium text-foreground">
                        NT$ {formatAmount(application.approved_amount)}
                      </dd>
                    </div>
                  ) : null}
                  {entry?.updated ? (
                    <div className="flex justify-between gap-2">
                      <dt>最後更新</dt>
                      <dd>{formatTaipeiDateTime(entry.updated)}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-auto flex flex-col gap-2 pt-5">
                  {entry ? (
                    <Button
                      type="button"
                      variant={frozen ? 'outline' : 'default'}
                      className="w-full"
                      onClick={() => navigate(href)}
                    >
                      {frozen ? (
                        <>
                          <Lock />
                          查看申請
                        </>
                      ) : application?.status === 'returned_for_edit' ? (
                        '繼續修改'
                      ) : (
                        '繼續填寫'
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="brand"
                        className="w-full"
                        disabled={Boolean(busyCode)}
                        onClick={() => void handleStart(item)}
                      >
                        {busy ? '處理中…' : '開始填寫'}
                      </Button>
                      {previous_entry ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full"
                          disabled={Boolean(busyCode)}
                          onClick={() => void handleCopyPrevious(item)}
                        >
                          <CopyPlus />
                          套用上一期資料
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
