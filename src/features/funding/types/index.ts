export interface FundingDecisionItem {
  id: string
  funding_decision: string
  item_code: string
  item_label: string
  requested_amount: number
  approved_amount: number
  note: string | null
  sort_order: number
}

export interface FundingDecision {
  id: string
  application: string
  decision_version: number
  requested_total: number
  approved_total: number
  decision_note: string | null
  student_message: string | null
  change_reason: string | null
  decided_by: string
  decided_at: string | null
  status: 'final' | 'superseded' | string
  superseded_by: string | null
  created: string
  internal_note?: string | null
  items?: FundingDecisionItem[]
}

export interface FundingExtractedItem {
  item_code: string
  item_label: string
  requested_amount: number
  sort_order?: number
}

export interface FundingExtracted {
  requested_total: number
  items: FundingExtractedItem[]
}

export interface FundingRuleWarning {
  rule_type: string
  message: string
  limit_amount: number
  projected: number
}

export interface AnnualFundingSummary {
  academic_year: number
  total_requested: number
  total_approved: number
  applications: Array<{
    application_id: string
    application_number: string
    category: string
    status: string
    requested_amount: number
    approved_amount: number
  }>
}
