import type {
  FieldType,
  FormFieldSchema,
  FormRule,
  FormSchema,
  FormSectionSchema,
  FormVersionStatus,
} from '@/features/forms/types'

export type BuilderSelection =
  | { type: 'section'; sectionId: string }
  | { type: 'field'; sectionId: string; fieldId: string }
  | null

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface BuilderDocument {
  sections: FormSectionSchema[]
  rules: FormRule[]
}

export interface FormBuilderMeta {
  formId: string
  formName: string
  categoryCode: string | null
  categoryName: string | null
  versionId: string
  versionNumber: number
  status: FormVersionStatus
}

export interface FormBuilderSession {
  meta: FormBuilderMeta
  document: BuilderDocument
}

export interface FormVersionSummary {
  id: string
  version_number: number
  status: FormVersionStatus
  published_at: string | null
  notes: string | null
  created: string
  updated: string
}

export interface PaletteItem {
  field_type: FieldType
  label: string
  description: string
}

export type BuilderHistoryEntry = BuilderDocument

export function schemaToDocument(schema: FormSchema): BuilderDocument {
  return {
    sections: structuredClone(schema.sections),
    rules: structuredClone(schema.rules),
  }
}

export function documentToSchema(meta: FormBuilderMeta, document: BuilderDocument): FormSchema {
  return {
    form: {
      id: meta.formId,
      name: meta.formName,
      description: null,
      category_id: '',
      category_code: meta.categoryCode || '',
      category_name: meta.categoryName || '',
    },
    version: {
      id: meta.versionId,
      version_number: meta.versionNumber,
      status: meta.status,
    },
    sections: document.sections,
    rules: document.rules,
  }
}

export function findField(
  document: BuilderDocument,
  fieldId: string,
): { section: FormSectionSchema; field: FormFieldSchema; sectionIndex: number; fieldIndex: number } | null {
  for (let sectionIndex = 0; sectionIndex < document.sections.length; sectionIndex += 1) {
    const section = document.sections[sectionIndex]
    const fieldIndex = section.fields.findIndex((field) => field.id === fieldId)
    if (fieldIndex >= 0) {
      return { section, field: section.fields[fieldIndex], sectionIndex, fieldIndex }
    }
  }
  return null
}

export function cloneDocument(document: BuilderDocument): BuilderDocument {
  return structuredClone(document)
}
