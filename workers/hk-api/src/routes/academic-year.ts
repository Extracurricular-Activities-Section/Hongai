import { json, type WorkerEnv } from '../lib/http'
import {
  computeAcademicYearProgress,
  DEFAULT_ACADEMIC_YEAR_POLICY,
} from '../rules/academic-year'

/**
 * POST /api/hk/rules/academic-year/progress
 * Body: { academic_year, completed_category_codes: string[] }
 * Pure computation — no PII logged.
 */
export async function handleAcademicYear(
  request: Request,
  _env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path !== '/api/hk/rules/academic-year/progress' || request.method !== 'POST') {
    return null
  }

  let body: { academic_year?: string; completed_category_codes?: string[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
  }

  const progress = computeAcademicYearProgress({
    academic_year: body.academic_year || 'default',
    completed_category_codes: Array.isArray(body.completed_category_codes)
      ? body.completed_category_codes
      : [],
    policy: DEFAULT_ACADEMIC_YEAR_POLICY,
  })

  return json({ progress })
}
