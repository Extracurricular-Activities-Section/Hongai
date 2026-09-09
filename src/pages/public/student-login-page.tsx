import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthCard } from '@/components/common/auth-card'
import { Field } from '@/components/common/field'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginStudent } from '@/features/auth/student/api'
import { useStudentAuth } from '@/features/auth/student/context'
import { studentLoginSchema, type StudentLoginInput } from '@/lib/validation'

export function StudentLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, ready } = useStudentAuth()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<StudentLoginInput>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: { student_no: '', identity_last4: '' },
  })

  if (ready && isAuthenticated) {
    return <Navigate to="/student" replace />
  }

  async function onSubmit(values: StudentLoginInput) {
    setError(null)
    try {
      await loginStudent(values)
      navigate('/student', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗，請確認資料後再試。')
    }
  }

  const submitting = form.formState.isSubmitting

  return (
    <AuthCard
      title="學生登入"
      description="使用學號與身分證後四碼登入，即可填寫申請、上傳文件並追蹤審核進度。"
      footer={
        <div className="space-y-2">
          <p>
            第一次使用？{' '}
            <Link
              to="/register"
              className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
            >
              首次註冊
            </Link>
          </p>
          <p>
            無法登入？{' '}
            <Link
              to="/help"
              className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
            >
              登入協助
            </Link>
          </p>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field id="student-id" label="學號" error={form.formState.errors.student_no?.message}>
          <Input
            id="student-id"
            autoComplete="username"
            inputMode="numeric"
            placeholder="請輸入學號"
            disabled={submitting}
            aria-invalid={form.formState.errors.student_no ? true : undefined}
            {...form.register('student_no')}
          />
        </Field>

        <Field
          id="id-last4"
          label="身分證後四碼"
          error={form.formState.errors.identity_last4?.message}
        >
          <Input
            id="id-last4"
            type="password"
            inputMode="text"
            maxLength={4}
            autoComplete="off"
            placeholder="請輸入後四碼"
            disabled={submitting}
            aria-invalid={form.formState.errors.identity_last4 ? true : undefined}
            {...form.register('identity_last4')}
          />
        </Field>

        {error ? <ErrorState title="無法登入" message={error} /> : null}

        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={submitting}>
          {submitting ? '登入中…' : '登入'}
        </Button>
      </form>
    </AuthCard>
  )
}
