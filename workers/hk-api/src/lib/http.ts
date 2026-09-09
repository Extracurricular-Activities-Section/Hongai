/**
 * PocketBase access from Cloudflare Workers.
 * Runtime MUST use hk_service_accounts (or interim staff service user) — never Superuser.
 */

const HK_PREFIX = 'hk_'

export type WorkerEnv = {
  HK_POCKETBASE_URL: string
  HK_STUDENT_APP_URL: string
  HK_MANAGE_APP_URL: string
  HK_PB_SERVICE_EMAIL?: string
  HK_PB_SERVICE_PASSWORD?: string
  HK_SCHEDULER_SECRET?: string
}

/** Refuse any collection that is not under the hk_ namespace. */
export function assertHkCollection(name: string): string {
  if (typeof name !== 'string' || !name.startsWith(HK_PREFIX)) {
    throw new Error(`Refusing non-hk_ collection: ${name}`)
  }
  // Defense in depth: never touch shared host collections even by typo.
  const forbidden = new Set(['students', 'users', 'teachers', '_superusers', 'superusers'])
  if (forbidden.has(name) || forbidden.has(name.replace(HK_PREFIX, ''))) {
    throw new Error(`Refusing forbidden collection: ${name}`)
  }
  return name
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function corsHeaders(env: WorkerEnv, request: Request): Headers {
  const origin = request.headers.get('Origin') || ''
  const allowed = new Set(
    [env.HK_STUDENT_APP_URL, env.HK_MANAGE_APP_URL].map((u) => u.replace(/\/$/, '')),
  )
  const headers = new Headers()
  if (origin && allowed.has(origin.replace(/\/$/, ''))) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-HK-Scheduler-Secret',
    )
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  }
  return headers
}

export function withCors(env: WorkerEnv, request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  corsHeaders(env, request).forEach((value, key) => headers.set(key, value))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
