import { useEffect, useState } from 'react'

import { AmountDisplay } from '@/components/common/amount-display'
import { DataTable, Td, Th } from '@/components/common/data-table'
import { FilterBar, FilterChips, FilterSelect } from '@/components/common/filter-bar'
import { Metric, MetricRow } from '@/components/common/metric'
import { SectionHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Skeleton } from '@/components/ui/skeleton'
import { adminListPeriods } from '@/features/periods/api'
import type { ApplicationPeriod } from '@/types'
import { adminCategoryFundingStats } from '../api'
import type { CategoryFundingScope, CategoryFundingStats } from '../types'

const SCOPE_OPTIONS: Array<{ value: CategoryFundingScope; label: string }> = [
  { value: 'funded', label: '已核定案件' },
  { value: 'submitted', label: '全部已送件' },
]

/** 九項目補助統計：系所合計、系所×項目人次，以及跨項目去重人數。 */
export function CategoryFundingStatsSection() {
  const [periods, setPeriods] = useState<ApplicationPeriod[]>([])
  const [period, setPeriod] = useState('')
  const [scope, setScope] = useState<CategoryFundingScope>('funded')
  const [stats, setStats] = useState<CategoryFundingStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void adminListPeriods()
      .then(setPeriods)
      .catch(() => {
        /* 梯次篩選為選用 */
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setStats(null)
    setError(null)
    void adminCategoryFundingStats({ period: period || undefined, scope })
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      })
    return () => {
      cancelled = true
    }
  }, [period, scope])

  const totals = stats
    ? {
        approved: stats.by_department.reduce((sum, row) => sum + row.approved_total, 0),
        applications: stats.by_department.reduce((sum, row) => sum + row.application_count, 0),
      }
    : null

  return (
    <section className="space-y-4" aria-labelledby="category-funding-stats-title">
      <SectionHeader
        title={<span id="category-funding-stats-title">九項目補助統計</span>}
        description={
          stats?.restricted_to_categories
            ? '僅統計你被授權的申請項目。'
            : '依學生所屬系所與申請項目統計，同一學生跨項目只計一次人數。'
        }
      />

      <FilterBar>
        <FilterSelect
          label="申請梯次"
          allLabel="全部梯次"
          value={period}
          options={periods.map((item) => ({ value: item.id, label: item.name }))}
          onChange={setPeriod}
        />
        <FilterChips
          label="統計範圍"
          value={scope}
          options={SCOPE_OPTIONS}
          onChange={(value) => setScope(value as CategoryFundingScope)}
        />
      </FilterBar>

      {error ? <ErrorState message={error} /> : null}
      {!stats && !error ? <Skeleton className="h-48 w-full rounded-lg" /> : null}

      {stats && totals ? (
        <>
          <MetricRow className="lg:grid-cols-3">
            <Metric
              label="核定金額合計"
              value={<AmountDisplay value={totals.approved} size="lg" />}
              hint={scope === 'funded' ? '僅計有效核定' : '未核定案件以 0 計'}
            />
            <Metric label="案件數" value={totals.applications} hint="符合統計範圍的案件" />
            <Metric
              label="去重人數（跨項目）"
              value={stats.unique_students_across_categories}
              hint="九項目合計，同一學生只計一次"
            />
          </MetricRow>

          {stats.by_department.length === 0 ? (
            <EmptyState
              compact
              title="沒有符合條件的統計資料"
              description={
                scope === 'funded'
                  ? '目前範圍內尚無已核定案件，可切換為「全部已送件」。'
                  : '目前授權範圍內尚無已送件案件。'
              }
            />
          ) : (
            <>
              <DataTable
                caption="各系所補助統計"
                minWidth="36rem"
                head={
                  <>
                    <Th>系所</Th>
                    <Th align="right">核定金額</Th>
                    <Th align="right">案件數</Th>
                    <Th align="right">不重複人數</Th>
                  </>
                }
              >
                {stats.by_department.map((row) => (
                  <tr key={row.department_name} className="border-b border-border last:border-0">
                    <Td className="text-foreground">{row.department_name}</Td>
                    <Td align="right">
                      <AmountDisplay value={row.approved_total} />
                    </Td>
                    <Td align="right" className="tabular">
                      {row.application_count}
                    </Td>
                    <Td align="right" className="tabular">
                      {row.unique_students}
                    </Td>
                  </tr>
                ))}
              </DataTable>

              <DataTable
                caption="各系所各項目人次與核定金額"
                minWidth="44rem"
                head={
                  <>
                    <Th>系所</Th>
                    <Th>申請項目</Th>
                    <Th align="right">人次</Th>
                    <Th align="right">不重複人數</Th>
                    <Th align="right">核定金額</Th>
                  </>
                }
              >
                {stats.by_department_category.map((row) => (
                  <tr
                    key={`${row.department_name}:${row.category_code}`}
                    className="border-b border-border last:border-0"
                  >
                    <Td className="text-foreground">{row.department_name}</Td>
                    <Td className="text-subtle">{row.category_name || row.category_code}</Td>
                    <Td align="right" className="tabular">
                      {row.person_times}
                    </Td>
                    <Td align="right" className="tabular">
                      {row.unique_students}
                    </Td>
                    <Td align="right">
                      <AmountDisplay value={row.approved_total} />
                    </Td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
        </>
      ) : null}
    </section>
  )
}
