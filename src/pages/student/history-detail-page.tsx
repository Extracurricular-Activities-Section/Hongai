import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { identityTypeLabel } from '@/features/periods/constants/eligibility'
import { fetchStudentHistoryDetail } from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { ApplicationPeriod, PeriodStudentProfile, StudentCategoryEntry } from '@/types'
import type { ApplicationCategory } from '@/types'

export function StudentHistoryDetailPage() {
  const { periodId = '' } = useParams()
  const [period, setPeriod] = useState<ApplicationPeriod | null>(null)
  const [profile, setProfile] = useState<PeriodStudentProfile | null>(null)
  const [entries, setEntries] = useState<
    Array<{ entry: StudentCategoryEntry; category: ApplicationCategory | null }>
  >([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchStudentHistoryDetail(periodId)
        if (cancelled) return
        setPeriod(data.period)
        setProfile(data.profile)
        setEntries(data.entries)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [periodId])

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button asChild variant="outline">
          <Link to="/student/history">返回歷史</Link>
        </Button>
      </div>
    )
  }

  if (!period) return <p className="text-sm text-muted-foreground">載入中…</p>
  if (!profile) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{period.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">歷史紀錄（唯讀）</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">當時申請資格 Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>年級：{profile.grade || '—'}</p>
          <p>
            申請身分：
            {profile.application_identity_types.length
              ? profile.application_identity_types.map(identityTypeLabel).join('、')
              : '—'}
          </p>
          <p>身心障礙級距：{profile.disability_level || '—'}</p>
          <p>弱勢助學金級距：{profile.weak_aid_level || '—'}</p>
          <p>曾經申請：{profile.has_applied_before ? '是' : '否'}</p>
          <p>銀行帳號已建置：{profile.bank_account_registered ? '是' : '否'}</p>
          <p>銀行說明：{profile.bank_account_note || '—'}</p>
          <p>資格說明：{profile.qualification_note || '—'}</p>
          <p>確認時間：{formatTaipeiDateTime(profile.confirmed_at)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">當時申請項目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {entries.length === 0 ? (
            <p className="text-muted-foreground">此梯次尚未開始任何項目。</p>
          ) : (
            entries.map(({ entry, category }) => (
              <div key={entry.id} className="space-y-2 border-b border-border pb-3 last:border-0">
                <p className="font-medium">{category?.name || '項目'}</p>
                <p>狀態：{entry.status}</p>
                {category?.code ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/student/history/${periodId}/category/${category.code}`}>
                      查看表單內容
                    </Link>
                  </Button>
                ) : (
                  <p className="text-muted-foreground">無法顯示表單內容</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/student/history">返回歷史列表</Link>
      </Button>
    </div>
  )
}
