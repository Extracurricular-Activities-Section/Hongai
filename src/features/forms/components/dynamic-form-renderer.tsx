import { Plus, Trash2 } from 'lucide-react'

import { Field } from '@/components/common/field'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import type { FileFieldConfig } from '@/features/attachments/types'
import { cn } from '@/lib/utils'
import type {
  EvaluatedFieldState,
  FormFieldOption,
  FormFieldSchema,
  FormFieldValue,
  FormSchema,
  FormSectionSchema,
  FormValues,
} from '../types'

interface FieldProps {
  field: FormFieldSchema
  value: FormFieldValue
  mode: 'edit' | 'readonly'
  required: boolean
  onChange: (value: FormFieldValue) => void
  submissionId?: string
  applicationId?: string
}

const choiceControlClass =
  'size-4 shrink-0 accent-accent-strong'

function ReadonlyValue({ value }: { value: FormFieldValue }) {
  if (value == null || value === '') return <p className="text-sm text-muted-foreground">—</p>
  if (typeof value === 'boolean') return <p className="text-sm text-foreground">{value ? '是' : '否'}</p>
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((row, index) => (
          <div key={index} className="rounded-md border border-border bg-surface-muted p-3 text-sm">
            {row && typeof row === 'object' && !Array.isArray(row) ? (
              <dl className="grid gap-1 sm:grid-cols-2">
                {Object.entries(row as Record<string, unknown>).map(([key, item]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="text-foreground">{String(item ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              String(row)
            )}
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <dl className="space-y-1 text-sm">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="flex gap-2">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="text-foreground">{String(item || '—')}</dd>
          </div>
        ))}
      </dl>
    )
  }
  return <p className="whitespace-pre-wrap text-sm text-foreground">{String(value)}</p>
}

export function FieldRenderer({
  field,
  value,
  mode,
  required,
  onChange,
  submissionId,
  applicationId,
}: FieldProps) {
  const fieldId = `ff-${field.code}`

  if (field.field_type === 'display') {
    return (
      <p className="rounded-md border-l-2 border-border-strong bg-surface-muted px-4 py-3 text-sm leading-relaxed text-subtle">
        {field.help_text || field.label}
      </p>
    )
  }

  if (field.field_type === 'file') {
    const config = (field.config || {}) as FileFieldConfig
    const ids = Array.isArray(value) ? value.map(String) : []
    const allowed = config.allowed_extensions?.length
      ? config.allowed_extensions
      : ['pdf', 'jpg', 'jpeg', 'png']
    const maxFiles = config.max_files && config.max_files > 0 ? config.max_files : 3
    const maxSizeMb =
      config.max_file_size_mb && config.max_file_size_mb > 0 ? config.max_file_size_mb : 10

    return (
      <SecureFileUpload
        label={field.label}
        required={required}
        helpText={field.help_text || undefined}
        allowedExtensions={allowed}
        maxFiles={maxFiles}
        maxSizeMb={maxSizeMb}
        context="application"
        submissionId={submissionId}
        applicationId={applicationId}
        fieldCode={field.code}
        value={ids}
        onChange={(next) => onChange(next)}
        disabled={mode === 'readonly'}
      />
    )
  }

  if (mode === 'readonly' || field.field_type === 'computed') {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {field.label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </p>
        <ReadonlyValue value={value} />
      </div>
    )
  }

  if (field.field_type === 'textarea') {
    return (
      <Field id={fieldId} label={field.label} required={required} description={field.help_text}>
        <Textarea
          id={fieldId}
          value={String(value ?? '')}
          placeholder={field.placeholder || ''}
          aria-describedby={field.help_text ? `${fieldId}-description` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    )
  }

  if (
    field.field_type === 'text' ||
    field.field_type === 'email' ||
    field.field_type === 'url' ||
    field.field_type === 'date' ||
    field.field_type === 'number' ||
    field.field_type === 'currency'
  ) {
    const inputType =
      field.field_type === 'date'
        ? 'date'
        : field.field_type === 'number' || field.field_type === 'currency'
          ? 'number'
          : field.field_type === 'email'
            ? 'email'
            : field.field_type === 'url'
              ? 'url'
              : 'text'

    return (
      <Field id={fieldId} label={field.label} required={required} description={field.help_text}>
        <Input
          id={fieldId}
          type={inputType}
          value={value == null ? '' : String(value)}
          placeholder={field.placeholder || ''}
          aria-describedby={field.help_text ? `${fieldId}-description` : undefined}
          className={cn(field.field_type === 'currency' && 'tabular')}
          onChange={(event) => {
            if (inputType === 'number') {
              onChange(event.target.value === '' ? null : Number(event.target.value))
            } else {
              onChange(event.target.value)
            }
          }}
        />
      </Field>
    )
  }

  if (field.field_type === 'checkbox') {
    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-sm transition-colors hover:border-border-strong"
        >
          <input
            id={fieldId}
            type="checkbox"
            className={cn(choiceControlClass, 'mt-0.5')}
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="text-foreground">
            {field.label}
            {required ? <span className="ml-1 text-danger">*</span> : null}
          </span>
        </label>
        {field.help_text ? (
          <p className="text-meta text-muted-foreground">{field.help_text}</p>
        ) : null}
      </div>
    )
  }

  if (field.field_type === 'select') {
    return (
      <Field id={fieldId} label={field.label} required={required} description={field.help_text}>
        <Select
          id={fieldId}
          value={String(value ?? '')}
          aria-describedby={field.help_text ? `${fieldId}-description` : undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">請選擇</option>
          {field.options.map((option: FormFieldOption) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    )
  }

  if (field.field_type === 'radio') {
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {field.label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </legend>
        {field.help_text ? (
          <p className="text-meta text-muted-foreground">{field.help_text}</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {field.options.map((option: FormFieldOption) => {
            const checked = String(value ?? '') === option.value
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm transition-colors',
                  checked
                    ? 'border-accent-strong bg-accent-soft text-foreground'
                    : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name={fieldId}
                  className={choiceControlClass}
                  checked={checked}
                  onChange={() =>
                    onChange(
                      option.value === 'true'
                        ? true
                        : option.value === 'false'
                          ? false
                          : option.value,
                    )
                  }
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }

  if (field.field_type === 'multiselect') {
    const selected = Array.isArray(value) ? value.map(String) : []
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {field.label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </legend>
        {field.help_text ? (
          <p className="text-meta text-muted-foreground">{field.help_text}</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {field.options.map((option: FormFieldOption) => {
            const checked = selected.includes(option.value)
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm transition-colors',
                  checked
                    ? 'border-accent-strong bg-accent-soft text-foreground'
                    : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <input
                  type="checkbox"
                  className={choiceControlClass}
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) onChange([...selected, option.value])
                    else onChange(selected.filter((item) => item !== option.value))
                  }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }

  if (field.field_type === 'repeat_group') {
    const rows = Array.isArray(value) ? (value as Array<Record<string, string | number | null>>) : []
    const columns =
      (field.config as { columns?: Array<{ code: string; label: string; field_type: string }> } | null)
        ?.columns || []
    const maxRows = (field.config as { max_rows?: number } | null)?.max_rows ?? 20

    return (
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          {field.label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </legend>
        {field.help_text ? (
          <p className="text-meta text-muted-foreground">{field.help_text}</p>
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong px-4 py-5 text-center text-sm text-muted-foreground">
            尚未新增項目
          </p>
        ) : null}

        {rows.map((row, index) => (
          <div key={index} className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-meta font-medium text-muted-foreground tabular">
                項目 {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`刪除項目 ${index + 1}`}
                onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {columns.map((col) => {
                const colId = `${fieldId}-${index}-${col.code}`
                const numeric = col.field_type === 'currency' || col.field_type === 'number'
                return (
                  <div key={col.code} className="space-y-1.5">
                    <Label htmlFor={colId}>{col.label}</Label>
                    <Input
                      id={colId}
                      type={numeric ? 'number' : 'text'}
                      className={cn(numeric && 'tabular')}
                      value={row[col.code] == null ? '' : String(row[col.code])}
                      onChange={(event) => {
                        const next = rows.map((item, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...item,
                                [col.code]: numeric
                                  ? event.target.value === ''
                                    ? null
                                    : Number(event.target.value)
                                  : event.target.value,
                              }
                            : item,
                        )
                        onChange(next)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= maxRows}
          onClick={() => {
            const empty: Record<string, string | number | null> = {}
            for (const col of columns) empty[col.code] = ''
            onChange([...rows, empty])
          }}
        >
          <Plus />
          新增項目
        </Button>
      </fieldset>
    )
  }

  if (field.field_type === 'monthly_plan') {
    const months =
      (field.config as { months?: number[] } | null)?.months ||
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const plan = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<
      string,
      string
    >

    return (
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          {field.label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </legend>
        {field.help_text ? (
          <p className="text-meta text-muted-foreground">{field.help_text}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {months.map((month) => {
            const monthId = `${fieldId}-m${month}`
            return (
              <div key={month} className="space-y-1.5">
                <Label htmlFor={monthId}>{month} 月</Label>
                <Textarea
                  id={monthId}
                  className="min-h-20"
                  value={plan[String(month)] || ''}
                  onChange={(event) => onChange({ ...plan, [String(month)]: event.target.value })}
                />
              </div>
            )
          })}
        </div>
      </fieldset>
    )
  }

  return (
    <Field id={fieldId} label={field.label} required={required} description={field.help_text}>
      <Input
        id={fieldId}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export function DynamicFormRenderer({
  schema,
  values,
  fieldState,
  mode,
  onChange,
  submissionId,
  applicationId,
  hideSectionHeadings = false,
}: {
  schema: FormSchema
  values: FormValues
  fieldState: Record<string, EvaluatedFieldState>
  mode: 'edit' | 'readonly'
  onChange?: (code: string, value: FormFieldValue) => void
  submissionId?: string
  applicationId?: string
  /** The workspace already shows the active section title in its own header. */
  hideSectionHeadings?: boolean
}) {
  return (
    <div className="space-y-10">
      {schema.sections.map((section: FormSectionSchema) => (
        <section key={section.id} className="space-y-5">
          {hideSectionHeadings ? null : (
            <div className="border-b border-border pb-3">
              <h2 className="text-section font-semibold text-foreground">{section.title}</h2>
              {section.description ? (
                <p className="mt-1 text-sm leading-relaxed text-subtle">{section.description}</p>
              ) : null}
            </div>
          )}
          <div className="space-y-6">
            {section.fields
              .filter(
                (field: FormFieldSchema) =>
                  field.active && fieldState[field.code]?.visible !== false,
              )
              .map((field: FormFieldSchema) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.code]}
                  mode={mode}
                  required={Boolean(fieldState[field.code]?.required)}
                  onChange={(next) => onChange?.(field.code, next)}
                  submissionId={submissionId}
                  applicationId={applicationId}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
