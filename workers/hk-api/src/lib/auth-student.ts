import { json, type WorkerEnv } from './http'

export type StudentRecord = Record<string, unknown> & { id: string }

function studentToken(request: Request): string | null {
  // PocketBase JS SDK sends the raw token; other clients may prefix "Bearer ".
  const header = request.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

/** Validate a student session via hk_students auth-refresh — no Superuser. */
export async function requireStudent(
  request: Request,
  env: WorkerEnv,
): Promise<StudentRecord | Response> {
  const token = studentToken(request)
  if (!token) return json({ error: 'unauthorized', message: '請先登入' }, { status: 401 })

  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
  }

  const upstream = await fetch(`${base}/api/collections/hk_students/auth-refresh`, {
    method: 'POST',
    headers: { authorization: token },
  })
  const data = (await upstream.json().catch(() => null)) as { record?: StudentRecord } | null
  if (!upstream.ok || !data?.record?.id) {
    return json({ error: 'unauthorized', message: '請重新登入' }, { status: 401 })
  }
  return data.record
}
