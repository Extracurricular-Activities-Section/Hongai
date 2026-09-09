import type {
  EvaluatedFieldState,
  FormFieldOption,
  FormFieldSchema,
  FormFieldValue,
  FormSchema,
  FormSectionSchema,
  FormValues,
} from '../types'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import type { FileFieldConfig } from '@/features/attachments/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface FieldProps {
  field: FormFieldSchema
  value: FormFieldValue
  mode: 'edit' | 'readonly'
  required: boolean
  onChange: (value: FormFieldValue) => void
  submissionId?: string
  applicationId?: string
}

function ReadonlyValue({ value }: { value: FormFieldValue }) {
  if (value == null || value === '') return <p className="text-sm text-muted-foreground">—</p>
  if (typeof value === 'boolean') return <p className="text-sm">{value ? '是' : '否'}</p>
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2 text-sm">
        {value.map((row, index) => (
          <pre key={index} className="whitespace-pre-wrap rounded border border-border p-2">
            {JSON.stringify(row, null, 2)}
          </pre>
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className="space-y-1 text-sm">
        {Object.entries(value).map(([key, item]) => (
          <p key={key}>
            {key}：{String(item || '—')}
          </p>
        ))}
      </div>
    )
  }
  return <p className="whitespace-pre-wrap text-sm">{String(value)}</p>
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
  if (field.field_type === 'display') {
    return <p className="text-sm text-muted-foreground">{field.help_text || field.label}</p>
  }

  if (field.field_type === 'file') {
    const config = (field.config || {}) as FileFieldConfig
    const ids = Array.isArray(value) ? value.map(String) : []
    const allowed = config.allowed_extensions?.length
      ? config.allowed_extensions
      : ['pdf', 'jpg', 'jpeg', 'png']
    const maxFiles = config.max_files && config.max_files > 0 ? config.max_files : 3
    const maxSizeMb = config.max_file_size_mb && config.max_file_size_mb > 0 ? config.max_file_size_mb : 10

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
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        <ReadonlyValue value={value} />
      </div>
    )
  }

  if (field.field_type === 'textarea') {
    return (
      <div className="space-y-1">
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={String(value ?? '')}
          placeholder={field.placeholder || ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.help_text ? <p className="text-xs text-muted-foreground">{field.help_text}</p> : null}
      </div>
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
      <div className="space-y-1">
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        <Input
          type={inputType}
          value={value == null ? '' : String(value)}
          placeholder={field.placeholder || ''}
          onChange={(e) => {
            if (inputType === 'number') {
              onChange(e.target.value === '' ? null : Number(e.target.value))
            } else {
              onChange(e.target.value)
            }
          }}
        />
      </div>
    )
  }

  if (field.field_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
        {required ? ' *' : ''}
      </label>
    )
  }

  if (field.field_type === 'radio' || field.field_type === 'select') {
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        {field.field_type === 'select' ? (
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">請選擇</option>
            {field.options.map((option: FormFieldOption) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            {field.options.map((option: FormFieldOption) => (
              <label key={option.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={String(value ?? '') === option.value}
                  onChange={() =>
                    onChange(
                      option.value === 'true' ? true : option.value === 'false' ? false : option.value,
                    )
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (field.field_type === 'multiselect') {
    const selected = Array.isArray(value) ? value.map(String) : []
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        {field.options.map((option: FormFieldOption) => {
          const checked = selected.includes(option.value)
          return (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, option.value])
                  else onChange(selected.filter((item) => item !== option.value))
                }}
              />
              {option.label}
            </label>
          )
        })}
      </div>
    )
  }

  if (field.field_type === 'repeat_group') {
    const rows = Array.isArray(value) ? (value as Array<Record<string, string | number | null>>) : []
    const columns =
      (field.config as { columns?: Array<{ code: string; label: string; field_type: string }> } | null)
        ?.columns || []
    const maxRows = (field.config as { max_rows?: number } | null)?.max_rows ?? 20
    return (
      <div className="space-y-3">
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
            {columns.map((col) => (
              <div key={col.code} className="space-y-1">
                <Label>{col.label}</Label>
                <Input
                  type={col.field_type === 'currency' || col.field_type === 'number' ? 'number' : 'text'}
                  value={row[col.code] == null ? '' : String(row[col.code])}
                  onChange={(e) => {
                    const next = rows.map((item, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...item,
                            [col.code]:
                              col.field_type === 'currency' || col.field_type === 'number'
                                ? e.target.value === ''
                                  ? null
                                  : Number(e.target.value)
                                : e.target.value,
                          }
                        : item,
                    )
                    onChange(next)
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              刪除
            </Button>
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
          新增項目
        </Button>
      </div>
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
      <div className="space-y-3">
        <Label>
          {field.label}
          {required ? ' *' : ''}
        </Label>
        <div className="grid gap-3 md:grid-cols-2">
          {months.map((month) => (
            <div key={month} className="space-y-1 rounded-md border border-border p-3">
              <Label>{month} 月</Label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={plan[String(month)] || ''}
                onChange={(e) => onChange({ ...plan, [String(month)]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Label>{field.label}</Label>
      <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    </div>
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
}: {
  schema: FormSchema
  values: FormValues
  fieldState: Record<string, EvaluatedFieldState>
  mode: 'edit' | 'readonly'
  onChange?: (code: string, value: FormFieldValue) => void
  submissionId?: string
  applicationId?: string
}) {
  return (
    <div className="space-y-8">
      {schema.sections.map((section: FormSectionSchema) => (
        <section key={section.id} className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">{section.title}</h2>
            {section.description ? (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            ) : null}
          </div>
          <div className="space-y-4">
            {section.fields
              .filter((field: FormFieldSchema) => field.active && fieldState[field.code]?.visible !== false)
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
