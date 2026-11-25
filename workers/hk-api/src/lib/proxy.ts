import { json, type WorkerEnv } from './http'

const ALLOWED_PREFIXES = [
  '/api/collections/',
  '/api/files/',
  '/api/realtime',
]

/**
 * Transitional gateway helper.
 *
 * Cloudflare owns all /api/hk/* business routes. This proxy is only for
 * PocketBase collection/file APIs used during staged migration.
 */
export async function proxyToPocketBase(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: '系統服務未設定，請聯絡承辦。' }, { status: 500 })
  }

  const incoming = new URL(request.url)
  const path = incoming.pathname

  if (!ALLOWED_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p))) {
    return json({ error: 'forbidden', message: 'Path not allowed through gateway' }, { status: 403 })
  }

  // Block accidental Superuser collection access via proxy path guessing.
  if (/\/api\/collections\/_superusers\b/i.test(path)) {
    return json({ error: 'forbidden', message: 'Superuser API is not available' }, { status: 403 })
  }

  // FIX-14: block all hk_* collection access via transitional proxy (read + write).
  // Business traffic must use /api/hk/*. Auth-with-password / auth-refresh remain
  // allowed for staged clients; OPTIONS is left for CORS preflight.
  const method = request.method.toUpperCase()
  if (method !== 'OPTIONS' && /\/api\/collections\/hk_[a-z0-9_]+\b/i.test(path)) {
    const isAuthEndpoint = /\/auth-(with-password|refresh)\/?$/i.test(path)
    if (!isAuthEndpoint) {
      return json(
        {
          error: 'forbidden',
          message: '請改走 /api/hk 業務 API，不可經 proxy 存取 hk_* 集合',
        },
        { status: 403 },
      )
    }
  }

  const target = `${base}${path}${incoming.search}`
  const headers = new Headers()
  const forward = [
    'authorization',
    'content-type',
    'accept',
    'accept-language',
    'x-hk-scheduler-secret',
  ]
  for (const key of forward) {
    const value = request.headers.get(key)
    if (value) headers.set(key, value)
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  const upstream = await fetch(target, init)
  const outHeaders = new Headers()
  const pass = ['content-type', 'content-disposition', 'cache-control']
  for (const key of pass) {
    const value = upstream.headers.get(key)
    if (value) outHeaders.set(key, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  })
}
