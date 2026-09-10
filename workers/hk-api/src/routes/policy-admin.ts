import { requireStaff } from '../lib/auth-staff'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * Admin policy / finance read APIs backed by hk_settings and hk_applications.
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
          err instanceof Error ? err.message : '需要 HK_PB_SERVICE_EMAIL / HK_PB_SERVICE_PASSWORD',
      },
      { status: 503 },
    )
  }

  try {
    const policyRows = async (key: string) => {
      const items = await pb.collection('hk_settings').getFullList({
        filter: `setting_type = "policy" && key = "${key}"`,
        sort: '-version,-updated',
      })
      return items.flatMap((item) => {
        const value = item.value_json
        return Array.isArray(value) ? value : value ? [value] : []
      })
    }

    if (path === '/api/hk/admin/policy/category-rules') {
      return json({ items: await policyRows('category_rules') })
    }

    if (path === '/api/hk/admin/policy/living-allowance') {
      return json({ items: await policyRows('living_allowance') })
    }

    if (path === '/api/hk/admin/policy/academic-year') {
      return json({ items: await policyRows('academic_year') })
    }

    const applications = await pb.collection('hk_applications').getList(1, 50, {
      sort: '-created',
    })

    if (path === '/api/hk/admin/funding/disbursement-plans') {
      const items = applications.items.flatMap((app) => {
        const payments = app.payments_json
        return Array.isArray(payments) ? payments : []
      })
      return json({ items, totalItems: items.length })
    }

    if (path === '/api/hk/admin/funding/rewards') {
      const items = applications.items.flatMap((app) => {
        const funding = app.funding_json
        if (
          typeof funding === 'object' &&
          funding !== null &&
          'rewards' in funding &&
          Array.isArray((funding as { rewards?: unknown }).rewards)
        ) {
          return (funding as { rewards: unknown[] }).rewards
        }
        return []
      })
      return json({ items, totalItems: items.length })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '讀取政策資料失敗'
    return json({ error: 'pb_error', message }, { status: 502 })
  }

  return null
}
