import { requireStaff } from '../lib/auth-staff'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

/**
 * FAQ CMS-backed endpoints.
 * GET  /api/hk/faq?audience=student|staff|both  (public published only)
 * GET  /api/hk/admin/faq                       (staff — all)
 * POST /api/hk/admin/faq                       (admin — upsert)
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
        message: 'FAQ 服務尚未就緒（需 service account 與 hk_faq_articles）。',
      })
    }

    try {
      const filter =
        audience === 'staff'
          ? 'published = true && (audience = "staff" || audience = "both")'
          : 'published = true && (audience = "student" || audience = "both")'
      const items = await pb.collection('hk_faq_articles').getFullList({
        filter,
        sort: 'sort_order',
        fields: 'id,slug,title,body,audience,sort_order,published,updated',
      })
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
        const items = await pb.collection('hk_faq_articles').getFullList({ sort: 'sort_order' })
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
      let body: {
        id?: string
        slug?: string
        title?: string
        body?: string
        audience?: string
        sort_order?: number
        published?: boolean
        updated_note?: string
      }
      try {
        body = (await request.json()) as typeof body
      } catch {
        return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
      }
      if (!body.slug?.trim() || !body.title?.trim() || !body.body?.trim()) {
        return json({ error: 'bad_request', message: 'slug / title / body 必填' }, { status: 400 })
      }
      const payload = {
        slug: body.slug.trim(),
        title: body.title.trim(),
        body: body.body,
        audience: body.audience || 'both',
        sort_order: Number(body.sort_order) || 0,
        published: Boolean(body.published),
        updated_note: body.updated_note || '',
      }
      try {
        const item = body.id
          ? await pb.collection('hk_faq_articles').update(body.id, payload)
          : await pb.collection('hk_faq_articles').create(payload)
        return json({ item })
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
