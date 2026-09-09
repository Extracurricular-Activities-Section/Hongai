import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { PageHeader } from '@/components/common/page-header'
import { ErrorState, PageSkeleton } from '@/components/common/states'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import {
  adminListAcademicYearPolicies,
  adminListCategoryRules,
  adminListLivingAllowanceRules,
  type AcademicYearPolicyRow,
  type CategoryRuleRow,
  type LivingAllowanceRow,
} from '@/features/policy/api'

export function AdminCategoryPolicyPage() {
  const { isAdmin } = useBackofficeAuth()
  const [rules, setRules] = useState<CategoryRuleRow[] | null>(null)
  const [living, setLiving] = useState<LivingAllowanceRow[] | null>(null)
  const [years, setYears] = useState<AcademicYearPolicyRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    void Promise.all([
      adminListCategoryRules(),
      adminListLivingAllowanceRules(),
      adminListAcademicYearPolicies(),
    ])
      .then(([r, l, y]) => {
        setRules(r)
        setLiving(l)
        setYears(y)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/admin" replace />
  if (error && !rules) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!rules || !living || !years) return <PageSkeleton />

  return (
    <div className="space-y-8">
      <PageHeader
        title="類別政策設定"
        description="與 Form Builder 分離。此處檢視資格／執行／資助／核發規則版本；異動需政策確認者不得自動放行。"
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">學年度政策</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">學年度</th>
                <th className="px-3 py-2 font-medium">最少項目</th>
                <th className="px-3 py-2 font-medium">年度上限</th>
                <th className="px-3 py-2 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {years.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-subtle">
                   尚無資料（請確認 PB migrations 與 service account）。
                  </td>
                </tr>
              ) : (
                years.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{row.academic_year}</td>
                    <td className="px-3 py-2 tabular">{row.minimum_categories}</td>
                    <td className="px-3 py-2 tabular">
                      {Number(row.annual_total_limit).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-3 py-2">{row.active === false ? '停用' : '啟用'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">類別規則版本</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">類別</th>
                <th className="px-3 py-2 font-medium">學年度</th>
                <th className="px-3 py-2 font-medium">版本</th>
                <th className="px-3 py-2 font-medium">政策確認</th>
                <th className="px-3 py-2 font-medium">備註</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-subtle">
                    尚無類別規則。
                  </td>
                </tr>
              ) : (
                rules.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {row.expand?.category?.name ||
                        row.expand?.category?.code ||
                        row.category ||
                        '—'}
                    </td>
                    <td className="px-3 py-2">{row.academic_year || '—'}</td>
                    <td className="px-3 py-2 tabular">{row.version ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.needs_policy_confirmation ? (
                        <span className="text-warning">需確認</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-subtle">{row.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">生活津貼級距</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">代碼</th>
                <th className="px-3 py-2 font-medium">名稱</th>
                <th className="px-3 py-2 font-medium">金額</th>
                <th className="px-3 py-2 font-medium">政策確認</th>
              </tr>
            </thead>
            <tbody>
              {living.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2 tabular">
                    {row.amount != null ? Number(row.amount).toLocaleString('zh-TW') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row.needs_policy_confirmation ? (
                      <span className="text-warning">需確認</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
