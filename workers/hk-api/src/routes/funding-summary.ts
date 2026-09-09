import { json, type WorkerEnv } from '../lib/http'
import { computeAnnualFundingSummary } from '../rules/funding'

/**
 * POST /api/hk/rules/funding/annual-summary
 * Body: { academic_year, approved_to_date, case_requested?, case_proposed, annual_limit? }
 */
export async function handleFundingSummary(
  request: Request,
  _env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path !== '/api/hk/rules/funding/annual-summary' || request.method !== 'POST') {
    return null
  }

  let body: {
    academic_year?: string
    approved_to_date?: number
    case_requested?: number
    case_proposed?: number
    annual_limit?: number
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
  }

  const summary = computeAnnualFundingSummary({
    academic_year: body.academic_year || 'default',
    approved_to_date: Number(body.approved_to_date) || 0,
    case_requested: Number(body.case_requested) || 0,
    case_proposed: Number(body.case_proposed) || 0,
    annual_limit: body.annual_limit != null ? Number(body.annual_limit) : undefined,
  })

  return json({ summary })
}
