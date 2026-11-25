import { Link } from 'react-router-dom'

import { AmountDisplay } from '@/components/common/amount-display'
import { DataTable, Td, Th } from '@/components/common/data-table'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/features/applications/components/status-badge'
import type { AnnualFundingSummary } from '@/features/funding/types'
import { formatTaipeiDateTime } from '@/lib/utils'

/**
 * 審核時參考：同一學生本學年度歷次案件的申請／核定金額，
 * 依案件逐筆列出（含各核定項目），並附各類別小計與年度上限。
 */
export function AnnualFundingHistory({
  summary,
  currentApplicationId,
}: {
  summary: AnnualFundingSummary
  currentApplicationId: string
}) {
  const { applications, by_category: byCategory = [], annual_limit: annualLimit } = summary
  const remaining = annualLimit != null ? Math.max(0, annualLimit - summary.total_approved) : null

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-card font-semibold text-foreground">
          {summary.academic_year} 學年度歷次申請與核定
        </h2>
        <p className="mt-1 text-sm text-subtle">
          同一學生本學年度所有已送件案件（含本案），供審核與核定時比對。
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg bg-surface-muted px-4 py-3">
        <div>
          <dt className="text-meta text-muted-foreground">申請合計</dt>
          <dd>
            <AmountDisplay value={summary.total_requested} />
          </dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">已核定合計</dt>
          <dd>
            <AmountDisplay value={summary.total_approved} />
          </dd>
        </div>
        {annualLimit != null ? (
          <>
            <div>
              <dt className="text-meta text-muted-foreground">年度上限</dt>
              <dd>
                <AmountDisplay value={annualLimit} muted />
              </dd>
            </div>
            <div>
              <dt className="text-meta text-muted-foreground">尚可核定</dt>
              <dd>
                <AmountDisplay value={remaining} />
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      {applications.length === 0 ? (
        <p className="text-sm text-muted-foreground">本學年度尚無已送件案件。</p>
      ) : (
        <DataTable
          caption="本學年度歷次案件明細"
          minWidth="44rem"
          head={
            <>
              <Th>案件</Th>
              <Th>項目</Th>
              <Th>狀態</Th>
              <Th align="right">申請金額</Th>
              <Th align="right">核定金額</Th>
            </>
          }
        >
          {applications.map((item) => {
            const isCurrent = item.application_id === currentApplicationId
            return (
              <tr
                key={item.application_id}
                className="border-b border-border align-top last:border-0"
              >
                <Td>
                  {isCurrent ? (
                    <span className="font-medium text-foreground tabular">
                      {item.application_number}
                    </span>
                  ) : (
                    <Link
                      to={`/admin/applications/${item.application_id}`}
                      className="rounded-sm font-medium text-foreground tabular hover:text-accent-strong"
                    >
                      {item.application_number}
                    </Link>
                  )}
                  {isCurrent ? (
                    <Badge tone="brand" className="ml-2">
                      本案
                    </Badge>
                  ) : null}
                  <span className="mt-0.5 block text-meta text-muted-foreground">
                    {[item.period_name, formatTaipeiDateTime(item.submitted_at)]
                      .filter((part) => part && part !== '—')
                      .join(' · ')}
                  </span>
                </Td>
                <Td>
                  <span className="text-foreground">{item.category_name || item.category}</span>
                  {item.items?.length ? (
                    <ul className="mt-1 space-y-0.5 text-meta text-muted-foreground">
                      {item.items.map((line, index) => (
                        <li key={`${line.item_label}-${index}`}>
                          {line.item_label}：申請{' '}
                          <AmountDisplay value={line.requested_amount} size="sm" muted /> → 核定{' '}
                          <AmountDisplay value={line.approved_amount} size="sm" />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Td>
                <Td>
                  <StatusBadge status={item.status} />
                </Td>
                <Td align="right">
                  <AmountDisplay value={item.requested_amount} muted />
                </Td>
                <Td align="right">
                  {item.has_final_decision === false ? (
                    <span className="text-meta text-muted-foreground">尚未核定</span>
                  ) : (
                    <AmountDisplay value={item.approved_amount} />
                  )}
                </Td>
              </tr>
            )
          })}
        </DataTable>
      )}

      {byCategory.length > 0 ? (
        <DataTable
          caption="本學年度各類別小計"
          minWidth="34rem"
          head={
            <>
              <Th>類別</Th>
              <Th align="right">件數</Th>
              <Th align="right">申請金額</Th>
              <Th align="right">核定金額</Th>
            </>
          }
        >
          {byCategory.map((row) => (
            <tr key={row.category} className="border-b border-border last:border-0">
              <Td>{row.category_name || row.category}</Td>
              <Td align="right" className="tabular">
                {row.application_count}
              </Td>
              <Td align="right">
                <AmountDisplay value={row.requested_amount} muted />
              </Td>
              <Td align="right">
                <AmountDisplay value={row.approved_amount} />
              </Td>
            </tr>
          ))}
        </DataTable>
      ) : null}
    </section>
  )
}
