import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { AuthCard } from '@/components/common/auth-card'
import { Field } from '@/components/common/field'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginStaff } from '@/features/auth/backoffice/api'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { staffLoginSchema, type StaffLoginInput } from '@/lib/validation'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, ready } = useBackofficeAuth()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<StaffLoginInput>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (ready && isAuthenticated) {
    return <Navigate to="/admin" replace />
  }

  async function onSubmit(values: StaffLoginInput) {
    setError(null)
    try {
      await loginStaff(values)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗，請確認資料後再試。')
    }
  }

  const submitting = form.formState.isSubmitting

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-8 flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-md bg-ink text-sm font-bold text-ink-foreground"
          >
            弘
          </span>
          <div>
            <p className="text-sm font-semibold">弘愛築夢管理系統</p>
            <p className="text-[0.6875rem] text-muted-foreground">承辦／管理員入口</p>
          </div>
        </div>

        <AuthCard
          title="管理系統登入"
          description="承辦與管理員專用入口，與學生申請系統完全分離。"
          footer={
            <Link
              to="/"
              className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
            >
              返回學生登入
            </Link>
          }
        >
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <Field id="admin-email" label="電子郵件" error={form.formState.errors.email?.message}>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="name@example.edu.tw"
                disabled={submitting}
                aria-invalid={form.formState.errors.email ? true : undefined}
                {...form.register('email')}
              />
            </Field>

            <Field id="admin-password" label="密碼" error={form.formState.errors.password?.message}>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                disabled={submitting}
                aria-invalid={form.formState.errors.password ? true : undefined}
                {...form.register('password')}
              />
            </Field>

            {error ? <ErrorState title="無法登入" message={error} /> : null}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? '登入中…' : '登入'}
            </Button>
          </form>
        </AuthCard>
      </div>
    </div>
  )
}
