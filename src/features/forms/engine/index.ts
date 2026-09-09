import type {
  ComputedFieldConfig,
  EvaluatedFieldState,
  FormFieldSchema,
  FormFieldValue,
  FormIssue,
  FormRule,
  FormSchema,
  FormValues,
  MonthlyPlanValue,
  RepeatGroupConfig,
  RepeatGroupValue,
} from '../types'

function isEmpty(value: FormFieldValue): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'boolean') return false
  if (typeof value === 'number') return Number.isNaN(value)
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    return Object.values(value).every((item) => item == null || String(item).trim() === '')
  }
  return false
}

function asBool(value: FormFieldValue): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function matchRule(operator: FormRule['operator'], source: FormFieldValue, expected: unknown): boolean {
  switch (operator) {
    case 'is_empty':
      return isEmpty(source)
    case 'is_not_empty':
      return !isEmpty(source)
    case 'is_true':
      return asBool(source) === true
    case 'is_false':
      return asBool(source) === false
    case 'equals': {
      if (typeof expected === 'boolean') return asBool(source) === expected
      return String(source ?? '') === String(expected ?? '')
    }
    case 'not_equals': {
      if (typeof expected === 'boolean') return asBool(source) !== expected
      return String(source ?? '') !== String(expected ?? '')
    }
    case 'contains': {
      if (Array.isArray(source)) return source.map(String).includes(String(expected))
      return String(source ?? '').includes(String(expected ?? ''))
    }
    case 'not_contains': {
      if (Array.isArray(source)) return !source.map(String).includes(String(expected))
      return !String(source ?? '').includes(String(expected ?? ''))
    }
    default:
      return false
  }
}

export function listFields(schema: FormSchema): FormFieldSchema[] {
  return schema.sections.flatMap((section) => section.fields.filter((field) => field.active))
}

export function buildInitialValues(schema: FormSchema, answers?: FormValues): FormValues {
  const values: FormValues = {}
  for (const field of listFields(schema)) {
    if (answers && field.code in answers) {
      values[field.code] = answers[field.code]
      continue
    }
    if (field.default_value != null) {
      values[field.code] = field.default_value as FormFieldValue
      continue
    }
    if (field.field_type === 'checkbox') values[field.code] = false
    else if (field.field_type === 'multiselect') values[field.code] = []
    else if (field.field_type === 'repeat_group') values[field.code] = []
    else if (field.field_type === 'monthly_plan') {
      const months = (field.config as { months?: number[] } | null)?.months || []
      const plan: MonthlyPlanValue = {}
      for (const month of months) plan[String(month)] = ''
      values[field.code] = plan
    } else if (field.field_type === 'number' || field.field_type === 'currency') {
      values[field.code] = null
    } else {
      values[field.code] = ''
    }
  }
  return calculateComputedFields(schema, values)
}

export function evaluateRules(
  schema: FormSchema,
  values: FormValues,
): Record<string, EvaluatedFieldState> {
  const state: Record<string, EvaluatedFieldState> = {}
  for (const field of listFields(schema)) {
    state[field.code] = { visible: true, required: field.required }
  }

  const sorted = [...schema.rules].sort((a, b) => a.sort_order - b.sort_order)
  for (const rule of sorted) {
    const fieldState = state[rule.field_code]
    if (!fieldState) continue
    const matched = matchRule(rule.operator, values[rule.source_field_code], rule.value)
    if (rule.rule_type === 'show_if') {
      fieldState.visible = matched
      if (!matched) fieldState.required = false
    } else if (rule.rule_type === 'hide_if') {
      fieldState.visible = !matched
      if (matched) fieldState.required = false
    } else if (rule.rule_type === 'require_if' && matched && fieldState.visible) {
      fieldState.required = true
    }
  }
  return state
}

function parseDateMs(value: FormFieldValue): number {
  if (!value) return NaN
  return Date.parse(String(value))
}

function monthsBetween(startMs: number, endMs: number): number {
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 0
  const start = new Date(startMs)
  const end = new Date(endMs)
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 0 : -1)
  )
}

