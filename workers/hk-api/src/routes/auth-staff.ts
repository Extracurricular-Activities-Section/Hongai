/**
 * Staff Auth Gateway — progressive port.
 * Proxies PocketBase collection auth (hk_staff_users) so manage login can
 * eventually hit Cloudflare only. No Superuser. Never log passwords.
 */

import { json, type WorkerEnv } from '../lib/http'

type StaffLoginBody = {
  email?: string
  password?: string
}

export async function handleStaffAuth(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path !== '/api/hk/auth/staff/login' || request.method !== 'POST') {
    return null
  }

  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
  }

  let body: StaffLoginBody
  try {
    body = (await request.json()) as StaffLoginBody
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.email || !body.password) {
    return json({ error: 'bad_request', message: '電子郵件與密碼為必填' }, { status: 400 })
  }

  const upstream = await fetch(`${base}/api/collections/hk_staff_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: body.email, password: body.password }),
  })

  const text = await upstream.text()
  const headers = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  return new Response(text, { status: upstream.status, headers })
}
