import PocketBase from 'pocketbase'

import { assertHkCollection, json, type WorkerEnv } from './http'

export type StaffAuthContext = {
  id: string
  email: string
  is_admin: boolean
  is_staff: boolean
  can_manage_forms?: boolean
  can_publish_forms?: boolean
  token: string
}

function bearerToken(request: Request): string | null {
  // PocketBase JS SDK sends the raw token; hk-client prefixes "Bearer ".
  const header = request.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

/** Validate staff session via PocketBase authRefresh — no Superuser. */
export async function requireStaff(
  request: Request,
  env: WorkerEnv,
  opts: { adminOnly?: boolean } = {},
): Promise<StaffAuthContext | Response> {
  const token = bearerToken(request)
  if (!token) {
    return json({ error: 'unauthorized', message: '缺少職員登入憑證' }, { status: 401 })
  }

  const url = env.HK_POCKETBASE_URL
  if (!url) {
    return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
  }

  const pb = new PocketBase(url)
  pb.autoCancellation(false)
  pb.authStore.save(token, null)

  try {
    const result = await pb.collection(assertHkCollection('hk_staff_users')).authRefresh<{
      id: string
      email: string
      active?: boolean
      is_admin?: boolean
      is_staff?: boolean
      role?: string
      can_manage_forms?: boolean
      can_publish_forms?: boolean
    }>()
    const record = result.record
    const isAdmin =
      Boolean(record.is_admin) || record.role === 'admin' || record.role === 'super_admin'
    const isStaff = Boolean(record.is_staff) || isAdmin || record.role === 'staff'

    if (!record.active || (!isStaff && !isAdmin)) {
      return json({ error: 'forbidden', message: '帳號無權限或未啟用' }, { status: 403 })
    }
    if (opts.adminOnly && !isAdmin) {
      return json({ error: 'forbidden', message: '需要管理員權限' }, { status: 403 })
    }

    return {
      id: record.id,
      email: record.email,
      is_admin: isAdmin,
      is_staff: isStaff,
      can_manage_forms: record.can_manage_forms,
      can_publish_forms: record.can_publish_forms,
      token: result.token || token,
    }
  } catch {
    return json({ error: 'unauthorized', message: '職員登入已失效' }, { status: 401 })
  }
}
