import { hkApiSend } from '@/lib/api/hk-client'
import { staffPb } from '@/lib/pocketbase'

function staffToken(): string | null {
  return staffPb.authStore.token || null
}

export type CategoryRuleRow = {
  id: string
  category?: string
  academic_year?: string
  version?: number
  needs_policy_confirmation?: boolean
  active?: boolean
  notes?: string
  expand?: { category?: { code?: string; name?: string } }
}

export type LivingAllowanceRow = {
  id: string
  code: string
  label: string
  amount?: number | null
  needs_policy_confirmation?: boolean
  active?: boolean
  sort_order?: number
}

export type AcademicYearPolicyRow = {
  id: string
  academic_year: string
  minimum_categories: number
  annual_total_limit: number
  active?: boolean
  notes?: string
}

export type DisbursementPlanRow = {
  id: string
  application?: string
  total_approved?: number
  status?: string
  notes?: string
}

export type RewardRow = {
  id: string
  application?: string
  reward_type?: string
  status?: string
  amount?: number
  academic_year?: string
}

export async function adminListCategoryRules(): Promise<CategoryRuleRow[]> {
  const data = await hkApiSend<{ items: CategoryRuleRow[] }>(
    '/api/hk/admin/policy/category-rules',
    { method: 'GET', token: staffToken() },
  )
  return data.items ?? []
}

export async function adminListLivingAllowanceRules(): Promise<LivingAllowanceRow[]> {
  const data = await hkApiSend<{ items: LivingAllowanceRow[] }>(
    '/api/hk/admin/policy/living-allowance',
    { method: 'GET', token: staffToken() },
  )
  return data.items ?? []
}

export async function adminListAcademicYearPolicies(): Promise<AcademicYearPolicyRow[]> {
  const data = await hkApiSend<{ items: AcademicYearPolicyRow[] }>(
    '/api/hk/admin/policy/academic-year',
    { method: 'GET', token: staffToken() },
  )
  return data.items ?? []
}

export async function adminListDisbursementPlans(): Promise<{
  items: DisbursementPlanRow[]
  totalItems: number
}> {
  return hkApiSend('/api/hk/admin/funding/disbursement-plans', {
    method: 'GET',
    token: staffToken(),
  })
}

export async function adminListRewards(): Promise<{ items: RewardRow[]; totalItems: number }> {
  return hkApiSend('/api/hk/admin/funding/rewards', {
    method: 'GET',
    token: staffToken(),
  })
}
