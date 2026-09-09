import type { FieldType } from '@/features/forms/types'
import type { BuilderDocument } from '../types'

const TYPE_PREFIX: Record<FieldType, string> = {
  text: 'text',
  textarea: 'textarea',
  number: 'number',
  currency: 'amount',
  date: 'date',
  date_range: 'daterange',
  select: 'select',
  radio: 'radio',
  checkbox: 'check',
  multiselect: 'multi',
  repeat_group: 'group',
  monthly_plan: 'monthly',
  computed: 'computed',
  display: 'display',
  url: 'url',
  email: 'email',
  file: 'file',
}

export function slugifyCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 64)
}

export function collectUsedCodes(document: BuilderDocument): Set<string> {
  const used = new Set<string>()
  for (const section of document.sections) {
    used.add(section.code)
    for (const field of section.fields) used.add(field.code)
  }
  return used
}

export function generateUniqueCode(
  base: string,
  used: Set<string>,
  fallbackPrefix = 'field',
): string {
  let root = slugifyCode(base) || fallbackPrefix
  if (!/^[a-z]/.test(root)) root = `${fallbackPrefix}_${root}`
  if (!used.has(root)) return root
  let index = 2
  while (used.has(`${root}_${index}`)) index += 1
  return `${root}_${index}`
}

export function generateFieldCode(fieldType: FieldType, used: Set<string>): string {
  return generateUniqueCode(TYPE_PREFIX[fieldType] || 'field', used, 'field')
}

export function generateSectionCode(used: Set<string>): string {
  return generateUniqueCode('section', used, 'section')
}

export function generateClientId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}
