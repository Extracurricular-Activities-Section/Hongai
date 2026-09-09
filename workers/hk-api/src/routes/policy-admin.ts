import { requireStaff } from '../lib/auth-staff'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * Admin policy / finance read APIs (service account data access).
 * GET /api/hk/admin/policy/category-rules
 * GET /api/hk/admin/policy/living-allowance
 * GET /api/hk/admin/policy/academic-year
 * GET /api/hk/admin/funding/disbursement-plans
 * GET /api/hk/admin/funding/rewards
 */
export async function handlePolicyAdmin(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  const routes = new Set([
    '/api/hk/admin/policy/category-rules',
    '/api/hk/admin/policy/living-allowance',
    '/api/hk/admin/policy/academic-year',
    '/api/hk/admin/funding/disbursement-plans',
    '/api/hk/admin/funding/rewards',
  ])
  if (!routes.has(path) || request.method !== 'GET') return null

  const staff = await requireStaff(request, env)
  if (staff instanceof Response) return staff

  let pb
  try {
    pb = await createServicePb(env)
  } catch (err) {
    return json(
      {
        error: 'service_account_required',
        message:
          err instanceof Error
            ? err.message
            : '需要 HK_PB_SERVICE_EMAIL / HK_PB_SERVICE_PASSWORD',
      },
      { status: 503 },
    )
  }

  try {
    if (path === '/api/hk/admin/policy/category-rules') {
      const items = await pb.collection('hk_category_rules').getFullList({
        sort: '-version',
        expand: 'category',
      })
      return json({ items })
    }
    if (path === '/api/hk/admin/policy/living-allowance') {
      const items = await pb.collection('hk_living_allowance_rules').getFullList({
        sort: 'sort_order',
      })
      return json({ items })
    }
    if (path === '/api/hk/admin/policy/academic-year') {
      const items = await pb.collection('hk_academic_year_policies').getFullList({
        sort: '-academic_year',
      })
      return json({ items })
    }
    if (path === '/api/hk/admin/funding/disbursement-plans') {
      const items = await pb.collection('hk_disbursement_plans').getList(1, 50, {
        sort: '-created',
        expand: 'application',
      })
      return json({ items: items.items, totalItems: items.totalItems })
    }
    if (path === '/api/hk/admin/funding/rewards') {
      const items = await pb.collection('hk_rewards').getList(1, 50, {
        sort: '-created',
      })
      return json({ items: items.items, totalItems: items.totalItems })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '讀取政策資料失敗'
    return json({ error: 'pb_error', message }, { status: 502 })
  }

  return null
}
