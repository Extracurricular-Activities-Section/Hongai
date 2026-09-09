import { z } from 'zod'

export const studentNoSchema = z
  .string()
  .trim()
  .min(1, '請輸入學號')
  .max(32, '學號過長')

export const phoneSchema = z
  .string()
  .trim()
  .min(8, '請輸入有效電話')
  .max(20, '電話過長')

export const emailSchema = z.string().trim().email('請輸入有效 Email')

export const identityLast4Schema = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z]{4}$/, '請輸入 4 碼')

/** Accept national ID / residence permit / other legal IDs — length only. */
export const identityNumberSchema = z
  .string()
  .trim()
  .min(4, '身分證件號碼過短')
  .max(32, '身分證件號碼過長')
  .transform((value) => value.toUpperCase())

export const studentLoginSchema = z.object({
  student_no: studentNoSchema,
  identity_last4: identityLast4Schema,
})

export const studentRegisterSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入姓名'),
    student_no: studentNoSchema,
    identity_number: identityNumberSchema,
    gender: z.enum(['male', 'female', 'other'], { message: '請選擇性別' }),
    division: z.string().trim().min(1, '請輸入部別'),
    program_type: z.string().trim().min(1, '請輸入制別'),
    grade: z.string().trim().min(1, '請輸入年級'),
    department_name: z.string().trim().min(1, '請輸入科系'),
    phone: phoneSchema,
    line_id: z.string().trim().optional(),
    email: emailSchema,
    bank_account_registered: z.boolean(),
    bank_account_note: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.bank_account_registered && !value.bank_account_note) {
      ctx.addIssue({
        code: 'custom',
        message: '請說明無法提供銀行 / 郵局帳號原因',
        path: ['bank_account_note'],
      })
    }
  })

export const studentProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入姓名'),
    gender: z.enum(['male', 'female', 'other']).optional(),
    division: z.string().trim().optional(),
    program_type: z.string().trim().optional(),
    grade: z.string().trim().min(1, '請輸入年級'),
    department_name: z.string().trim().min(1, '請輸入科系'),
    phone: phoneSchema,
    line_id: z.string().trim().optional(),
    email: emailSchema,
    bank_account_registered: z.boolean(),
    bank_account_note: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.bank_account_registered && !value.bank_account_note) {
      ctx.addIssue({
        code: 'custom',
        message: '請說明無法提供銀行 / 郵局帳號原因',
        path: ['bank_account_note'],
      })
    }
  })

export const staffLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '請輸入密碼'),
})

export const identityResetSchema = z.object({
  name: z.string().trim().min(1, '請輸入姓名'),
  student_no: studentNoSchema,
  email: emailSchema,
  phone: phoneSchema,
  reason: z.string().trim().min(1, '請輸入原因'),
})

export const applicationPeriodSchema = z
  .object({
    name: z.string().trim().min(1),
    academic_year: z.number().int().positive(),
    semester: z.enum(['1', '2']),
    start_at: z.string().min(1),
    end_at: z.string().min(1),
    status: z.enum(['draft', 'scheduled', 'open', 'closed', 'archived']),
    active: z.boolean().default(true),
    sort_order: z.number().int().default(0),
    description: z.string().optional(),
    min_application_count: z.number().int().positive().default(2),
    min_application_rule: z.enum(['warning_only', 'enforced']).default('warning_only'),
  })
  .superRefine((value, ctx) => {
    const start = Date.parse(value.start_at)
    const end = Date.parse(value.end_at)
    if (Number.isNaN(start) || Number.isNaN(end)) {
      ctx.addIssue({ code: 'custom', message: '申請期間日期格式無效', path: ['start_at'] })
      return
    }
    if (start >= end) {
      ctx.addIssue({ code: 'custom', message: '開始時間必須早於結束時間', path: ['end_at'] })
    }
  })

export type StudentLoginInput = z.infer<typeof studentLoginSchema>
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>
export type StudentProfileUpdateInput = z.infer<typeof studentProfileUpdateSchema>
export type StaffLoginInput = z.infer<typeof staffLoginSchema>
export type IdentityResetInput = z.infer<typeof identityResetSchema>
