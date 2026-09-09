/**
 * Student Auth Gateway — must become CF-native.
 *
 * CURRENT: may still proxy to PocketBase `/api/hk/auth/*` (legacy hooks).
 * That path is INVALID on a PocketBase host with no business hooks.
 * TODO: internalize register/login/logout + lockout against hk_students data API.
 *
 * Never log identity_last4, passwords, full identity numbers, or tokens.
 */

import { json, type WorkerEnv } from '../lib/http'

async function proxyAuth(env: WorkerEnv, request: Request, pbPath: string): Promise<Response> {
  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
  }

  const incoming = await request.text()
  const upstream = await fetch(`${base}${pbPath}`, {
    method: request.method,
    headers: {
      'content-type': request.headers.get('content-type') || 'application/json',
      // Forward client auth if present (logout / refresh patterns).
      ...(request.headers.get('authorization')
        ? { authorization: request.headers.get('authorization')! }
        : {}),
    },
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : incoming,
  })

  const text = await upstream.text()
  const headers = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) headers.set('content-type', ct)

  return new Response(text, { status: upstream.status, headers })
}

export async function handleStudentAuth(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path === '/api/hk/auth/login' && request.method === 'POST') {
    return proxyAuth(env, request, '/api/hk/auth/login')
  }
  if (path === '/api/hk/auth/register' && request.method === 'POST') {
    return proxyAuth(env, request, '/api/hk/auth/register')
  }
  if (path === '/api/hk/auth/logout' && request.method === 'POST') {
    return proxyAuth(env, request, '/api/hk/auth/logout')
  }
  return null
}
