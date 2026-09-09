import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>管理後台登入</CardTitle>
          <CardDescription>承辦 / 管理員專用（與學生登入分離）</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                disabled={submitting}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-red-700">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                disabled={submitting}
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-red-700">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '登入中…' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-5 text-sm">
            <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
              返回學生登入
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
