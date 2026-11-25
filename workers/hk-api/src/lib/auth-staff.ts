import PocketBase from 'pocketbase'

import { staffTokenIsRevoked, tokenFingerprint } from './auth-revoke'
import { assertHkCollection, json, type WorkerEnv } from './http'

export type StaffAuthContext = {
  id: string
  email: string
  is_admin: boolean
  is_staff: boolean
  can_manage_forms?: boolean
  can_publish_forms?: boolean
  /** Optional; unset = interim default (staff may decide). See staffMayDecideFunding. */
  can_decide_funding?: boolean | null
  permissions_json?: Record<string, unknown> | null
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
    return json({ error: 'misconfigured', message: '系統服務未設定，請聯絡承辦。' }, { status: 500 })
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
      can_decide_funding?: boolean | null
      permissions_json?: Record<string, unknown> | null
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

    // FIX-14: reject JWTs revoked by /api/hk/auth/staff/logout.
    const fingerprint = await tokenFingerprint(token)
    if (staffTokenIsRevoked(record as Record<string, unknown>, fingerprint)) {
      return json({ error: 'unauthorized', message: '職員登入已失效' }, { status: 401 })
    }

    return {
      id: record.id,
      email: record.email,
      is_admin: isAdmin,
      is_staff: isStaff,
      can_manage_forms: record.can_manage_forms,
      can_publish_forms: record.can_publish_forms,
      can_decide_funding:
        typeof record.can_decide_funding === 'boolean' ? record.can_decide_funding : null,
      permissions_json: record.permissions_json ?? null,
      token: result.token || token,
    }
  } catch {
    return json({ error: 'unauthorized', message: '職員登入已失效' }, { status: 401 })
  }
}
