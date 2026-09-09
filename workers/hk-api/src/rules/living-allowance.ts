/** Living allowance bracket lookup. */

export type LivingAllowanceRule = {
  code: string
  label: string
  amount: number | null
  needs_policy_confirmation?: boolean
  active?: boolean
}

export type LivingAllowanceLookup = {
  code: string
  found: boolean
  amount: number | null
  status: 'ok' | 'unknown_bracket' | 'needs_policy_confirmation' | 'inactive'
  message: string
}

export function lookupLivingAllowance(
  code: string,
  rules: LivingAllowanceRule[],
): LivingAllowanceLookup {
  const rule = rules.find((r) => r.code === code)
  if (!rule) {
    return {
      code,
      found: false,
      amount: null,
      status: 'unknown_bracket',
      message: '未知級距，需政策確認（needs_policy_confirmation）。',
    }
  }
  if (rule.needs_policy_confirmation) {
    return {
      code,
      found: true,
      amount: rule.amount,
      status: 'needs_policy_confirmation',
      message: `級距「${rule.label}」尚待政策確認。`,
    }
  }
  if (rule.active === false) {
    return {
      code,
      found: true,
      amount: rule.amount,
      status: 'inactive',
      message: `級距「${rule.label}」未啟用。`,
    }
  }
  return {
    code,
    found: true,
    amount: rule.amount,
    status: 'ok',
    message: `級距「${rule.label}」金額 ${rule.amount ?? 0}`,
  }
}
