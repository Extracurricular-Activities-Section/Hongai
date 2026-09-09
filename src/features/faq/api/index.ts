import { hkApiSend } from '@/lib/api/hk-client'
import { staffPb } from '@/lib/pocketbase'

export type FaqArticle = {
  id: string
  slug: string
  title: string
  body: string
  audience: 'student' | 'staff' | 'both'
  sort_order?: number
  published?: boolean
  updated_note?: string
}

export async function listPublicFaq(audience: 'student' | 'staff' = 'student'): Promise<{
  items: FaqArticle[]
  source?: string
  message?: string
}> {
  return hkApiSend('/api/hk/faq', {
    method: 'GET',
    query: { audience },
  })
}

export async function adminListFaq(): Promise<FaqArticle[]> {
  const data = await hkApiSend<{ items: FaqArticle[] }>('/api/hk/admin/faq', {
    method: 'GET',
    token: staffPb.authStore.token || null,
  })
  return data.items ?? []
}

export async function adminSaveFaq(input: Partial<FaqArticle> & {
  slug: string
  title: string
  body: string
}): Promise<FaqArticle> {
  const data = await hkApiSend<{ item: FaqArticle }>('/api/hk/admin/faq', {
    method: 'POST',
    token: staffPb.authStore.token || null,
    body: input,
  })
  return data.item
}
