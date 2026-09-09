import type { BuilderDocument } from '../types'
import type { FieldType } from '@/features/forms/types'
import type { FormIssue } from '@/features/forms/types'

const CODE_RE = /^[a-z][a-z0-9_]{0,63}$/

export function validateBuilderDocument(document: BuilderDocument): FormIssue[] {
  const issues: FormIssue[] = []
  const codes = new Set<string>()

  if (document.sections.length === 0) {
    issues.push({
      code: 'no_sections',
      severity: 'error',
      message: '至少需要一個區塊',
    })
  }

  for (const section of document.sections) {
    if (!section.title.trim()) {
      issues.push({
        code: 'section_title',
        severity: 'error',
        message: '區塊標題不可空白',
      })
    }
    if (!CODE_RE.test(section.code)) {
      issues.push({
        code: 'section_code',
        severity: 'error',
        message: `區塊代碼「${section.code}」格式無效（需小寫開頭，僅英數與底線）`,
      })
    }
    if (codes.has(section.code)) {
      issues.push({
        code: 'duplicate_code',
        severity: 'error',
        message: `代碼重複：${section.code}`,
      })
    }
    codes.add(section.code)

    for (const field of section.fields) {
      if (!field.label.trim()) {
        issues.push({
          code: 'field_label',
          field_code: field.code,
          severity: 'error',
          message: '欄位標籤不可空白',
        })
      }
      if (!CODE_RE.test(field.code)) {
        issues.push({
          code: 'field_code',
          field_code: field.code,
          severity: 'error',
          message: `欄位代碼「${field.code}」格式無效`,
        })
      }
      if (codes.has(field.code)) {
        issues.push({
          code: 'duplicate_code',
          field_code: field.code,
          severity: 'error',
          message: `代碼重複：${field.code}`,
        })
      }
      codes.add(field.code)

      if (
        (field.field_type === 'select' ||
          field.field_type === 'radio' ||
          field.field_type === 'multiselect') &&
        field.options.filter((option) => option.active).length === 0
      ) {
        issues.push({
          code: 'options_required',
          field_code: field.code,
          severity: 'error',
          message: `「${field.label}」需要至少一個選項`,
        })
      }

      if (field.field_type === 'computed') {
        const config = field.config as { operation?: string; fields?: string[]; start?: string; end?: string } | null
        if (!config?.operation) {
          issues.push({
            code: 'computed_config',
            field_code: field.code,
            severity: 'error',
            message: `「${field.label}」缺少計算設定`,
          })
        } else if (config.operation === 'sum' && !(config.fields && config.fields.length > 0)) {
          issues.push({
            code: 'computed_sum',
            field_code: field.code,
            severity: 'warning',
            message: `「${field.label}」尚未指定加總欄位`,
          })
        } else if (
          (config.operation === 'date_diff_days' || config.operation === 'date_diff_months') &&
          (!config.start || !config.end)
        ) {
          issues.push({
            code: 'computed_dates',
            field_code: field.code,
            severity: 'error',
            message: `「${field.label}」需設定起迄日期欄位`,
          })
        }
      }

      if (field.field_type === 'repeat_group') {
        const config = field.config as { columns?: Array<{ code: string; label: string }> } | null
        if (!config?.columns?.length) {
          issues.push({
            code: 'repeat_columns',
            field_code: field.code,
            severity: 'error',
            message: `「${field.label}」需至少一欄`,
          })
        }
      }
    }
  }

  for (const rule of document.rules) {
    if (!codes.has(rule.field_code)) {
      issues.push({
        code: 'rule_field',
        field_code: rule.field_code,
        severity: 'error',
        message: `規則指向不存在的欄位：${rule.field_code}`,
      })
    }
    if (!codes.has(rule.source_field_code)) {
      issues.push({
        code: 'rule_source',
        field_code: rule.field_code,
        severity: 'error',
        message: `規則來源欄位不存在：${rule.source_field_code}`,
      })
    }
  }

  return issues
}

export function hasBlockingIssues(issues: FormIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}

export type { FieldType }
