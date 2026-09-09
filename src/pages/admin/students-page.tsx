import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { adminGetStudentDetail, adminListStudents } from '@/features/periods/api'
import { formatTaipeiDateTime, maskIdentityNumber } from '@/lib/utils'
import type { ApplicationPeriod, PeriodStudentProfile } from '@/types'

interface StudentListItem {
  id: string
  student_no: string
  name: string
  department_name: string
  identity_masked: string
}

export function AdminStudentsPage() {
  const { isAdmin, isStaff } = useBackofficeAuth()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<StudentListItem[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    student: { id: string; student_no: string }
    profile: {
      name: string
      department_name: string
      grade: string
      email: string
      phone: string
      identity_number_masked: string
    }
    period_profiles: Array<{
      profile: PeriodStudentProfile
      period: ApplicationPeriod | null
    }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    void (async () => {
      try {
        const data = await adminListStudents(query)
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAdmin, query])

  async function openDetail(id: string) {
    setSelectedId(id)
    setDetail(null)
    setError(null)
    try {
      setDetail(await adminGetStudentDetail(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入學生詳情失敗')
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          {isStaff
            ? 'Staff 全校學生瀏覽將於第 7 段案件授權後開放。本階段僅 Admin 可查看學生 Period Profile。'
            : '無權限。'}
        </CardContent>
      </Card>
    )
  }

  if (error && !items) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">學生資料</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          身分證預設遮罩。可查看各梯次 Period Profile snapshot。
        </p>
      </div>

      <Input
        placeholder="搜尋學號或姓名"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">沒有符合的學生。</p>
          ) : (
            items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
                  <div>
                    <p className="font-medium">
                      {item.name}（{item.student_no}）
                    </p>
                    <p className="text-muted-foreground">
                      {item.department_name} · {item.identity_masked || maskIdentityNumber('')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedId === item.id ? 'default' : 'outline'}
                    onClick={() => void openDetail(item.id)}
                  >
                    查看
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">學生詳情 / Period Profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!selectedId ? (
              <p className="text-muted-foreground">請選擇學生。</p>
            ) : !detail ? (
              <p className="text-muted-foreground">載入中…</p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="font-medium">{detail.profile.name}</p>
                  <p>學號：{detail.student.student_no}</p>
                  <p>科系：{detail.profile.department_name}</p>
                  <p>年級：{detail.profile.grade}</p>
                  <p>Email：{detail.profile.email}</p>
                  <p>電話：{detail.profile.phone}</p>
                  <p>身分證：{detail.profile.identity_number_masked}</p>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="font-medium">各梯次 Period Profile</p>
                  {detail.period_profiles.length === 0 ? (
                    <p className="text-muted-foreground">尚無梯次資料。</p>
                  ) : (
                    detail.period_profiles.map(({ profile, period }) => (
                      <div key={profile.id} className="rounded-md border border-border p-3">
                        <p className="font-medium">{period?.name || profile.period}</p>
                        <p>年級 snapshot：{profile.grade || '—'}</p>
                        <p>
                          身分類型：
                          {profile.application_identity_types.join(', ') || '—'}
                        </p>
                        <p>確認時間：{formatTaipeiDateTime(profile.confirmed_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
