import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  APPLICATION_IDENTITY_TYPES,
  needsDisabilityLevel,
  needsQualificationNote,
  needsWeakAidLevel,
} from '@/features/periods/constants/eligibility'
import {
  confirmPeriodProfile,
  fetchPeriodBootstrap,
  type PeriodBootstrapResponse,
} from '@/features/periods/api'
import { formatTaipeiDateTime } from '@/lib/utils'

const schema = z
  .object({
    grade: z.string().trim().min(1, '請填寫年級'),
    application_identity_types: z.array(z.string()),
    disability_level: z.string().optional(),
    weak_aid_level: z.string().optional(),
    bank_account_registered: z.boolean(),
    bank_account_note: z.string().optional(),
    qualification_note: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.bank_account_registered && !value.bank_account_note?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: '請說明無法提供銀行帳號原因',
        path: ['bank_account_note'],
      })
    }
    if (needsQualificationNote(value.application_identity_types) && !value.qualification_note?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: '請填寫其他特殊情況說明',
        path: ['qualification_note'],
      })
    }
  })

type FormValues = z.infer<typeof schema>

export function StudentCurrentConfirmPage() {
  const navigate = useNavigate()
  const [boot, setBoot] = useState<PeriodBootstrapResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'choose' | 'form'>('form')
  const [copiedFromPrevious, setCopiedFromPrevious] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      grade: '',
      application_identity_types: [],
      disability_level: '',
      weak_aid_level: '',
      bank_account_registered: true,
      bank_account_note: '',
      qualification_note: '',
    },
  })

  const types = form.watch('application_identity_types')
  const bankRegistered = form.watch('bank_account_registered')
  const submitting = form.formState.isSubmitting

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchPeriodBootstrap()
        if (cancelled) return
        setBoot(data)
        if (data.existing_profile?.confirmed_at) {
          navigate('/student/current', { replace: true })
          return
        }
        if (data.previous_profile && !data.existing_profile) {
          setMode('choose')
        }
        form.reset({
          grade: data.existing_profile?.grade || data.defaults.grade || '',
          application_identity_types: data.existing_profile?.application_identity_types || [],
          disability_level: data.existing_profile?.disability_level || '',
          weak_aid_level: data.existing_profile?.weak_aid_level || '',
          bank_account_registered:
            data.existing_profile?.bank_account_registered ?? data.defaults.bank_account_registered,
          bank_account_note:
            data.existing_profile?.bank_account_note || data.defaults.bank_account_note || '',
          qualification_note: data.existing_profile?.qualification_note || '',
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form, navigate])

  const hasAppliedLabel = useMemo(() => {
    if (!boot) return '—'
    return boot.defaults.has_applied_before ? '是（系統依歷史紀錄判定）' : '否'
  }, [boot])

  function applyPrevious() {
    if (!boot?.previous_profile) return
    const prev = boot.previous_profile
    form.reset({
      grade: prev.grade || boot.defaults.grade || '',
      application_identity_types: prev.application_identity_types || [],
      disability_level: prev.disability_level || '',
      weak_aid_level: prev.weak_aid_level || '',
      bank_account_registered: prev.bank_account_registered,
      bank_account_note: prev.bank_account_note || '',
      qualification_note: prev.qualification_note || '',
    })
    setCopiedFromPrevious(true)
    setMode('form')
  }

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      await confirmPeriodProfile({
        ...values,
        copy_from_previous: copiedFromPrevious,
      })
      navigate('/student/current', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '確認失敗')
    }
  }

  if (error && !boot) {
    return <p className="text-sm font-medium text-danger">{error}</p>
  }
  if (!boot) return <PageSkeleton />

  if (mode === 'choose' && boot.previous_period && boot.previous_profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>偵測到上一期申請資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            上一期：{boot.previous_period.name}（
            {formatTaipeiDateTime(boot.previous_period.start_at)}）
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={applyPrevious}>
              套用上一期資料
            </Button>
            <Button type="button" variant="outline" onClick={() => setMode('form')}>
              重新填寫
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>本學期申請資料確認</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <p className="text-sm text-muted-foreground">{boot.period.name}</p>

          <div className="space-y-2">
            <Label>年級</Label>
            <Input disabled={submitting} {...form.register('grade')} />
          </div>

          <div className="space-y-2">
            <Label>申請身分（可多選）</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {APPLICATION_IDENTITY_TYPES.map((item) => (
                <Controller
                  key={item.code}
                  control={form.control}
                  name="application_identity_types"
                  render={({ field }) => {
                    const checked = field.value.includes(item.code)
                    return (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={submitting}
                          onChange={(event) => {
                            if (event.target.checked) {
                              field.onChange([...field.value, item.code])
                            } else {
                              field.onChange(field.value.filter((code) => code !== item.code))
                            }
                          }}
                        />
                        {item.label}
                      </label>
                    )
                  }}
                />
              ))}
            </div>
          </div>

          {needsDisabilityLevel(types) ? (
            <div className="space-y-2">
              <Label>身心障礙級距</Label>
              <Input disabled={submitting} {...form.register('disability_level')} />
            </div>
          ) : null}

          {needsWeakAidLevel(types) ? (
            <div className="space-y-2">
              <Label>弱勢助學金級距</Label>
              <Input disabled={submitting} {...form.register('weak_aid_level')} />
            </div>
          ) : null}

          <div className="space-y-1 text-sm">
            <Label>曾經申請弘愛築夢</Label>
            <p>{hasAppliedLabel}</p>
          </div>

          <div className="space-y-2">
            <Label>銀行 / 郵局帳號已建置</Label>
            <Controller
              control={form.control}
              name="bank_account_registered"
              render={({ field }) => (
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={field.value}
                      disabled={submitting}
                      onChange={() => field.onChange(true)}
                    />
                    是
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!field.value}
                      disabled={submitting}
                      onChange={() => field.onChange(false)}
                    />
                    否
                  </label>
                </div>
              )}
            />
          </div>

          {!bankRegistered ? (
            <div className="space-y-2">
              <Label>無法提供銀行帳號原因</Label>
              <Input disabled={submitting} {...form.register('bank_account_note')} />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>資格說明{needsQualificationNote(types) ? '（必填）' : '（選填）'}</Label>
            <Input disabled={submitting} {...form.register('qualification_note')} />
            {form.formState.errors.qualification_note ? (
              <p className="text-meta font-medium text-danger">
                {form.formState.errors.qualification_note.message}
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? '確認中…' : '確認本學期資料'}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/student">取消</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
