/** Academic-year progress rules (server-side). */

export type AcademicYearPolicy = {
  academic_year: string
  minimum_categories: number
  annual_total_limit: number
}

export const DEFAULT_ACADEMIC_YEAR_POLICY: AcademicYearPolicy = {
  academic_year: 'default',
  minimum_categories: 2,
  annual_total_limit: 150_000,
}

export type AcademicYearProgress = {
  academic_year: string
  completed_categories: number
  minimum_categories: number
  remaining: number
  meets_minimum: boolean
  /** Single-term applications must NOT be hard-blocked when below minimum. */
  hard_block_single_term: false
  message: string
}

export function computeAcademicYearProgress(input: {
  academic_year: string
  completed_category_codes: string[]
  policy?: AcademicYearPolicy
}): AcademicYearProgress {
  const policy = input.policy ?? {
    ...DEFAULT_ACADEMIC_YEAR_POLICY,
    academic_year: input.academic_year || 'default',
  }
  const unique = [...new Set(input.completed_category_codes.filter(Boolean))]
  const completed = unique.length
  const remaining = Math.max(0, policy.minimum_categories - completed)
  const meets = completed >= policy.minimum_categories

  return {
    academic_year: input.academic_year || policy.academic_year,
    completed_categories: completed,
    minimum_categories: policy.minimum_categories,
    remaining,
    meets_minimum: meets,
    hard_block_single_term: false,
    message: meets
      ? `本學年度已完成 ${completed} / ${policy.minimum_categories} 項計畫。`
      : `本學年度至少需完成兩項計畫，目前完成 ${completed} / ${policy.minimum_categories}。`,
  }
}
