import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchStudentHistory } from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { HistoryPeriodSummary } from '@/types'

export function StudentHistoryPage() {
  const [items, setItems] = useState<HistoryPeriodSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchStudentHistory()
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          目前沒有歷史申請紀錄。
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">歷史申請紀錄</h1>
      {items.map((item) => (
        <Card key={item.period.id}>
          <CardHeader>
            <CardTitle className="text-base">{item.period.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              期間：{formatTaipeiDateTime(item.period.start_at)} ～{' '}
              {formatTaipeiDateTime(item.period.end_at)}
            </p>
            <p>申請項目：{item.entry_count} 項</p>
            {item.category_names.length > 0 ? (
              <p>{item.category_names.join('、')}</p>
            ) : null}
            {item.is_current_editable ? (
              <Button asChild size="sm">
                <Link to="/student/current">前往目前申請</Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link to={`/student/history/${item.period.id}`}>查看</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
