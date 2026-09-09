import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ComputedFieldConfig,
  FormFieldOption,
  FormFieldSchema,
  FormRule,
  FormRuleOperator,
  FormRuleType,
  FormSectionSchema,
  MonthlyPlanConfig,
  RepeatGroupConfig,
} from '@/features/forms/types'
import type { FileFieldConfig } from '@/features/attachments/types'
import type { BuilderDocument, BuilderSelection } from '../types'
import { findField } from '../types'
import { generateClientId } from '../utils/code'
import { fieldTypeLabel } from '../utils/field-defaults'

const RULE_TYPES: Array<{ value: FormRuleType; label: string }> = [
  { value: 'show_if', label: '符合時顯示' },
  { value: 'hide_if', label: '符合時隱藏' },
  { value: 'require_if', label: '符合時必填' },
]

const OPERATORS: Array<{ value: FormRuleOperator; label: string }> = [
  { value: 'equals', label: '等於' },
  { value: 'not_equals', label: '不等於' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'is_true', label: '為真' },
  { value: 'is_false', label: '為假' },
  { value: 'is_empty', label: '為空' },
  { value: 'is_not_empty', label: '不為空' },
]

function CheckboxRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-accent-strong"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

function SectionSettings({
  section,
  codeEditable,
  onChange,
}: {
  section: FormSectionSchema
  codeEditable: boolean
  onChange: (patch: Partial<FormSectionSchema>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>區塊標題</Label>
        <Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>代碼</Label>
        <Input
          value={section.code}
          disabled={!codeEditable}
          onChange={(e) => onChange({ code: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>說明</Label>
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 py-2 text-sm"
          value={section.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
      <CheckboxRow
        checked={section.visible}
        label="顯示區塊"
        onChange={(visible) => onChange({ visible })}
      />
      <CheckboxRow
        checked={section.pdf_visible}
        label="出現在 PDF"
        onChange={(pdf_visible) => onChange({ pdf_visible })}
      />
    </div>
  )
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: FormFieldOption[]
  onChange: (next: FormFieldOption[]) => void
}) {
  return (
    <div className="space-y-2">
      <Label>選項</Label>
      {options.map((option, index) => (
        <div key={option.id} className="grid gap-2 rounded-md border border-border p-2">
          <Input
            value={option.label}
            placeholder="顯示文字"
            onChange={(e) => {
              const next = options.map((item, i) =>
                i === index ? { ...item, label: e.target.value } : item,
              )
              onChange(next)
            }}
          />
          <Input
            value={option.value}
            placeholder="值"
            onChange={(e) => {
              const next = options.map((item, i) =>
                i === index ? { ...item, value: e.target.value } : item,
              )
              onChange(next)
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <CheckboxRow
              checked={option.active}
              label="啟用"
              onChange={(active) => {
                const next = options.map((item, i) => (i === index ? { ...item, active } : item))
                onChange(next)
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              刪除
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([
            ...options,
            {
              id: generateClientId('opt'),
              value: `option_${options.length + 1}`,
              label: `選項 ${options.length + 1}`,
              sort_order: options.length + 1,
              active: true,
            },
          ])
        }
      >
        新增選項
      </Button>
    </div>
  )
}

function FieldSettings({
  field,
  document,
  codeEditable,
  onChange,
  onRulesChange,
}: {
  field: FormFieldSchema
  document: BuilderDocument
  codeEditable: boolean
  onChange: (patch: Partial<FormFieldSchema>) => void
  onRulesChange: (rules: FormRule[]) => void
}) {
  const fieldRules = document.rules.filter((rule) => rule.field_id === field.id || rule.field_code === field.code)
  const allFields = document.sections.flatMap((section) => section.fields)
  const needsOptions =
    field.field_type === 'select' || field.field_type === 'radio' || field.field_type === 'multiselect'

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>標籤</Label>
        <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>代碼</Label>
        <Input
          value={field.code}
          disabled={!codeEditable}
          onChange={(e) => onChange({ code: e.target.value })}
        />
        {!codeEditable ? (
          <p className="text-xs text-muted-foreground">已發布版本不可修改代碼</p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">類型：{fieldTypeLabel(field.field_type)}</p>
      <div className="space-y-1">
        <Label>說明文字</Label>
        <textarea
          className="min-h-16 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 py-2 text-sm"
          value={field.help_text || ''}
          onChange={(e) => onChange({ help_text: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Placeholder</Label>
        <Input
          value={field.placeholder || ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
        />
      </div>
      <CheckboxRow
        checked={field.required}
        label="必填"
        onChange={(required) => onChange({ required })}
      />
      <CheckboxRow
        checked={field.pdf_visible}
        label="出現在 PDF"
        onChange={(pdf_visible) => onChange({ pdf_visible })}
      />
      <CheckboxRow
        checked={field.copy_previous}
        label="可套用上一期"
        onChange={(copy_previous) => onChange({ copy_previous })}
      />
      <CheckboxRow
        checked={field.active}
        label="啟用"
        onChange={(active) => onChange({ active })}
      />

      <div className="space-y-1">
        <Label>驗證警告（最低數值）</Label>
        <Input
          type="number"
          value={field.validation?.warnings?.[0]?.value ?? ''}
          placeholder="例如最低時數"
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            onChange({
              validation:
                value == null
                  ? null
                  : {
                      warnings: [
                        {
                          type: 'min_number',
                          value,
                          message: field.validation?.warnings?.[0]?.message || `建議不低於 ${value}`,
                        },
                      ],
                    },
            })
          }}
        />
        <Input
          value={field.validation?.warnings?.[0]?.message || ''}
          placeholder="警告訊息"
          onChange={(e) => {
            const current = field.validation?.warnings?.[0]
            if (!current) return
            onChange({
              validation: {
                warnings: [{ ...current, message: e.target.value }],
              },
            })
          }}
        />
      </div>

      {needsOptions ? <OptionsEditor options={field.options} onChange={(options) => onChange({ options })} /> : null}

      {field.field_type === 'computed' ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>計算設定</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
            value={(field.config as ComputedFieldConfig | null)?.operation || 'sum'}
            onChange={(e) => {
              const operation = e.target.value as ComputedFieldConfig['operation']
              const prev = (field.config || {}) as ComputedFieldConfig
              onChange({
                config: {
                  ...prev,
                  operation,
                  fields: prev.fields || [],
                },
              })
            }}
          >
            <option value="sum">加總 sum</option>
            <option value="date_diff_days">日期差（天）</option>
            <option value="date_diff_months">日期差（月）</option>
          </select>
          {(field.config as ComputedFieldConfig | null)?.operation === 'sum' ? (
            <Input
              value={((field.config as ComputedFieldConfig | null)?.fields || []).join(',')}
              placeholder="欄位代碼，逗號分隔（可 group.amount）"
              onChange={(e) => {
                const fields = e.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
                onChange({
                  config: {
                    ...((field.config || {}) as ComputedFieldConfig),
                    operation: 'sum',
                    fields,
                  },
                })
              }}
            />
          ) : (
            <div className="grid gap-2">
              <Input
                value={(field.config as ComputedFieldConfig | null)?.start || ''}
                placeholder="開始日期欄位代碼"
                onChange={(e) =>
                  onChange({
                    config: {
                      ...((field.config || {}) as ComputedFieldConfig),
                      start: e.target.value,
                    },
                  })
                }
              />
              <Input
                value={(field.config as ComputedFieldConfig | null)?.end || ''}
                placeholder="結束日期欄位代碼"
                onChange={(e) =>
                  onChange({
                    config: {
                      ...((field.config || {}) as ComputedFieldConfig),
                      end: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      ) : null}

      {field.field_type === 'repeat_group' ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>重複群組</Label>
          <Input
            type="number"
            value={(field.config as RepeatGroupConfig | null)?.max_rows ?? 10}
            onChange={(e) => {
              const config = {
                ...((field.config || { columns: [] }) as RepeatGroupConfig),
                max_rows: Number(e.target.value) || 10,
              }
              onChange({ config })
            }}
          />
          {((field.config as RepeatGroupConfig | null)?.columns || []).map((column, index) => (
            <div key={column.code + index} className="grid gap-2 rounded border border-border p-2">
              <Input
                value={column.label}
                placeholder="欄位標籤"
                onChange={(e) => {
                  const columns = [...((field.config as RepeatGroupConfig).columns || [])]
                  columns[index] = { ...columns[index], label: e.target.value }
                  onChange({ config: { ...(field.config as RepeatGroupConfig), columns } })
                }}
              />
              <Input
                value={column.code}
                placeholder="欄位代碼"
                onChange={(e) => {
                  const columns = [...((field.config as RepeatGroupConfig).columns || [])]
                  columns[index] = { ...columns[index], code: e.target.value }
                  onChange({ config: { ...(field.config as RepeatGroupConfig), columns } })
                }}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
                value={column.field_type}
                onChange={(e) => {
                  const columns = [...((field.config as RepeatGroupConfig).columns || [])]
                  columns[index] = {
                    ...columns[index],
                    field_type: e.target.value as RepeatGroupConfig['columns'][number]['field_type'],
                  }
                  onChange({ config: { ...(field.config as RepeatGroupConfig), columns } })
                }}
              >
                <option value="text">文字</option>
                <option value="number">數字</option>
                <option value="currency">金額</option>
                <option value="textarea">多行文字</option>
              </select>
              <CheckboxRow
                checked={Boolean(column.required)}
                label="必填"
                onChange={(required) => {
                  const columns = [...((field.config as RepeatGroupConfig).columns || [])]
                  columns[index] = { ...columns[index], required }
                  onChange({ config: { ...(field.config as RepeatGroupConfig), columns } })
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const config = (field.config || { columns: [], max_rows: 10 }) as RepeatGroupConfig
              onChange({
                config: {
                  ...config,
                  columns: [
                    ...config.columns,
                    {
                      code: `col_${config.columns.length + 1}`,
                      label: `欄位 ${config.columns.length + 1}`,
                      field_type: 'text',
                      required: false,
                    },
                  ],
                },
              })
            }}
          >
            新增欄
          </Button>
        </div>
      ) : null}

      {field.field_type === 'monthly_plan' ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>月份（勾選）</Label>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const months = (field.config as MonthlyPlanConfig | null)?.months || []
              const checked = months.includes(month)
              return (
                <label key={month} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...months, month].sort((a, b) => a - b)
                        : months.filter((item) => item !== month)
                      onChange({ config: { months: next } })
                    }}
                  />
                  {month} 月
                </label>
              )
            })}
          </div>
        </div>
      ) : null}

      {field.field_type === 'file' ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>檔案設定</Label>
          <Input
            value={((field.config as FileFieldConfig | null)?.allowed_extensions || []).join(',')}
            placeholder="副檔名，逗號分隔"
            onChange={(e) => {
              const allowed_extensions = e.target.value
                .split(',')
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean)
              onChange({
                config: {
                  ...((field.config || {}) as FileFieldConfig),
                  allowed_extensions,
                },
              })
            }}
          />
          <Input
            type="number"
            value={(field.config as FileFieldConfig | null)?.max_files ?? 3}
            onChange={(e) =>
              onChange({
                config: {
                  ...((field.config || {}) as FileFieldConfig),
                  max_files: Number(e.target.value) || 3,
                },
              })
            }
          />
          <Input
            type="number"
            value={(field.config as FileFieldConfig | null)?.max_file_size_mb ?? 10}
            onChange={(e) =>
              onChange({
                config: {
                  ...((field.config || {}) as FileFieldConfig),
                  max_file_size_mb: Number(e.target.value) || 10,
                },
              })
            }
          />
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <Label>條件規則</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const source = allFields.find((item) => item.id !== field.id)
              const rule: FormRule = {
                id: generateClientId('rule'),
                field_id: field.id,
                field_code: field.code,
                rule_type: 'show_if',
                source_field_code: source?.code || '',
                operator: 'equals',
                value: '',
                sort_order: document.rules.length + 1,
              }
              onRulesChange([...document.rules, rule])
            }}
          >
            新增規則
          </Button>
        </div>
        {fieldRules.map((rule) => (
          <div key={rule.id} className="space-y-2 rounded border border-border p-2">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={rule.rule_type}
              onChange={(e) => {
                onRulesChange(
                  document.rules.map((item) =>
                    item.id === rule.id
                      ? { ...item, rule_type: e.target.value as FormRuleType }
                      : item,
                  ),
                )
              }}
            >
              {RULE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={rule.source_field_code}
              onChange={(e) => {
                onRulesChange(
                  document.rules.map((item) =>
                    item.id === rule.id ? { ...item, source_field_code: e.target.value } : item,
                  ),
                )
              }}
            >
              <option value="">選擇來源欄位</option>
              {allFields
                .filter((item) => item.code !== field.code)
                .map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.label}（{item.code}）
                  </option>
                ))}
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
              value={rule.operator}
              onChange={(e) => {
                onRulesChange(
                  document.rules.map((item) =>
                    item.id === rule.id
                      ? { ...item, operator: e.target.value as FormRuleOperator }
                      : item,
                  ),
                )
              }}
            >
              {OPERATORS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {rule.operator !== 'is_true' &&
            rule.operator !== 'is_false' &&
            rule.operator !== 'is_empty' &&
            rule.operator !== 'is_not_empty' ? (
              <Input
                value={rule.value == null ? '' : String(rule.value)}
                placeholder="比較值"
                onChange={(e) => {
                  onRulesChange(
                    document.rules.map((item) =>
                      item.id === rule.id ? { ...item, value: e.target.value } : item,
                    ),
                  )
                }}
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRulesChange(document.rules.filter((item) => item.id !== rule.id))}
            >
              刪除規則
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormBuilderSettingsPanel({
  document,
  selection,
  codeEditable,
  onUpdateSection,
  onUpdateField,
  onUpdateRules,
}: {
  document: BuilderDocument
  selection: BuilderSelection
  codeEditable: boolean
  onUpdateSection: (sectionId: string, patch: Partial<FormSectionSchema>) => void
  onUpdateField: (fieldId: string, patch: Partial<FormFieldSchema>) => void
  onUpdateRules: (rules: FormRule[]) => void
}) {
  const section =
    selection?.type === 'section'
      ? document.sections.find((item) => item.id === selection.sectionId)
      : selection?.type === 'field'
        ? document.sections.find((item) => item.id === selection.sectionId)
        : null
  const field =
    selection?.type === 'field' ? findField(document, selection.fieldId)?.field || null : null

  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">
          {field ? '欄位設定' : section ? '區塊設定' : '設定'}
        </h2>
        <p className="mt-0.5 truncate text-meta text-muted-foreground">
          {field ? `${field.label} · ${field.code}` : section ? section.title : '選擇畫布上的項目'}
        </p>
      </header>
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {!selection ? (
          <p className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-meta text-muted-foreground">
            點選左側畫布上的區塊或欄位，即可在此編輯設定。
          </p>
        ) : null}
        {selection?.type === 'section' && section ? (
          <SectionSettings
            section={section}
            codeEditable={codeEditable}
            onChange={(patch) => onUpdateSection(section.id, patch)}
          />
        ) : null}
        {selection?.type === 'field' && field ? (
          <FieldSettings
            field={field}
            document={document}
            codeEditable={codeEditable}
            onChange={(patch) => onUpdateField(field.id, patch)}
            onRulesChange={onUpdateRules}
          />
        ) : null}
      </div>
    </div>
  )
}
