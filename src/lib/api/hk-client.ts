/**
 * Browser -> Cloudflare HK API.
 * /api/hk/* must not fall back to the PocketBase host.
 */

function trimSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export function getHkApiBaseUrl(): string {
  const hk = import.meta.env.VITE_HK_API_BASE_URL as string | undefined
  const base = hk && hk.trim()
  if (!base) {
    throw new Error(
      'VITE_HK_API_BASE_URL must be set for /api/hk/* (see .env.example).',
    )
  }
  return trimSlash(base)
}

export function isHkApiViaCloudflare(): boolean {
  return Boolean(import.meta.env.VITE_HK_API_BASE_URL?.trim())
}

export async function hkApiSend<T>(
  path: string,
  init: {
    method?: string
    body?: unknown
    token?: string | null
    query?: Record<string, string | undefined>
  } = {},
): Promise<T> {
  const url = new URL(getHkApiBaseUrl() + (path.startsWith('/') ? path : `/${path}`))
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v != null && v !== '') url.searchParams.set(k, v)
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init.token) headers.Authorization = `Bearer ${init.token}`

  const res = await fetch(url.toString(), {
    method: init.method || 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'include',
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `請求失敗（${res.status}）`
    throw new Error(message)
  }

  return data as T
}
