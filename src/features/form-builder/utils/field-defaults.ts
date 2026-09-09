import type {
  ComputedFieldConfig,
  FieldType,
  FormFieldOption,
  FormFieldSchema,
  FormSectionSchema,
  MonthlyPlanConfig,
  RepeatGroupConfig,
} from '@/features/forms/types'
import type { FileFieldConfig } from '@/features/attachments/types'
import type { PaletteItem } from '../types'
import { generateClientId, generateFieldCode, generateSectionCode, collectUsedCodes } from './code'
import type { BuilderDocument } from '../types'

export const PALETTE_ITEMS: PaletteItem[] = [
  { field_type: 'text', label: '單行文字', description: '短文字輸入' },
  { field_type: 'textarea', label: '多行文字', description: '長文說明' },
  { field_type: 'number', label: '數字', description: '數值輸入' },
  { field_type: 'currency', label: '金額', description: '金額欄位' },
  { field_type: 'date', label: '日期', description: '單一日期' },
  { field_type: 'email', label: 'Email', description: '電子郵件' },
  { field_type: 'url', label: '網址', description: 'URL 欄位' },
  { field_type: 'select', label: '下拉選單', description: '單選下拉' },
  { field_type: 'radio', label: '單選', description: '單選按鈕' },
  { field_type: 'checkbox', label: '勾選', description: '是/否勾選' },
  { field_type: 'multiselect', label: '多選', description: '多個選項' },
  { field_type: 'repeat_group', label: '重複群組', description: '可新增多列' },
  { field_type: 'monthly_plan', label: '月計畫', description: '各月份文字' },
  { field_type: 'computed', label: '計算欄位', description: '宣告式計算' },
  { field_type: 'display', label: '說明文字', description: '僅顯示說明' },
  { field_type: 'file', label: '檔案上傳', description: '附件欄位' },
]

function defaultOptions(): FormFieldOption[] {
  return [
    {
      id: generateClientId('opt'),
      value: 'option_1',
      label: '選項 1',
      sort_order: 1,
      active: true,
    },
    {
      id: generateClientId('opt'),
      value: 'option_2',
      label: '選項 2',
      sort_order: 2,
      active: true,
    },
  ]
}

function defaultConfig(fieldType: FieldType): FormFieldSchema['config'] {
  if (fieldType === 'computed') {
    const config: ComputedFieldConfig = { operation: 'sum', fields: [] }
    return config
  }
  if (fieldType === 'repeat_group') {
    const config: RepeatGroupConfig = {
      max_rows: 10,
      columns: [
        {
          code: 'item_name',
          label: '項目',
          field_type: 'text',
          required: true,
        },
        {
          code: 'amount',
          label: '金額',
          field_type: 'currency',
          required: false,
        },
      ],
    }
    return config
  }
  if (fieldType === 'monthly_plan') {
    const config: MonthlyPlanConfig = {
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }
    return config
  }
  if (fieldType === 'file') {
    const config: FileFieldConfig = {
      allowed_extensions: ['pdf', 'jpg', 'jpeg', 'png'],
      max_files: 3,
      max_file_size_mb: 10,
    }
    return config as FormFieldSchema['config']
  }
  return null
}

export function createDefaultField(
  fieldType: FieldType,
  document: BuilderDocument,
  label?: string,
): FormFieldSchema {
  const used = collectUsedCodes(document)
  const palette = PALETTE_ITEMS.find((item) => item.field_type === fieldType)
  const code = generateFieldCode(fieldType, used)
  const needsOptions = fieldType === 'select' || fieldType === 'radio' || fieldType === 'multiselect'
  return {
    id: generateClientId('field'),
    code,
    label: label || palette?.label || '新欄位',
    field_type: fieldType,
    help_text: '',
    placeholder: '',
    required: false,
    sort_order: 0,
    default_value: null,
    validation: null,
    config: defaultConfig(fieldType),
    pdf_visible: fieldType !== 'display' && fieldType !== 'file',
    copy_previous: fieldType !== 'file' && fieldType !== 'computed' && fieldType !== 'display',
    active: true,
    options: needsOptions ? defaultOptions() : [],
  }
}

export function createDefaultSection(document: BuilderDocument): FormSectionSchema {
  const used = collectUsedCodes(document)
  const code = generateSectionCode(used)
  return {
    id: generateClientId('section'),
    code,
    title: '新區塊',
    description: '',
    sort_order: document.sections.length + 1,
    visible: true,
    pdf_visible: true,
    fields: [],
  }
}

export function duplicateField(
  field: FormFieldSchema,
  document: BuilderDocument,
): FormFieldSchema {
  const used = collectUsedCodes(document)
  const code = generateFieldCode(field.field_type, used)
  return {
    ...structuredClone(field),
    id: generateClientId('field'),
    code,
    label: `${field.label}（副本）`,
    options: field.options.map((option, index) => ({
      ...option,
      id: generateClientId('opt'),
      sort_order: index + 1,
    })),
  }
}

export function fieldTypeLabel(fieldType: FieldType): string {
  return PALETTE_ITEMS.find((item) => item.field_type === fieldType)?.label || fieldType
}
