import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildDocumentNumber, createVerificationToken, generateHadApplicationPdf } from './generate.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(root, '../test-output')
mkdirSync(outDir, { recursive: true })

const sampleSnapshot = {
  formVersion: { id: 'fv1', version_number: 1 },
  answers: {
    goal: '提升英語能力並通過檢定',
    exam_item: 'TOEIC',
    living_expense: 3000,
    exam_registration_fee: 1600,
    requested_items: [{ item_name: '教材費', amount: 1000 }],
    monthly_plan: { 9: '單字與聽力', 10: '模擬考', 11: '複習' },
    training_start: '2026-09-01',
    training_end: '2026-11-30',
    requested_total: 5600,
    training_months: 2,
  },
  computed: {
    goal: '提升英語能力並通過檢定',
    exam_item: 'TOEIC',
    living_expense: 3000,
    exam_registration_fee: 1600,
    requested_items: [{ item_name: '教材費', amount: 1000 }],
    monthly_plan: { 9: '單字與聽力', 10: '模擬考', 11: '複習' },
    training_start: '2026-09-01',
    training_end: '2026-11-30',
    requested_total: 5600,
    training_months: 2,
  },
  studentProfileSnapshot: {
    name: '測試學生',
    student_no: 'U0000000',
    identity_number: 'A000000000',
    gender: 'other',
    division: '日間部',
    program_type: '四技',
    grade: '3',
    department_name: '測試科系',
    phone: '0912000000',
    line_id: 'test-line',
    email: 'test@example.edu',
  },
  periodProfileSnapshot: {
    grade: '3',
    application_identity_types: ['low_income'],
    disability_level: null,
    weak_aid_level: null,
    has_applied_before: false,
    bank_account_registered: true,
    bank_account_note: null,
    qualification_note: null,
  },
  period: {
    name: '115學年度第一學期 弘愛築夢',
    academic_year: 115,
    semester: '1',
  },
  category: {
    id: 'cat1',
    code: 'language_certification',
    name: '外語檢定',
  },
  schema: {
    sections: [
      {
        code: 'language_plan',
        title: '外語檢定規劃內容',
        pdf_visible: true,
        fields: [
          { code: 'goal', label: '目標', field_type: 'textarea', active: true, pdf_visible: true },
          { code: 'exam_item', label: '報考考試項目', field_type: 'text', active: true, pdf_visible: true },
          {
            code: 'requested_items',
            label: '希望補助項目',
            field_type: 'repeat_group',
            active: true,
            pdf_visible: true,
            config: {
              columns: [
                { code: 'item_name', label: '項目名稱', field_type: 'text' },
                { code: 'amount', label: '金額', field_type: 'currency' },
              ],
            },
          },
        ],
      },
      {
        code: 'execution',
        title: '執行期程與補助金額',
        pdf_visible: true,
        fields: [
          {
            code: 'living_expense',
            label: '生活補助費用',
            field_type: 'currency',
            active: true,
            pdf_visible: true,
          },
          {
            code: 'exam_registration_fee',
            label: '報名費用',
            field_type: 'currency',
            active: true,
            pdf_visible: true,
          },
          {
            code: 'requested_total',
            label: '希望補助總金額',
            field_type: 'computed',
            active: true,
            pdf_visible: true,
          },
        ],
      },
      {
        code: 'monthly',
        title: '月份安排',
        pdf_visible: true,
        fields: [
          {
            code: 'monthly_plan',
            label: '月份規劃',
            field_type: 'monthly_plan',
            active: true,
            pdf_visible: true,
            config: { months: [9, 10, 11] },
          },
        ],
      },
    ],
  },
  timestamps: { completed_at: '2026-09-10T10:00:00.000Z' },
}

const documentNumber = buildDocumentNumber({
  academicYear: 115,
  semester: '1',
  categoryCode: 'language_certification',
  serial: 1,
})
const token = createVerificationToken()

const result = await generateHadApplicationPdf({
  snapshot: sampleSnapshot,
  schema: sampleSnapshot.schema,
  documentNumber,
  documentVersion: 1,
  verificationUrl: `https://example.invalid/verify/${token}`,
})

const outFile = path.join(outDir, `${documentNumber}-V1.pdf`)
writeFileSync(outFile, result.bytes)
console.log(
  JSON.stringify(
    {
      ok: true,
      outFile,
      sha256: result.sha256,
      pageCount: result.pageCount,
      fontPath: result.fontPath,
      documentNumber,
    },
    null,
    2,
  ),
)
