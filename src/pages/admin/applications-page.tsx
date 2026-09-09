import { Inbox } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AmountDisplay } from '@/components/common/amount-display'
import { DataTable, LinkRow, Pagination, Td, Th } from '@/components/common/data-table'
import { FilterBar, FilterSelect, SearchInput } from '@/components/common/filter-bar'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { adminListApplications } from '@/features/applications/api'
import { StatusBadge } from '@/features/applications/components/status-badge'
import type { Application } from '@/features/applications/types'
import {
  APPLICATION_STATUS_LABELS,
  ELIGIBILITY_STATUS_LABELS,
} from '@/features/applications/utils/status-labels'
import { adminListCategories, adminListPeriods } from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { ApplicationCategory, ApplicationPeriod } from '@/types'

const PER_PAGE = 20

export function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Application[] | null>(null)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [periods, setPeriods] = useState<ApplicationPeriod[]>([])
  const [categories, setCategories] = useState<ApplicationCategory[]>([])

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const eligibility = searchParams.get('eligibility_status') || ''
  const period = searchParams.get('period') || ''
  const category = searchParams.get('category') || ''
  const page = Math.max(1, Number(searchParams.get('page') || 1))

  const activeFilterCount = [status, eligibility, period, category].filter(Boolean).length

  const queryKey = useMemo(
    () => ({ q, status, eligibility, period, category, page }),
    [q, status, eligibility, period, category, page],
  )

  useEffect(() => {
    void Promise.all([adminListPeriods(), adminListCategories()])
      .then(([p, c]) => {
        setPeriods(p)
        setCategories(c)
      })
      .catch(() => {
        /* filters optional */
      })
  }, [])

  useEffect(() => {
    setItems(null)
    setError(null)
    void adminListApplications({
      q: queryKey.q || undefined,
      status: queryKey.status || undefined,
      eligibility_status: queryKey.eligibility || undefined,
      period: queryKey.period || undefined,
      category: queryKey.category || undefined,
      page: queryKey.page,
      perPage: PER_PAGE,
    })
      .then((data) => {
        setItems(data.items)
        setTotalItems(data.totalItems)
        setTotalPages(data.totalPages)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [queryKey])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  function clearFilters() {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    setSearchParams(next)
  }

  const hasResults = items != null && items.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="案件管理"
        description="承辦僅顯示授權範圍內的案件。可依關鍵字、狀態、資格、梯次與類別縮小範圍。"
      />

      <FilterBar>
        <SearchInput
          ariaLabel="搜尋案件"
          placeholder="編號／學號／姓名／項目"
          defaultValue={q}
          onSearch={(value) => updateParam('q', value)}
        />
        <FilterSelect
          label="申請狀態"
          allLabel="全部狀態"
          value={status}
          options={Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => updateParam('status', value)}
        />
        <FilterSelect
          label="資格狀態"
          allLabel="全部資格"
          value={eligibility}
          options={Object.entries(ELIGIBILITY_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => updateParam('eligibility_status', value)}
        />
        <FilterSelect
          label="申請梯次"
          allLabel="全部梯次"
          value={period}
          options={periods.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => updateParam('period', value)}
        />
        <FilterSelect
          label="申請類別"
          allLabel="全部類別"
          value={category}
          options={categories.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(value) => updateParam('category', value)}
        />
        {activeFilterCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            清除篩選（{activeFilterCount}）
          </Button>
        ) : null}
      </FilterBar>

      {error ? <ErrorState message={error} /> : null}
      {!items && !error ? <SkeletonTable rows={8} /> : null}

      {items && items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="沒有符合條件的案件"
          description={
            activeFilterCount > 0 || q
              ? '試著放寬篩選條件，或清除目前的關鍵字。'
              : '目前授權範圍內尚無案件。'
          }
          action={
            activeFilterCount > 0 ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                清除篩選
              </Button>
            ) : null
          }
        />
      ) : null}

      {hasResults ? (
        <>
          {/* Desktop: dense scannable table. */}
          <DataTable caption="案件清單" className="hidden md:block" head={
            <>
              <Th>申請編號</Th>
              <Th>學生</Th>
              <Th>項目</Th>
              <Th>狀態</Th>
              <Th align="right">金額</Th>
              <Th>送件時間</Th>
            </>
          }>
            {items.map((item) => (
              <LinkRow key={item.id} to={`/admin/applications/${item.id}`}>
                <Td>
                  <Link
                    to={`/admin/applications/${item.id}`}
                    className="rounded-sm font-medium text-foreground tabular hover:text-accent-strong"
                  >
                    {item.application_number}
                  </Link>
                </Td>
                <Td>
                  <span className="block text-foreground">{item.student_name || '—'}</span>
                  <span className="block text-meta text-muted-foreground tabular">
                    {item.student_no}
                  </span>
                </Td>
                <Td className="text-subtle">{item.category_name || item.category}</Td>
                <Td>
                  <StatusBadge status={item.status} />
                </Td>
                <Td align="right">
                  <AmountDisplay
                    value={item.approved_amount != null ? item.approved_amount : item.requested_amount}
                    muted={item.approved_amount == null}
                  />
                </Td>
                <Td className="whitespace-nowrap text-meta text-muted-foreground">
                  {formatTaipeiDateTime(item.submitted_at)}
                </Td>
              </LinkRow>
            ))}
          </DataTable>

          {/* Mobile: the same record as a stacked card. */}
          <ul className="space-y-3 md:hidden">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/admin/applications/${item.id}`}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-foreground tabular">
                      {item.application_number}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {item.student_name}
                    <span className="ml-2 text-meta text-muted-foreground tabular">
                      {item.student_no}
                    </span>
                  </p>
                  <p className="mt-0.5 text-meta text-subtle">{item.category_name}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <AmountDisplay
                      value={
                        item.approved_amount != null ? item.approved_amount : item.requested_amount
                      }
                      muted={item.approved_amount == null}
                    />
                    <span className="text-meta text-muted-foreground">
                      {formatTaipeiDateTime(item.submitted_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={(next) => updateParam('page', String(next))}
          />
        </>
      ) : null}
    </div>
  )
}
