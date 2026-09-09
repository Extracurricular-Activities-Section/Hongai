import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchStudentMe } from '@/features/auth/student/api'
import { listMyFollowUpTasks } from '@/features/follow-up/api'
import { countPendingStudentTasks } from '@/features/follow-up/utils/status-labels'
import { fetchCurrentPeriodState } from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { CurrentPeriodState, StudentMeResponse } from '@/types'

export function StudentHomePage() {
  const [me, setMe] = useState<StudentMeResponse | null>(null)
  const [periodState, setPeriodState] = useState<CurrentPeriodState | null>(null)
  const [pendingTasks, setPendingTasks] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [meData, periodData, tasks] = await Promise.all([
          fetchStudentMe(),
          fetchCurrentPeriodState(),
          listMyFollowUpTasks().catch(() => []),
        ])
        if (!cancelled) {
          setMe(meData)
          setPeriodState(periodData)
          setPendingTasks(countPendingStudentTasks(tasks))
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '無法載入資料')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!me || !periodState) return <p className="text-sm text-muted-foreground">載入中…</p>

  const latest = periodState.latest_period
  const grade = periodState.period_profile?.grade || me.profile.grade

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">您好，{me.profile.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">歡迎使用弘愛築夢申請管理系統。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本資訊摘要</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>學號：{me.student.student_no}</p>
          <p>姓名：{me.profile.name}</p>
          <p>科系：{me.profile.department_name}</p>
          <p>年級：{grade}</p>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/student/profile">查看 / 修改基本資料</Link>
      </Button>

      {pendingTasks != null && pendingTasks > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>待處理追蹤任務</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>你有 {pendingTasks} 項追蹤任務待處理。</p>
            <Button asChild>
              <Link to="/student/tasks">前往任務</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>目前申請</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!latest || periodState.ui_state === 'none' ? (
            <p className="text-muted-foreground">
              {periodState.has_history
                ? '目前沒有開放中的申請。請至歷史申請紀錄查看。'
                : '目前沒有可申請內容與歷史紀錄。'}
            </p>
          ) : null}

          {latest && periodState.ui_state === 'open' ? (
            <>
              <p className="font-medium">{latest.name}</p>
              <p>狀態：申請開放中</p>
              <p>
                申請期間：{formatTaipeiDateTime(latest.start_at)} ～{' '}
                {formatTaipeiDateTime(latest.end_at)}
              </p>
              <Button asChild>
                <Link to="/student/current">進入申請</Link>
              </Button>
            </>
          ) : null}

          {latest && periodState.ui_state === 'scheduled' ? (
            <>
              <p className="font-medium">{latest.name}</p>
              <p>狀態：尚未開放</p>
              <p>預計開放：{formatTaipeiDateTime(latest.start_at)}</p>
              <Button asChild variant="outline">
                <Link to="/student/history">查看申請資訊</Link>
              </Button>
            </>
          ) : null}

          {latest && periodState.ui_state === 'closed' ? (
            <p className="text-muted-foreground">目前沒有開放中的申請。</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>歷史申請紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/student/history">查看歷史</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
