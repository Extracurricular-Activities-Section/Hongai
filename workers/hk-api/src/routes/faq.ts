import { requireStaff } from '../lib/auth-staff'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

type FaqArticle = {
  id?: string
  slug: string
  title: string
  body: string
  audience: 'student' | 'staff' | 'both' | string
  sort_order: number
  published: boolean
  updated_note?: string
}

function settingKey(slug: string): string {
  return `faq:${slug}`
}

function articleFromSetting(record: Record<string, unknown>): FaqArticle | null {
  const value = record.value_json
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<FaqArticle>
  if (!item.slug || !item.title || !item.body) return null
  return {
    id: String(record.id || ''),
    slug: item.slug,
    title: item.title,
    body: item.body,
    audience: item.audience || 'both',
    sort_order: Number(item.sort_order || 0),
    published: Boolean(item.published),
    updated_note: item.updated_note,
  }
}

/**
 * FAQ endpoints backed by hk_settings rows with setting_type="faq".
 */
export async function handleFaq(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path === '/api/hk/faq' && request.method === 'GET') {
    const url = new URL(request.url)
    const audience = url.searchParams.get('audience') || 'student'

    let pb
    try {
      pb = await createServicePb(env)
    } catch {
      return json({
        items: [],
        source: 'unavailable',
        message: 'FAQ 服務尚未就緒（需 service account 與 hk_settings）。',
      })
    }

    try {
      const rows = await pb.collection('hk_settings').getFullList({
        filter: 'setting_type = "faq" && active = true',
        sort: 'key',
      })
      const items = rows
        .map((row) => articleFromSetting(row as Record<string, unknown>))
        .filter((item): item is FaqArticle => {
          if (!item?.published) return false
          return audience === 'staff'
            ? item.audience === 'staff' || item.audience === 'both'
            : item.audience === 'student' || item.audience === 'both'
        })
        .sort((a, b) => a.sort_order - b.sort_order)
      return json({ items, source: 'pocketbase' })
    } catch (err) {
      return json(
        {
          items: [],
          source: 'error',
          message: err instanceof Error ? err.message : 'FAQ 讀取失敗',
        },
        { status: 502 },
      )
    }
  }

  if (path === '/api/hk/admin/faq') {
    const staff = await requireStaff(request, env)
    if (staff instanceof Response) return staff

    let pb
    try {
      pb = await createServicePb(env)
    } catch (err) {
      return json(
        {
          error: 'service_account_required',
          message: err instanceof Error ? err.message : 'Service account required',
        },
        { status: 503 },
      )
    }

    if (request.method === 'GET') {
      try {
        const rows = await pb.collection('hk_settings').getFullList({
          filter: 'setting_type = "faq"',
          sort: 'key',
        })
        const items = rows
          .map((row) => articleFromSetting(row as Record<string, unknown>))
          .filter((item): item is FaqArticle => Boolean(item))
          .sort((a, b) => a.sort_order - b.sort_order)
        return json({ items })
      } catch (err) {
        return json(
          { error: 'pb_error', message: err instanceof Error ? err.message : '讀取失敗' },
          { status: 502 },
        )
      }
    }

    if (request.method === 'POST') {
      if (!staff.is_admin) {
        return json({ error: 'forbidden', message: '需要管理員權限' }, { status: 403 })
      }

      const body = (await request.json().catch(() => null)) as Partial<FaqArticle> | null
      if (!body?.slug?.trim() || !body.title?.trim() || !body.body?.trim()) {
        return json({ error: 'bad_request', message: 'slug / title / body 必填' }, { status: 400 })
      }

      const article: FaqArticle = {
        slug: body.slug.trim(),
        title: body.title.trim(),
        body: body.body,
        audience: body.audience || 'both',
        sort_order: Number(body.sort_order) || 0,
        published: Boolean(body.published),
        updated_note: body.updated_note || '',
      }

      try {
        const payload = {
          key: settingKey(article.slug),
          setting_type: 'faq',
          value_json: article,
          version: 1,
          status: article.published ? 'active' : 'draft',
          active: true,
          updated_by: staff.id,
        }
        const item = body.id
          ? await pb.collection('hk_settings').update(body.id, payload)
          : await pb.collection('hk_settings').create(payload)
        return json({ item: articleFromSetting(item as Record<string, unknown>) || article })
      } catch (err) {
        return json(
          { error: 'pb_error', message: err instanceof Error ? err.message : '儲存失敗' },
          { status: 502 },
        )
      }
    }
  }

  return null
}
