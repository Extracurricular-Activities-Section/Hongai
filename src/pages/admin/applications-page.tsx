import { Inbox } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AmountDisplay } from '@/components/common/amount-display'
import { DataTable, LinkRow, Pagination, Td, Th } from '@/components/common/data-table'
import { FilterBar, FilterSelect, SearchInput } from '@/components/common/filter-bar'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, InlineNotice } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { adminListApplications } from '@/features/applications/api'
import { ApplicationCsvTools } from '@/features/applications/components/application-csv-tools'
import { StatusBadge } from '@/features/applications/components/status-badge'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import type { Application } from '@/features/applications/types'
import {
  APPLICATION_STATUS_LABELS,
  ELIGIBILITY_STATUS_LABELS,
} from '@/features/applications/utils/status-labels'
import { adminListCategories, adminListPeriods } from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { ApplicationCategory, ApplicationPeriod } from '@/types'

const PER_PAGE = 20

const SORT_OPTIONS = [
  { value: '-submitted_at', label: '送件時間：新到舊' },
  { value: 'submitted_at', label: '送件時間：舊到新' },
  { value: '-requested_amount', label: '申請金額：高到低' },
  { value: 'requested_amount', label: '申請金額：低到高' },
  { value: '-approved_amount', label: '核定金額：高到低' },
  { value: 'approved_amount', label: '核定金額：低到高' },
  { value: 'status', label: '狀態：依代碼 A→Z' },
  { value: '-status', label: '狀態：依代碼 Z→A' },
]
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value))

export function AdminApplicationsPage() {
  const { isAdmin } = useBackofficeAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Application[] | null>(null)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [periods, setPeriods] = useState<ApplicationPeriod[]>([])
  const [categories, setCategories] = useState<ApplicationCategory[]>([])

  const q = searchParams.get('q') || ''
  const rawQueue = searchParams.get('queue') || ''
  const queue =
    rawQueue === 'awaiting_me' || rawQueue === 'awaiting_student' ? rawQueue : ''
  const status = queue ? '' : searchParams.get('status') || ''
  const eligibility = searchParams.get('eligibility_status') || ''
  const period = searchParams.get('period') || ''
  const category = searchParams.get('category') || ''
  const rawSort = searchParams.get('sort') || ''
  const sort = SORT_VALUES.has(rawSort) ? rawSort : ''
  const page = Math.max(1, Number(searchParams.get('page') || 1))

  const activeFilterCount = [queue, status, eligibility, period, category].filter(Boolean).length

  const queryKey = useMemo(
    () => ({ q, queue, status, eligibility, period, category, sort, page }),
    [q, queue, status, eligibility, period, category, sort, page],
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
      queue:
        queryKey.queue === 'awaiting_me' || queryKey.queue === 'awaiting_student'
          ? queryKey.queue
          : undefined,
      status: queryKey.queue ? undefined : queryKey.status || undefined,
      eligibility_status: queryKey.eligibility || undefined,
      period: queryKey.period || undefined,
      category: queryKey.category || undefined,
      sort: queryKey.sort || undefined,
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
    // 單一狀態篩選與「等我處理」佇列互斥
    if (key === 'status') next.delete('queue')
    if (key === 'queue') next.delete('status')
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  function clearFilters() {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (sort) next.set('sort', sort)
    setSearchParams(next)
  }

  const hasResults = items != null && items.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="案件管理"
        description="承辦僅顯示授權範圍內的案件。可依關鍵字、狀態、資格、梯次與類別縮小範圍。"
        actions={
          <ApplicationCsvTools
            canImport={isAdmin}
            filters={{
              q: q || undefined,
              status: status || undefined,
              eligibility_status: eligibility || undefined,
              period: period || undefined,
              category: category || undefined,
            }}
          />
        }
      />

      {queue === 'awaiting_me' ? (
        <InlineNotice
          tone="attention"
          title="等我處理"
          action={
            <Button type="button" size="sm" variant="ghost" onClick={() => updateParam('queue', '')}>
              清除佇列篩選
            </Button>
          }
        >
          清單與儀表板「等我處理」件數同源：已送件、老師已簽核、資格／內容審核中、待核定補助。
        </InlineNotice>
      ) : null}

      {queue === 'awaiting_student' ? (
        <InlineNotice
          tone="attention"
          title="等待學生回應"
          action={
            <Button type="button" size="sm" variant="ghost" onClick={() => updateParam('queue', '')}>
              清除佇列篩選
            </Button>
          }
        >
          清單與儀表板同源：待補件、退回修改。
        </InlineNotice>
      ) : null}

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
        <FilterSelect
          label="排序方式"
          allLabel="預設排序（最新建立）"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => updateParam('sort', value)}
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
