import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Phone } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

import { Field } from '@/components/common/field'
import { ErrorState, InlineNotice } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
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
    <div className="mx-auto w-full max-w-md space-y-9">
      <section>
        <h1 className="text-page font-semibold text-foreground">登入協助</h1>
        <p className="mt-2 text-sm leading-relaxed text-subtle">
          無法登入或資料有誤時，可先聯絡承辦單位；若需重設身分驗證資料，請填寫下方表單。
        </p>

        <div className="mt-5 space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          {supportEmail ? (
            <p className="flex items-center gap-2 text-foreground">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              <a
                href={`mailto:${supportEmail}`}
                className="rounded-sm underline underline-offset-4 hover:text-accent-strong"
              >
                {supportEmail}
              </a>
            </p>
          ) : null}
          {supportPhone ? (
            <p className="flex items-center gap-2 text-foreground">
              <Phone className="size-4 text-muted-foreground" aria-hidden />
              {supportPhone}
            </p>
          ) : null}
          {!supportEmail && !supportPhone ? (
            <p className="text-subtle">如無法登入，請洽弘愛築夢承辦單位。</p>
          ) : null}
        </div>

        <p className="mt-4 text-sm">
          <Link
            to="/faq"
            className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
          >
            常見問題
          </Link>
        </p>

        <p className="mt-2 text-sm">
          <Link
            to="/"
            className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
          >
            返回登入
          </Link>
        </p>
      </section>

      <section className="border-t border-border pt-8">
        <h2 className="text-section font-semibold text-foreground">身分重設申請</h2>
        <p className="mt-1.5 text-sm text-subtle">提交後由承辦人員核對資料並協助處理。</p>

        <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Field id="help-name" label="姓名" error={form.formState.errors.name?.message}>
            <Input id="help-name" disabled={submitting} {...form.register('name')} />
          </Field>
          <Field id="help-student-no" label="學號" error={form.formState.errors.student_no?.message}>
            <Input id="help-student-no" disabled={submitting} {...form.register('student_no')} />
          </Field>
          <Field id="help-email" label="Email" error={form.formState.errors.email?.message}>
            <Input id="help-email" type="email" disabled={submitting} {...form.register('email')} />
          </Field>
          <Field id="help-phone" label="電話" error={form.formState.errors.phone?.message}>
            <Input id="help-phone" type="tel" disabled={submitting} {...form.register('phone')} />
          </Field>
          <Field id="help-reason" label="原因" error={form.formState.errors.reason?.message}>
            <Textarea id="help-reason" disabled={submitting} {...form.register('reason')} />
          </Field>

          {message ? <InlineNotice tone="positive">{message}</InlineNotice> : null}
          {error ? <ErrorState message={error} /> : null}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? '送出中…' : '送出申請'}
          </Button>
        </form>
      </section>
    </div>
  )
}
