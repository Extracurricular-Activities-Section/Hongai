/** Annual funding cap helpers. */

export type AnnualFundingSummary = {
  academic_year: string
  annual_limit: number
  approved_to_date: number
  case_requested: number
  case_proposed: number
  after_approval: number
  remaining: number
  exceeds_limit: boolean
}

export function computeAnnualFundingSummary(input: {
  academic_year: string
  annual_limit?: number
  approved_to_date: number
  case_requested?: number
  case_proposed: number
}): AnnualFundingSummary {
  const limit = input.annual_limit ?? 150_000
  const approved = Math.max(0, input.approved_to_date)
  const proposed = Math.max(0, input.case_proposed)
  const after = approved + proposed
  const remaining = Math.max(0, limit - after)

  return {
    academic_year: input.academic_year,
    annual_limit: limit,
    approved_to_date: approved,
    case_requested: Math.max(0, input.case_requested ?? 0),
    case_proposed: proposed,
    after_approval: after,
    remaining,
    exceeds_limit: after > limit,
  }
}
