import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Metric, MetricRow } from '@/components/common/metric'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import {
  adminListDisbursementPlans,
  adminListRewards,
  type DisbursementPlanRow,
  type RewardRow,
} from '@/features/policy/api'
import { computeAnnualFundingSummary } from '@/shared/rules/academic-funding'

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '進行中',
  completed: '已完成',
  cancelled: '已取消',
  pending: '待審',
  approved: '已核准',
  rejected: '已駁回',
  paid: '已撥付',
}

export function AdminFundingPage() {
  const [plans, setPlans] = useState<DisbursementPlanRow[] | null>(null)
  const [rewards, setRewards] = useState<RewardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([adminListDisbursementPlans(), adminListRewards()])
      .then(([p, r]) => {
        setPlans(p.items)
        setRewards(r.items)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [])

  if (error && !plans) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />
  }
  if (!plans || !rewards) return <PageSkeleton />

  const approvedToDate = plans
    .filter((p) => p.status === 'active' || p.status === 'completed')
    .reduce((sum, p) => sum + (Number(p.total_approved) || 0), 0)
  const summary = computeAnnualFundingSummary({
    academic_year: 'current',
    approved_to_date: approvedToDate,
    case_proposed: 0,
  })
  const pendingPay = plans.filter((p) => p.status === 'active').length
  const pendingReward = rewards.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-8">
      <PageHeader
        title="資助與核發"
        description="補助（Grant）與獎勵（Reward）分模型；審核通過不會自動標為已撥付。"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/policy">類別政策</Link>
          </Button>
        }
      />

      <MetricRow>
        <Metric label="年度上限" value={summary.annual_limit.toLocaleString('zh-TW')} />
        <Metric label="已核定合計" value={summary.approved_to_date.toLocaleString('zh-TW')} />
        <Metric label="剩餘空間" value={summary.remaining.toLocaleString('zh-TW')} />
        <Metric label="進行中核發計畫" value={String(pendingPay)} />
        <Metric label="待審獎勵" value={String(pendingReward)} />
      </MetricRow>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">核發計畫</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">計畫 ID</th>
                <th className="px-3 py-2 font-medium">案件</th>
                <th className="px-3 py-2 font-medium">核定總額</th>
                <th className="px-3 py-2 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-subtle">
                    尚無核發計畫。
                  </td>
                </tr>
              ) : (
                plans.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{row.id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.application ? (
                        <Link
                          className="underline underline-offset-2"
                          to={`/admin/applications/${row.application}`}
                        >
                          {row.application.slice(0, 8)}…
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 tabular">
                      {Number(row.total_approved || 0).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-3 py-2">
                      {STATUS_LABEL[row.status || ''] || row.status || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">獎勵紀錄（非補助）</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">類型</th>
                <th className="px-3 py-2 font-medium">金額</th>
                <th className="px-3 py-2 font-medium">學年度</th>
                <th className="px-3 py-2 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {rewards.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-subtle">
                    尚無獎勵紀錄。
                  </td>
                </tr>
              ) : (
                rewards.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{row.reward_type || '—'}</td>
                    <td className="px-3 py-2 tabular">
                      {Number(row.amount || 0).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-3 py-2">{row.academic_year || '—'}</td>
                    <td className="px-3 py-2">
                      {STATUS_LABEL[row.status || ''] || row.status || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
