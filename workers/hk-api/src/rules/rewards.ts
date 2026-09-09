/** Reward model — distinct from grant / funding. */

export type RewardStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'

export type RewardDraft = {
  reward_type: string
  amount: number
  amount_min?: number | null
  amount_max?: number | null
  status?: RewardStatus
}

export type RewardValidation = {
  ok: boolean
  is_grant: false
  reasons: string[]
}

/** Rewards must not be conflated with application grant amounts. */
export function validateRewardDraft(draft: RewardDraft): RewardValidation {
  const reasons: string[] = []

  if (!draft.reward_type?.trim()) {
    reasons.push('缺少 reward_type')
  }
  if (!Number.isFinite(draft.amount) || draft.amount < 0) {
    reasons.push('金額無效')
  }
  if (draft.amount_min != null && draft.amount < draft.amount_min) {
    reasons.push(`低於規則下限 ${draft.amount_min}`)
  }
  if (draft.amount_max != null && draft.amount > draft.amount_max) {
    reasons.push(`超過規則上限 ${draft.amount_max}`)
  }

  return {
    ok: reasons.length === 0,
    is_grant: false,
    reasons,
  }
}

export function grantIsNotReward(): { grant_model: 'funding'; reward_model: 'reward' } {
  return { grant_model: 'funding', reward_model: 'reward' }
}
