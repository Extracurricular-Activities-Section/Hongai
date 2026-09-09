import { ArrowRight, FileClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonList } from '@/components/ui/skeleton'
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="歷史申請紀錄"
        backTo="/student"
        backLabel="返回首頁"
        description="過往梯次的申請項目與核定結果。"
      />

      {error ? <ErrorState message={error} /> : null}
      {!items && !error ? <SkeletonList rows={3} /> : null}

      {items && items.length === 0 ? (
        <EmptyState
          icon={FileClock}
          title="目前沒有歷史申請紀錄"
          description="完成第一次申請後，過往梯次的紀錄會顯示在這裡。"
        />
      ) : null}

      {items && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.period.id}>
              <article className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-card font-semibold text-foreground">{item.period.name}</h2>
                    <p className="mt-1 text-meta text-muted-foreground">
                      {formatTaipeiDateTime(item.period.start_at)} ～{' '}
                      {formatTaipeiDateTime(item.period.end_at)}
                    </p>
                  </div>
                  <Badge tone={item.is_current_editable ? 'brand' : 'neutral'}>
                    {item.is_current_editable ? '目前梯次' : `${item.entry_count} 項申請`}
                  </Badge>
                </div>

                {item.category_names.length > 0 ? (
                  <p className="mt-3 text-sm text-subtle">{item.category_names.join('、')}</p>
                ) : null}

                <div className="mt-4">
                  {item.is_current_editable ? (
                    <Button asChild size="sm">
                      <Link to="/student/current">
                        前往目前申請
                        <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/student/history/${item.period.id}`}>
                        查看內容
                        <ArrowRight />
                      </Link>
                    </Button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