function resolveSumPart(values: FormValues, token: string): number {
  if (token.includes('.')) {
    const [groupCode, amountCode] = token.split('.')
    const rows = values[groupCode]
    if (!Array.isArray(rows)) return 0
    return rows.reduce((sum, row) => {
      const amount = Number((row as Record<string, unknown>)[amountCode] ?? 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)
  }
  const raw = values[token]
  const num = Number(raw ?? 0)
  return Number.isFinite(num) ? num : 0
}

export function calculateComputedFields(schema: FormSchema, values: FormValues): FormValues {
  const next = { ...values }
  for (const field of listFields(schema)) {
    if (field.field_type !== 'computed') continue
    const config = field.config as ComputedFieldConfig | null
    if (!config || !config.operation) {
      next[field.code] = null
      continue
    }
    if (config.operation === 'sum') {
      const parts = config.fields || []
      next[field.code] = parts.reduce((sum, token) => sum + resolveSumPart(next, token), 0)
    } else if (config.operation === 'date_diff_days') {
      const start = parseDateMs(next[config.start || ''])
      const end = parseDateMs(next[config.end || ''])
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) next[field.code] = null
      else next[field.code] = Math.floor((end - start) / 86400000) + 1
    } else if (config.operation === 'date_diff_months') {
      const start = parseDateMs(next[config.start || ''])
      const end = parseDateMs(next[config.end || ''])
      next[field.code] = monthsBetween(start, end)
    }
  }
  return next
}

function validateFieldType(
  field: FormFieldSchema,
  value: FormFieldValue,
  mode: 'draft' | 'complete',
): FormIssue[] {
  const issues: FormIssue[] = []
  if (field.field_type === 'file') return issues
  if (field.field_type === 'display' || field.field_type === 'computed') return issues

  if (field.field_type === 'url' && !isEmpty(value)) {
    try {
      new URL(String(value))
    } catch {
      issues.push({
        code: 'invalid_url',
        field_code: field.code,
        severity: 'error',
        message: `${field.label} 網址格式無效`,
      })
    }
  }

  if (field.field_type === 'email' && !isEmpty(value)) {
    if (!String(value).includes('@')) {
      issues.push({
        code: 'invalid_email',
        field_code: field.code,
        severity: 'error',
        message: `${field.label} Email 格式無效`,
      })
    }
  }

  if ((field.field_type === 'number' || field.field_type === 'currency') && !isEmpty(value)) {
    if (!Number.isFinite(Number(value))) {
      issues.push({
        code: 'invalid_number',
        field_code: field.code,
        severity: 'error',
        message: `${field.label} 必須為數字`,
      })
    }
  }

  if (field.field_type === 'repeat_group' && Array.isArray(value)) {
    const config = field.config as RepeatGroupConfig
    const max = config?.max_rows ?? 50
    if (value.length > max) {
      issues.push({
        code: 'repeat_max',
        field_code: field.code,
        severity: 'error',
        message: `${field.label} 超過最大列數`,
      })
    }
    if (mode === 'complete') {
      for (const [index, row] of value.entries()) {
        for (const col of config?.columns || []) {
          if (col.required && isEmpty((row as Record<string, FormFieldValue>)[col.code] as FormFieldValue)) {
            issues.push({
              code: 'repeat_required',
              field_code: field.code,
              severity: 'error',
              message: `${field.label} 第 ${index + 1} 列「${col.label}」必填`,
            })
          }
        }
      }
    }
  }

  return issues
}

export function validateFormValues(
  schema: FormSchema,
  values: FormValues,
  mode: 'draft' | 'complete',
): FormIssue[] {
  const computed = calculateComputedFields(schema, values)
  const fieldState = evaluateRules(schema, computed)
  const issues: FormIssue[] = []

  // Date pair checks
  const pairs = [
    ['training_start', 'training_end'],
    ['execution_start', 'execution_end'],
    ['departure_date', 'return_date'],
    ['term_start', 'term_end'],
  ]
  for (const [startCode, endCode] of pairs) {
    if (!(startCode in computed) || !(endCode in computed)) continue
    const start = parseDateMs(computed[startCode])
    const end = parseDateMs(computed[endCode])
    if (!Number.isNaN(start) && !Number.isNaN(end) && start > end) {
      issues.push({
        code: 'date_range',
        field_code: endCode,
        severity: 'error',
        message: '結束日期不可早於開始日期',
      })
    }
  }

  for (const field of listFields(schema)) {
    const state = fieldState[field.code]
    if (!state?.visible) continue
    const value = computed[field.code]
    issues.push(...validateFieldType(field, value, mode))

    if (mode === 'complete' && state.required && isEmpty(value)) {
      issues.push({
        code: 'required',
        field_code: field.code,
        severity: 'error',
        message: `請填寫「${field.label}」`,
      })
    }

    const warnings = field.validation?.warnings || []
    for (const warning of warnings) {
      if (warning.type === 'min_number' && Number(value ?? 0) < Number(warning.value ?? 0)) {
        issues.push({
          code: 'min_hours_warning',
          field_code: field.code,
          severity: 'warning',
          message: warning.message,
        })
      }
    }
  }

  return issues
}

export function serializeAnswers(values: FormValues): FormValues {
  return JSON.parse(JSON.stringify(values)) as FormValues
}

export function deserializeAnswers(raw: Record<string, unknown>): FormValues {
  return { ...(raw as FormValues) }
}

function canCopyType(from: string, to: string): boolean {
  if (from === to) return true
  const textLike = new Set(['text', 'textarea', 'email', 'url', 'select', 'radio'])
  if (textLike.has(from) && textLike.has(to)) return true
  if ((from === 'number' || from === 'currency') && (to === 'number' || to === 'currency')) {
    return true
  }
  return false
}

export function copySubmissionAnswers(
  sourceSchema: FormSchema,
  sourceAnswers: FormValues,
  targetSchema: FormSchema,
): FormValues {
  const sourceFields = Object.fromEntries(listFields(sourceSchema).map((field) => [field.code, field]))
  const result = buildInitialValues(targetSchema)
  for (const field of listFields(targetSchema)) {
    if (!field.copy_previous) continue
    if (field.field_type === 'computed' || field.field_type === 'file' || field.field_type === 'display') {
      continue
    }
    const sourceField = sourceFields[field.code]
    if (!sourceField) continue
    if (!canCopyType(sourceField.field_type, field.field_type)) continue
    if (!(field.code in sourceAnswers)) continue
    result[field.code] = sourceAnswers[field.code] as FormFieldValue
  }
  return calculateComputedFields(targetSchema, result)
}

export function flattenAnswersMap(
  answers: Array<{ field_code: string; value: unknown }>,
): FormValues {
  const map: FormValues = {}
  for (const answer of answers) {
    map[answer.field_code] = answer.value as FormFieldValue
  }
  return map
}

export type { RepeatGroupValue, MonthlyPlanValue }
