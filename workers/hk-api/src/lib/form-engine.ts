/**
 * Server-side form engine (no eval / new Function).
 * Mirrors src/features/forms/engine; ported from legacy pb_hooks/hk_form_engine.js.
 */

export type FormValues = Record<string, unknown>

export type EngineField = {
  code: string
  label: string
  field_type: string
  required?: boolean
  active?: boolean
  copy_previous?: boolean
  config?: Record<string, unknown> | null
}

export type EngineRule = {
  field_code: string
  source_field_code: string
  rule_type: string
  operator: string
  value: unknown
  sort_order?: number
}

export type FormIssue = {
  code: string
  field_code: string
  severity: 'error' | 'warning'
  message: string
}

export function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'boolean') return false
  if (typeof value === 'number') return Number.isNaN(value)
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(
      (v) => v == null || String(v).trim() === '',
    )
  }
  return false
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

const text = (value: unknown): string => (value == null ? '' : String(value))

function matchRule(operator: string, source: unknown, expected: unknown): boolean {
  switch (operator) {
    case 'is_empty':
      return isEmpty(source)
    case 'is_not_empty':
      return !isEmpty(source)
    case 'is_true':
      return asBool(source) === true
    case 'is_false':
      return asBool(source) === false
    case 'equals':
      return typeof expected === 'boolean'
        ? asBool(source) === expected
        : text(source) === text(expected)
    case 'not_equals':
      return typeof expected === 'boolean'
        ? asBool(source) !== expected
        : text(source) !== text(expected)
    case 'contains':
      return Array.isArray(source)
        ? source.map(String).includes(String(expected))
        : text(source).includes(text(expected))
    case 'not_contains':
      return Array.isArray(source)
        ? !source.map(String).includes(String(expected))
        : !text(source).includes(text(expected))
    default:
      return false
  }
}

function parseDateMs(value: unknown): number {
  return value ? Date.parse(String(value)) : Number.NaN
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
    const [group, key] = token.split('.')
    const rows = values[group]
    if (!Array.isArray(rows)) return 0
    return rows.reduce((sum: number, row) => {
      const amount = Number((row as Record<string, unknown>)?.[key] || 0)
      return Number.isNaN(amount) ? sum : sum + amount
    }, 0)
  }
  const num = Number(values[token] || 0)
  return Number.isNaN(num) ? 0 : num
}

export function calculateComputed(fields: EngineField[], values: FormValues): FormValues {
  const next: FormValues = { ...values }
  for (const field of fields) {
    if (field.field_type !== 'computed') continue
    const config = field.config || {}
    if (config.operation === 'sum') {
      const tokens = Array.isArray(config.fields) ? (config.fields as string[]) : []
      next[field.code] = tokens.reduce((total, token) => total + resolveSumPart(next, token), 0)
    } else if (config.operation === 'date_diff_days') {
      const s = parseDateMs(next[String(config.start)])
      const e = parseDateMs(next[String(config.end)])
      next[field.code] =
        Number.isNaN(s) || Number.isNaN(e) || e < s ? null : Math.floor((e - s) / 86400000) + 1
    } else if (config.operation === 'date_diff_months') {
      next[field.code] = monthsBetween(
        parseDateMs(next[String(config.start)]),
        parseDateMs(next[String(config.end)]),
      )
    }
  }
  return next
}

function evaluateRules(fields: EngineField[], rules: EngineRule[], values: FormValues) {
  const state: Record<string, { visible: boolean; required: boolean }> = {}
  for (const field of fields) state[field.code] = { visible: true, required: Boolean(field.required) }
  const sorted = [...rules].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  for (const rule of sorted) {
    const target = state[rule.field_code]
    if (!target) continue
    const matched = matchRule(rule.operator, values[rule.source_field_code], rule.value)
    if (rule.rule_type === 'show_if') {
      target.visible = matched
      if (!matched) target.required = false
    } else if (rule.rule_type === 'hide_if') {
      target.visible = !matched
      if (matched) target.required = false
    } else if (rule.rule_type === 'require_if' && matched && target.visible) {
      target.required = true
    }
  }
  return state
}

const DATE_RANGE_PAIRS: Array<[string, string]> = [
  ['training_start', 'training_end'],
  ['execution_start', 'execution_end'],
  ['departure_date', 'return_date'],
  ['term_start', 'term_end'],
]

export function validateValues(
  fields: EngineField[],
  rules: EngineRule[],
  values: FormValues,
  mode: 'draft' | 'complete',
): { issues: FormIssue[]; values: FormValues } {
  const computed = calculateComputed(fields, values)
  const state = evaluateRules(fields, rules, computed)
  const issues: FormIssue[] = []

  for (const [startCode, endCode] of DATE_RANGE_PAIRS) {
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

  for (const field of fields) {
    if (field.active === false) continue
    const st = state[field.code]
    if (!st?.visible) continue
    const value = computed[field.code]
    if (field.field_type === 'url' && !isEmpty(value) && !/^https?:\/\//i.test(String(value))) {
      issues.push({
        code: 'invalid_url',
        field_code: field.code,
        severity: 'error',
        message: `${field.label} 網址格式無效`,
      })
    }
    if (mode === 'complete' && st.required && isEmpty(value)) {
      issues.push({
        code: 'required',
        field_code: field.code,
        severity: 'error',
        message:
          field.field_type === 'file' ? `請上傳「${field.label}」` : `請填寫「${field.label}」`,
      })
    }
    if (
      mode === 'complete' &&
      field.field_type === 'file' &&
      !isEmpty(value) &&
      !Array.isArray(value)
    ) {
      issues.push({
        code: 'invalid_file',
        field_code: field.code,
        severity: 'error',
        message: `「${field.label}」格式無效（應為附件 ID 陣列）`,
      })
    }
  }
  return { issues, values: computed }
}

const TEXT_LIKE = new Set(['text', 'textarea', 'email', 'url', 'select', 'radio'])
const NUMBER_LIKE = new Set(['number', 'currency'])

function canCopyType(from: string, to: string): boolean {
  if (from === to) return true
  if (TEXT_LIKE.has(from) && TEXT_LIKE.has(to)) return true
  return NUMBER_LIKE.has(from) && NUMBER_LIKE.has(to)
}

export function copyAnswers(
  sourceFields: EngineField[],
  sourceAnswers: FormValues,
  targetFields: EngineField[],
): FormValues {
  const sourceByCode = new Map(sourceFields.map((field) => [field.code, field]))
  const result: FormValues = {}
  for (const field of targetFields) {
    if (field.copy_previous === false) continue
    if (['computed', 'file', 'display'].includes(field.field_type)) continue
    const source = sourceByCode.get(field.code)
    if (!source || !canCopyType(source.field_type, field.field_type)) continue
    if (!(field.code in sourceAnswers)) continue
    result[field.code] = sourceAnswers[field.code]
  }
  return calculateComputed(targetFields, result)
}
