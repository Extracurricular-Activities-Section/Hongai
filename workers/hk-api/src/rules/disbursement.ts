/** Disbursement milestone gates — review approval ≠ auto-paid. */

export type MilestoneStatus =
  | 'pending'
  | 'eligible'
  | 'ready'
  | 'submitted_for_payment'
  | 'paid'
  | 'failed'
  | 'waived'

export type DisbursementGateInput = {
  milestone_status: MilestoneStatus
  requires_follow_up: boolean
  blocking_follow_ups_open: number
  review_approved: boolean
}

export type DisbursementGateResult = {
  can_mark_ready: boolean
  can_submit_for_payment: boolean
  can_mark_paid: boolean
  auto_paid_on_review: false
  blockers: string[]
}

export function evaluateDisbursementGate(input: DisbursementGateInput): DisbursementGateResult {
  const blockers: string[] = []

  if (!input.review_approved) {
    blockers.push('案件尚未核定通過')
  }
  if (input.requires_follow_up && input.blocking_follow_ups_open > 0) {
    blockers.push(`尚有 ${input.blocking_follow_ups_open} 項阻擋核發之追蹤任務`)
  }

  const baseOk = blockers.length === 0
  const status = input.milestone_status

  return {
    can_mark_ready: baseOk && (status === 'pending' || status === 'eligible'),
    can_submit_for_payment: baseOk && (status === 'ready' || status === 'eligible'),
    can_mark_paid: status === 'submitted_for_payment',
    auto_paid_on_review: false,
    blockers,
  }
}

export function assertNotAutoPaidOnReview(): false {
  return false
}
