import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerStudent } from '@/features/auth/student/api'
import { useStudentAuth } from '@/features/auth/student/context'
import { cn } from '@/lib/utils'
import { studentRegisterSchema, type StudentRegisterInput } from '@/lib/validation'

export function RegisterPage() {
  const navigate = useNavigate()
  const { isAuthenticated, ready } = useStudentAuth()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<StudentRegisterInput>({
    resolver: zodResolver(studentRegisterSchema),
    defaultValues: {
      name: '',
      student_no: '',
      identity_number: '',
      gender: 'male',
      division: '',
      program_type: '',
      grade: '',
      department_name: '',
      phone: '',
      line_id: '',
      email: '',
      bank_account_registered: true,
      bank_account_note: '',
    },
  })

  const bankRegistered = form.watch('bank_account_registered')
  const submitting = form.formState.isSubmitting

  if (ready && isAuthenticated) {
    return <Navigate to="/student" replace />
  }

  async function onSubmit(values: StudentRegisterInput) {
    setError(null)
    try {
      await registerStudent(values)
      navigate('/student', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗，請稍後再試或聯絡承辦。')
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>學生首次註冊</CardTitle>
          <CardDescription>建立共用資料後，之後以學號 + 身分證後四碼登入。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <Field label="姓名" error={form.formState.errors.name?.message}>
              <Input disabled={submitting} {...form.register('name')} />
            </Field>
            <Field label="學號" error={form.formState.errors.student_no?.message}>
              <Input disabled={submitting} {...form.register('student_no')} />
            </Field>
            <Field label="完整身分證件號碼" error={form.formState.errors.identity_number?.message} className="sm:col-span-2">
              <Input disabled={submitting} autoComplete="off" {...form.register('identity_number')} />
            </Field>
            <Field label="性別" error={form.formState.errors.gender?.message}>
              <select
                className={selectClass}
                disabled={submitting}
                {...form.register('gender')}
              >
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </Field>
            <Field label="部別" error={form.formState.errors.division?.message}>
              <Input disabled={submitting} placeholder="例：日間部" {...form.register('division')} />
            </Field>
            <Field label="制別" error={form.formState.errors.program_type?.message}>
              <Input disabled={submitting} placeholder="例：四技" {...form.register('program_type')} />
            </Field>
            <Field label="年級" error={form.formState.errors.grade?.message}>
              <Input disabled={submitting} {...form.register('grade')} />
            </Field>
            <Field label="科系" error={form.formState.errors.department_name?.message} className="sm:col-span-2">
              <Input disabled={submitting} {...form.register('department_name')} />
            </Field>
            <Field label="聯絡電話" error={form.formState.errors.phone?.message}>
              <Input disabled={submitting} {...form.register('phone')} />
            </Field>
            <Field label="LINE ID" error={form.formState.errors.line_id?.message}>
              <Input disabled={submitting} {...form.register('line_id')} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message} className="sm:col-span-2">
              <Input type="email" disabled={submitting} {...form.register('email')} />
            </Field>

            <div className="space-y-2 sm:col-span-2">
              <Label>銀行 / 郵局帳號是否已於學生系統建立</Label>
              <Controller
                control={form.control}
                name="bank_account_registered"
                render={({ field }) => (
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={field.value === true}
                        onChange={() => field.onChange(true)}
                        disabled={submitting}
                      />
                      是
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={field.value === false}
                        onChange={() => field.onChange(false)}
                        disabled={submitting}
                      />
                      否
                    </label>
                  </div>
                )}
              />
            </div>

            {!bankRegistered ? (
              <Field
                label="請說明無法提供銀行 / 郵局帳號原因"
                error={form.formState.errors.bank_account_note?.message}
                className="sm:col-span-2"
              >
                <Input disabled={submitting} {...form.register('bank_account_note')} />
              </Field>
            ) : null}

            {error ? <p className="text-sm font-medium text-danger sm:col-span-2">{error}</p> : null}

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                返回登入
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? '送出中…' : '完成註冊'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-meta font-medium text-danger">{error}</p> : null}
    </div>
  )
}
