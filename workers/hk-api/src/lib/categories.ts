import type PocketBase from 'pocketbase'

/** Nine stable application categories (docs/MASTER-REQUIREMENTS.md §6). Codes are immutable. */
export const CATEGORY_SEED = [
  { code: 'academic_learning', name: '課業學習' },
  { code: 'professional_certification', name: '專業證照' },
  { code: 'career_enhancement', name: '就業增能' },
  { code: 'external_competition', name: '校外競賽' },
  { code: 'language_certification', name: '外語檢定' },
  { code: 'common_competency', name: '共通職能' },
  { code: 'cross_domain_learning', name: '跨域學習' },
  { code: 'overseas_study', name: '海外研修' },
  { code: 'other', name: '其他' },
] as const

export function categoryKey(code: string): string {
  return `category:${code}`
}

export function categoryFromSetting(record: Record<string, unknown>) {
  const value = (record.value_json && typeof record.value_json === 'object'
    ? record.value_json
    : {}) as Record<string, unknown>
  return {
    id: String(record.id || ''),
    code: String(value.code || ''),
    name: String(value.name || ''),
    description: value.description ? String(value.description) : null,
    active: Boolean(record.active),
    sort_order: Number(value.sort_order) || 0,
    allow_copy_previous: Boolean(value.allow_copy_previous),
    created: String(record.created || ''),
    updated: String(record.updated || ''),
  }
}

/** Create any of the nine categories that are missing; existing rows are left untouched. */
export async function ensureCategorySeed(pb: PocketBase): Promise<Record<string, unknown>[]> {
  const rows = (await pb.collection('hk_settings').getFullList({
    filter: 'setting_type = "category"',
  })) as Record<string, unknown>[]
  const existing = new Set(rows.map((row) => String(row.key)))
  for (const [index, seed] of CATEGORY_SEED.entries()) {
    if (existing.has(categoryKey(seed.code))) continue
    const created = await pb.collection('hk_settings').create({
      key: categoryKey(seed.code),
      setting_type: 'category',
      value_json: {
        code: seed.code,
        name: seed.name,
        description: '',
        sort_order: index + 1,
        allow_copy_previous: true,
      },
      version: 1,
      status: 'active',
      active: true,
    })
    rows.push(created as Record<string, unknown>)
  }
  return rows
}
