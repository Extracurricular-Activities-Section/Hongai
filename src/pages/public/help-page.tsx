import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitIdentityReset } from '@/features/admin/api/identity-reset-public-api'
import { identityResetSchema, type IdentityResetInput } from '@/lib/validation'

export function HelpPage() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim()
  const supportPhone = import.meta.env.VITE_SUPPORT_PHONE?.trim()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<IdentityResetInput>({
    resolver: zodResolver(identityResetSchema),
    defaultValues: {
      name: '',
      student_no: '',
      email: '',
      phone: '',
      reason: '',
    },
  })

  const submitting = form.formState.isSubmitting

  async function onSubmit(values: IdentityResetInput) {
    setError(null)
    setMessage(null)
    try {
      const result = await submitIdentityReset(values)
      setMessage(result)
      form.reset()
    } catch {
      setError('送出失敗，請稍後再試。')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>聯絡承辦</CardTitle>
          <CardDescription>無法登入或需人工協助時，請洽弘愛築夢承辦單位。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {supportEmail ? <p>Email：{supportEmail}</p> : null}
          {supportPhone ? <p>電話：{supportPhone}</p> : null}
          {!supportEmail && !supportPhone ? (
            <p>如無法登入，請洽弘愛築夢承辦單位。</p>
          ) : null}
          <p>
            <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">
              返回登入
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>身分重設申請</CardTitle>
          <CardDescription>提交後由承辦人員核對資料並協助處理。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input disabled={submitting} {...form.register('name')} />
            </div>
            <div className="space-y-2">
              <Label>學號</Label>
              <Input disabled={submitting} {...form.register('student_no')} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" disabled={submitting} {...form.register('email')} />
            </div>
            <div className="space-y-2">
              <Label>電話</Label>
              <Input disabled={submitting} {...form.register('phone')} />
            </div>
            <div className="space-y-2">
              <Label>原因</Label>
              <Input disabled={submitting} {...form.register('reason')} />
            </div>
            {message ? <p className="text-sm text-foreground">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? '送出中…' : '送出申請'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
