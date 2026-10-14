import type { ReactNode } from 'react'

import { identityTypeLabel } from '@/features/periods/constants/eligibility'
import type { FormWorkspaceResponse } from '@/features/forms/api'
import { evaluateRules } from '@/features/forms/engine'
import type {
  FormFieldSchema,
  FormFieldValue,
  MonthlyPlanConfig,
  RepeatGroupConfig,
} from '@/features/forms/types'
import { formatTaipeiDateTime } from '@/lib/utils'

const EMPTY = '—'
const FULL_WIDTH_TYPES = new Set(['repeat_group', 'monthly_plan'])

function text(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function formatNumber(value: unknown, currency: boolean): string {
  const num = Number(value)
  if (text(value) === '' || !Number.isFinite(num)) return EMPTY
  const formatted = num.toLocaleString('zh-TW')
  return currency ? `${formatted} 元` : formatted
}

function optionLabel(field: FormFieldSchema, value: unknown): string {
  return field.options.find((option) => option.value === String(value))?.label ?? String(value)
}

function MonthlyPlanTable({ field, value }: { field: FormFieldSchema; value: FormFieldValue }) {
  const plan = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const months = (field.config as MonthlyPlanConfig | null)?.months || [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]
  const half = Math.ceil(months.length / 2)
  const cell = (month: number | undefined) =>
    month == null ? (
      <td colSpan={2} />
    ) : (
      <>
        <th scope="row" className="w-14">
          {month} 月
        </th>
        <td>{text((plan as Record<string, unknown>)[String(month)]) || EMPTY}</td>
      </>
    )
  return (
    <table className="print-table table-fixed">
      <tbody>
        {months.slice(0, half).map((month, index) => (
          <tr key={month}>
            {cell(month)}
            {cell(months[half + index])}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RepeatGroupTable({ field, value }: { field: FormFieldSchema; value: FormFieldValue }) {
  const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
  const columns = (field.config as RepeatGroupConfig | null)?.columns || []
  if (rows.length === 0) return <>{EMPTY}</>
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th scope="col" className="w-10">
            #
          </th>
          {columns.map((column) => (
            <th key={column.code} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td className="tabular">{index + 1}</td>
            {columns.map((column) => (
              <td
                key={column.code}
                className={column.field_type === 'currency' || column.field_type === 'number' ? 'tabular text-right' : ''}
              >
                {column.field_type === 'currency' || column.field_type === 'number'
                  ? formatNumber(row[column.code], column.field_type === 'currency')
                  : text(row[column.code]) || EMPTY}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FieldValue({ field, value }: { field: FormFieldSchema; value: FormFieldValue }): ReactNode {
  switch (field.field_type) {
    case 'repeat_group':
      return <RepeatGroupTable field={field} value={value} />
    case 'monthly_plan':
      return <MonthlyPlanTable field={field} value={value} />
    case 'currency':
      return formatNumber(value, true)
    case 'number':
      return formatNumber(value, false)
    case 'computed':
      return formatNumber(value, field.label.includes('金額'))
    case 'checkbox':
      return value === true ? '是' : '否'
    case 'select':
    case 'radio':
      return text(value) ? optionLabel(field, value) : EMPTY
    case 'multiselect': {
      const selected = Array.isArray(value) ? value.map(String) : []
      if (selected.length === 0) return EMPTY
      return (
        <ul className="space-y-0.5">
          {selected.map((item) => (
            <li key={item}>☑ {optionLabel(field, item)}</li>
          ))}
        </ul>
      )
    }
    case 'file':
      return Array.isArray(value) && value.length ? `已上傳附件 ${value.length} 個` : EMPTY
    default:
      return <span className="whitespace-pre-wrap">{text(value) || EMPTY}</span>
  }
}

function InfoGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <table className="print-table table-fixed">
      <tbody>
        {Array.from({ length: Math.ceil(items.length / 2) }, (_, row) => (
          <tr key={row}>
            {items.slice(row * 2, row * 2 + 2).map(([label, value]) => (
              <FragmentCells key={label} label={label} value={value} />
            ))}
            {items.length % 2 === 1 && row === Math.ceil(items.length / 2) - 1 ? (
              <td colSpan={2} />
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FragmentCells({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <th scope="row" className="w-28">
        {label}
      </th>
      <td>{value || EMPTY}</td>
    </>
  )
}

function SignatureBox({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="print-avoid-break border border-black">
      <p className="border-b border-black bg-neutral-100 px-2 py-1 font-semibold">{label}</p>
      <div className="min-h-20 px-2 py-2">{children}</div>
    </div>
  )
}

export function ApplicationPrintDocument({ workspace }: { workspace: FormWorkspaceResponse }) {
  const { applicant, period, category, schema, answers, application } = workspace
  const profile = workspace.period_profile as Record<string, unknown>
  const identityTypes = Array.isArray(profile.application_identity_types)
    ? profile.application_identity_types.map((code) => identityTypeLabel(String(code)))
    : []
  const fieldState = evaluateRules(schema, answers)
  const sections = schema.sections
    .filter((section) => section.visible && section.pdf_visible)
    .map((section) => ({
      ...section,
      fields: section.fields.filter(
        (field) =>
          field.active &&
          field.pdf_visible &&
          field.field_type !== 'display' &&
          fieldState[field.code]?.visible !== false,
      ),
    }))
    .filter((section) => section.fields.length > 0)

  return (
    <article className="print-document mx-auto bg-white text-black">
      <header className="border-b-2 border-black pb-3 text-center">
        <p className="text-sm">弘愛築夢助學金</p>
        <h1 className="mt-1 text-xl font-bold">
          {period.name}　{category.name} 申請表
        </h1>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
          <span>申請編號：{application.application_number || '尚未送件'}</span>
          <span>
            {application.submitted_at
              ? `送件時間：${formatTaipeiDateTime(application.submitted_at)}`
              : `列印時間：${formatTaipeiDateTime(new Date().toISOString())}`}
          </span>
        </div>
      </header>

      <section className="print-section">
        <h2 className="print-section-title">基本資料</h2>
        <InfoGrid
          items={[
            ['姓名', text(applicant.name)],
            ['學號', text(applicant.student_no)],
            ['身分證字號', text(applicant.identity_number_masked)],
            ['性別', text(applicant.gender)],
            ['部別', text(applicant.division)],
            ['制別', text(applicant.program_type)],
            ['科系', text(applicant.department_name)],
            ['年級', text(profile.grade) || text(applicant.grade)],
            ['連絡電話', text(applicant.phone)],
            ['LINE ID', text(applicant.line_id)],
            ['Email', text(applicant.email)],
          ]}
        />
      </section>

      <section className="print-section">
        <h2 className="print-section-title">申請資格</h2>
        <InfoGrid
          items={[
            ['申請身分', identityTypes.join('、')],
            ['身心障礙級距', text(profile.disability_level)],
            ['弱勢助學金級別', text(profile.weak_aid_level)],
            ['曾申請本助學金', profile.has_applied_before ? '是' : '否'],
            [
              '已建置銀行帳號',
              profile.bank_account_registered ? '是' : `否（${text(profile.bank_account_note) || EMPTY}）`,
            ],
            ['其他特殊情況說明', text(profile.qualification_note)],
          ]}
        />
      </section>

      {sections.map((section) => (
        <section key={section.id} className="print-section">
          <h2 className="print-section-title">{section.title}</h2>
          <table className="print-table">
            <tbody>
              {section.fields.map((field) =>
                FULL_WIDTH_TYPES.has(field.field_type) ? (
                  <tr key={field.id}>
                    <td colSpan={2} className="print-nested">
                      <p className="mb-1.5 font-semibold">{field.label}</p>
                      <FieldValue field={field} value={answers[field.code]} />
                    </td>
                  </tr>
                ) : (
                  <tr key={field.id} className="print-avoid-break">
                    <th scope="row" className="w-36">
                      {field.label}
                    </th>
                    <td>
                      <FieldValue field={field} value={answers[field.code]} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>
      ))}

      <section className="print-section print-avoid-break">
        <h2 className="print-section-title">簽核</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SignatureBox label="申請學生簽名">
            <p className="mt-10 text-xs">日期：　　　年　　月　　日</p>
          </SignatureBox>
          <SignatureBox label="指導老師簽名（若無則免）">
            <p className="mt-10 text-xs">日期：　　　年　　月　　日</p>
          </SignatureBox>
          <div className="col-span-2">
            <SignatureBox label="系輔導老師確認">
              <ul className="space-y-1">
                <li>□ 1. 已檢視學生規劃確實可行</li>
                <li>□ 2. 學生規劃執行期間填寫正確</li>
                <li>□ 3. 學生各項補助金額加總正確</li>
              </ul>
              <p className="mt-3">意見：</p>
              <div className="min-h-16" />
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span>系輔導老師簽名：＿＿＿＿＿＿＿＿＿＿</span>
                <span>日期：　　　年　　月　　日</span>
              </div>
            </SignatureBox>
          </div>
        </div>
      </section>

      <footer className="mt-4 border-t border-black pt-2 text-xs leading-relaxed">
        <p>※ 本申請表經系輔導老師確認簽名後，請送至課指組（毓麟館 H101）才算完成申請。</p>
      </footer>
    </article>
  )
}
