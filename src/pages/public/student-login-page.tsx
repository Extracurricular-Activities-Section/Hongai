import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>弘愛築夢申請管理系統</CardTitle>
          <CardDescription>學生登入</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="student-id">學號</Label>
              <Input
                id="student-id"
                autoComplete="username"
                placeholder="請輸入學號"
                disabled={submitting}
                {...form.register('student_no')}
              />
              {form.formState.errors.student_no ? (
                <p className="text-xs text-red-700">{form.formState.errors.student_no.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="id-last4">身分證後四碼</Label>
              <Input
                id="id-last4"
                type="password"
                inputMode="text"
                maxLength={4}
                autoComplete="off"
                placeholder="請輸入後四碼"
                disabled={submitting}
                {...form.register('identity_last4')}
              />
              {form.formState.errors.identity_last4 ? (
                <p className="text-xs text-red-700">{form.formState.errors.identity_last4.message}</p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '登入中…' : '登入'}
            </Button>
          </form>

          <div className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
            <p>
              第一次使用？{' '}
              <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                首次註冊
              </Link>
            </p>
            <p>
              無法登入？{' '}
              <Link to="/help" className="font-medium text-primary underline-offset-4 hover:underline">
                登入協助
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
