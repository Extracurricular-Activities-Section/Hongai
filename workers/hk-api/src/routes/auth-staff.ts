/**
 * Staff Auth Gateway — progressive port.
 * Proxies PocketBase collection auth (hk_staff_users) so manage login can
 * eventually hit Cloudflare only. No Superuser. Never log passwords.
 */

import { revokeCollectionSession } from '../lib/auth-revoke'
import { json, type WorkerEnv } from '../lib/http'
import { publicErrorMessage } from '../lib/public-error'

type StaffLoginBody = {
  email?: string
  password?: string
}

type Row = Record<string, unknown>

const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

/** Strip auth secrets and logout denylist from staff login payloads. */
function publicStaffRecord(record: Row): Row {
  const {
    password,
    tokenKey,
    expand,
    collectionId,
    collectionName,
    ...safe
  } = record
  void password
  void tokenKey
  void expand
  void collectionId
  void collectionName
  const permissions = obj(safe.permissions_json)
  if ('revoked_token_fps' in permissions) {
    const { revoked_token_fps: _revoked, ...rest } = permissions
    void _revoked
    safe.permissions_json = rest
  }
  if (typeof record.can_decide_funding === 'boolean') {
    safe.can_decide_funding = record.can_decide_funding
  }
  return safe
}

export async function handleStaffAuth(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path === '/api/hk/auth/staff/logout' && request.method === 'POST') {
    // FIX-14: revoke this JWT (fingerprint denylist on staff record).
    await revokeCollectionSession(env, 'hk_staff_users', request.headers.get('authorization'))
    return json({ success: true })
  }

  if (path !== '/api/hk/auth/staff/login' || request.method !== 'POST') {
    return null
  }

  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: '系統服務未設定，請聯絡承辦。' }, { status: 500 })
  }

  let body: StaffLoginBody
  try {
    body = (await request.json()) as StaffLoginBody
  } catch {
    return json({ error: 'bad_request', message: '請求格式錯誤。' }, { status: 400 })
  }

  if (!body.email || !body.password) {
    return json({ error: 'bad_request', message: '電子郵件與密碼為必填' }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${base}/api/collections/hk_staff_users/auth-with-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: body.email, password: body.password }),
    })
    const data = (await upstream.json().catch(() => null)) as {
      token?: string
      record?: Row
    } | null
    if (!upstream.ok || !data?.token || !data.record) {
      return json(
        { error: 'unauthorized', message: '登入失敗，請確認資料後再試。' },
        { status: upstream.status === 400 ? 400 : 401 },
      )
    }
    return json({
      token: data.token,
      record: publicStaffRecord(data.record),
    })
  } catch (err) {
    return json(
      {
        error: 'login_failed',
        message: publicErrorMessage('登入失敗，請稍後再試。', err),
      },
      { status: 502 },
    )
  }
}
