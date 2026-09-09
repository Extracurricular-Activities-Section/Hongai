/** Shared academic-year progress (mirrors Worker rule — keep in sync). */

export type AcademicYearProgress = {
  academic_year: string
  completed_categories: number
  minimum_categories: number
  remaining: number
  meets_minimum: boolean
  hard_block_single_term: false
  message: string
}

export function computeAcademicYearProgress(input: {
  academic_year: string
  completed_category_codes: string[]
  minimum_categories?: number
}): AcademicYearProgress {
  const minimum = input.minimum_categories ?? 2
  const unique = [...new Set(input.completed_category_codes.filter(Boolean))]
  const completed = unique.length
  const remaining = Math.max(0, minimum - completed)
  const meets = completed >= minimum

  return {
    academic_year: input.academic_year || 'default',
    completed_categories: completed,
    minimum_categories: minimum,
    remaining,
    meets_minimum: meets,
    hard_block_single_term: false,
    message: meets
      ? `本學年度已完成 ${completed} / ${minimum} 項計畫。`
      : `本學年度至少需完成兩項計畫，目前完成 ${completed} / ${minimum}。`,
  }
}

export function computeAnnualFundingSummary(input: {
  academic_year: string
  annual_limit?: number
  approved_to_date: number
  case_requested?: number
  case_proposed: number
}) {
  const limit = input.annual_limit ?? 150_000
  const approved = Math.max(0, input.approved_to_date)
  const proposed = Math.max(0, input.case_proposed)
  const after = approved + proposed
  return {
    academic_year: input.academic_year,
    annual_limit: limit,
    approved_to_date: approved,
    case_requested: Math.max(0, input.case_requested ?? 0),
    case_proposed: proposed,
    after_approval: after,
    remaining: Math.max(0, limit - after),
    exceeds_limit: after > limit,
  }
}
