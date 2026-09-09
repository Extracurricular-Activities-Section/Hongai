import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApplicationStatusCard } from '@/features/applications/components/application-status-card'
import { listMyApplications } from '@/features/applications/api'
import type { Application } from '@/features/applications/types'
import {
  copyPreviousCategory,
  fetchCurrentCategories,
  fetchCurrentPeriodState,
  startCategory,
  type CurrentCategoriesResponse,
} from '@/features/periods/api'
import { copyPreviousFormSubmission } from '@/features/forms/api'
import { formatTaipeiDateTime } from '@/lib/utils'

export function StudentCurrentPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CurrentCategoriesResponse | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [needConfirm, setNeedConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
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
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const appsByCategory = useMemo(() => {
    const map = new Map<string, Application>()
    for (const app of applications) {
      if (data?.period?.id && app.period !== data.period.id) continue
      map.set(app.category, app)
      if (app.category_code) map.set(app.category_code, app)
    }
    return map
  }, [applications, data?.period?.id])

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button asChild variant="outline">
          <Link to="/student">返回首頁</Link>
        </Button>
      </div>
    )
  }

  if (needConfirm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>本學期申請資料確認</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>完成本學期資料確認後即可開始申請。</p>
          <Button asChild>
            <Link to="/student/current/confirm">確認本學期資料</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return <p className="text-sm text-muted-foreground">載入中…</p>

  const warning =
    data.min_application_rule === 'warning_only' &&
    data.started_count < data.min_application_count

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.period.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          申請期間：{formatTaipeiDateTime(data.period.start_at)} ～{' '}
          {formatTaipeiDateTime(data.period.end_at)}
        </p>
      </div>

      {warning ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm">
          提醒：本計畫原則至少提出 {data.min_application_count} 項以上申請。你目前已開始{' '}
          {data.started_count} 項。
        </div>
      ) : null}

      {message ? <p className="text-sm text-foreground">{message}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map(({ category, entry, previous_entry }) => {
          const application =
            appsByCategory.get(category.id) || appsByCategory.get(category.code) || null
          const frozen =
            application &&
            application.status !== 'returned_for_edit' &&
            application.status !== 'supplement_required'

          return (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="text-base">{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{category.description}</p>
                <ApplicationStatusCard application={application} entryStatus={entry?.status} />
                {entry?.updated ? (
                  <p className="text-xs text-muted-foreground">
                    最後更新：{formatTaipeiDateTime(entry.updated)}
                  </p>
                ) : null}

                {entry ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={busyCode === category.code}
                    onClick={() => navigate(`/student/current/category/${category.code}`)}
                  >
                    {frozen ? '查看申請' : application?.status === 'returned_for_edit' ? '繼續修改' : '繼續填寫'}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!!busyCode}
                      onClick={() => {
                        void (async () => {
                          setBusyCode(category.code)
                          setMessage(null)
                          try {
                            await startCategory(category.code)
                            navigate(`/student/current/category/${category.code}`)
                          } catch (err) {
                            setError(err instanceof Error ? err.message : '操作失敗')
                          } finally {
                            setBusyCode(null)
                          }
                        })()
                      }}
                    >
                      開始填寫
                    </Button>
                    {previous_entry ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={!!busyCode}
                        onClick={() => {
                          void (async () => {
                            setBusyCode(category.code)
                            setMessage(null)
                            try {
                              await copyPreviousCategory(category.code)
                              const formCopy = await copyPreviousFormSubmission(category.code)
                              setMessage(formCopy.message)
                              await load()
                            } catch (err) {
                              setError(err instanceof Error ? err.message : '操作失敗')
                            } finally {
                              setBusyCode(null)
                            }
                          })()
                        }}
                      >
                        套用上一期資料
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
