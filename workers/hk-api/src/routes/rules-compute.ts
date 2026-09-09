import { json, type WorkerEnv } from '../lib/http'
import { evaluateDisbursementGate, type MilestoneStatus } from '../rules/disbursement'
import { evaluateEligibility } from '../rules/eligibility'
import { lookupLivingAllowance, type LivingAllowanceRule } from '../rules/living-allowance'
import { grantIsNotReward, validateRewardDraft } from '../rules/rewards'

/**
 * Pure rule compute endpoints (no PII logged).
 * POST /api/hk/rules/eligibility/evaluate
 * POST /api/hk/rules/living-allowance/lookup
 * POST /api/hk/rules/disbursement/gate
 * POST /api/hk/rules/rewards/validate
 */
export async function handleRulesCompute(
  request: Request,
  _env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (request.method !== 'POST') return null

  if (path === '/api/hk/rules/eligibility/evaluate') {
    let body: Parameters<typeof evaluateEligibility>[0]
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
    }
    return json({ result: evaluateEligibility(body) })
  }

  if (path === '/api/hk/rules/living-allowance/lookup') {
    let body: { code?: string; rules?: LivingAllowanceRule[] }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
    }
    return json({
      result: lookupLivingAllowance(body.code || '', Array.isArray(body.rules) ? body.rules : []),
    })
  }

  if (path === '/api/hk/rules/disbursement/gate') {
    let body: {
      milestone_status?: MilestoneStatus
      requires_follow_up?: boolean
      blocking_follow_ups_open?: number
      review_approved?: boolean
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
    }
    return json({
      result: evaluateDisbursementGate({
        milestone_status: body.milestone_status || 'pending',
        requires_follow_up: Boolean(body.requires_follow_up),
        blocking_follow_ups_open: Number(body.blocking_follow_ups_open) || 0,
        review_approved: Boolean(body.review_approved),
      }),
    })
  }

  if (path === '/api/hk/rules/rewards/validate') {
    let body: Parameters<typeof validateRewardDraft>[0]
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
    }
    return json({
      result: validateRewardDraft(body),
      models: grantIsNotReward(),
    })
  }

  return null
}
