import type PocketBase from 'pocketbase'

import type { EngineField, EngineRule } from './form-engine'

type Row = Record<string, unknown>
export type SchemaSection = Row & { id: string; fields: SchemaField[] }
export type SchemaField = EngineField & Row & { id: string; options: Row[] }

const str = (value: unknown): string => (value == null ? '' : String(value))
const nullable = (value: unknown): string | null => (value ? String(value) : null)
const asArray = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

/** Sections / rules stored in an hk_forms version row. */
export function schemaJson(record: Row): { sections: SchemaSection[]; rules: EngineRule[] } {
  const value = (record.schema_json && typeof record.schema_json === 'object'
    ? record.schema_json
    : {}) as Row
  return {
    sections: asArray(value.sections) as SchemaSection[],
    rules: asArray(value.rules) as unknown as EngineRule[],
  }
}

/** FormSchema shape consumed by the frontend; form id is the form_code. */
export function toSchema(record: Row) {
  const { sections, rules } = schemaJson(record)
  return {
    form: {
      id: str(record.form_code),
      name: str(record.name),
      description: nullable(record.description),
      category_id: str(record.category_code),
      category_code: str(record.category_code),
      category_name: str(record.category_name),
    },
    version: {
      id: str(record.id),
      version_number: Number(record.version) || 1,
      status: str(record.status),
    },
    sections,
    rules,
  }
}

export function flattenFields(record: Row): SchemaField[] {
  return schemaJson(record).sections.flatMap((section) => asArray(section.fields) as SchemaField[])
}

/** Currently published form version for a category, or null. */
export async function findPublishedForm(pb: PocketBase, categoryCode: string): Promise<Row | null> {
  const result = await pb.collection('hk_forms').getList(1, 1, {
    filter: pb.filter('category_code = {:code} && status = "published" && active = true', {
      code: categoryCode,
    }),
    sort: '-version',
  })
  return (result.items[0] as Row | undefined) ?? null
}
