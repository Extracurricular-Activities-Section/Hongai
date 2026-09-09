/** Eligibility formal check helpers (category rule snapshot). */

export type EligibilityInput = {
  category_code: string
  academic_year: string
  student_flags?: Record<string, unknown>
  eligibility_json?: Record<string, unknown> | null
  needs_policy_confirmation?: boolean
}

export type EligibilityResult = {
  category_code: string
  academic_year: string
  eligible: boolean | null
  status: 'ok' | 'needs_policy_confirmation' | 'incomplete_rule'
  reasons: string[]
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: string[] = []

  if (input.needs_policy_confirmation) {
    return {
      category_code: input.category_code,
      academic_year: input.academic_year,
      eligible: null,
      status: 'needs_policy_confirmation',
      reasons: ['此類別規則標記 needs_policy_confirmation，禁止自動判定。'],
    }
  }

  if (!input.eligibility_json || Object.keys(input.eligibility_json).length === 0) {
    return {
      category_code: input.category_code,
      academic_year: input.academic_year,
      eligible: null,
      status: 'incomplete_rule',
      reasons: ['缺少 eligibility_json，無法正式判定。'],
    }
  }

  // Formal engine reads structured flags only — no free-text guessing.
  const requiredFlags = Array.isArray(input.eligibility_json.required_flags)
    ? (input.eligibility_json.required_flags as string[])
    : []

  const flags = input.student_flags ?? {}
  for (const key of requiredFlags) {
    if (!flags[key]) {
      reasons.push(`未滿足必要條件：${key}`)
    }
  }

  return {
    category_code: input.category_code,
    academic_year: input.academic_year,
    eligible: reasons.length === 0,
    status: 'ok',
    reasons,
  }
}
