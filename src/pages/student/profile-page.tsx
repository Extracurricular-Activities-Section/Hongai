import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchStudentMe, updateStudentProfile } from '@/features/auth/student/api'
import { useStudentAuth } from '@/features/auth/student/context'
import {
  studentProfileUpdateSchema,
  type StudentProfileUpdateInput,
} from '@/lib/validation'

export function StudentProfilePage() {
  const { studentNo } = useStudentAuth()
  const [identityNumber, setIdentityNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<StudentProfileUpdateInput>({
    resolver: zodResolver(studentProfileUpdateSchema),
    defaultValues: {
      name: '',
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const me = await fetchStudentMe()
        if (cancelled) return
        setIdentityNumber(me.profile.identity_number)
        form.reset({
          name: me.profile.name,
          gender: me.profile.gender ?? 'male',
          division: me.profile.division ?? '',
          program_type: me.profile.program_type ?? '',
          grade: me.profile.grade,
          department_name: me.profile.department_name,
          phone: me.profile.phone,
          line_id: me.profile.line_id ?? '',
          email: me.profile.email,
          bank_account_registered: me.profile.bank_account_registered,
          bank_account_note: me.profile.bank_account_note ?? '',
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '無法載入資料')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form])

  async function onSubmit(values: StudentProfileUpdateInput) {
    setMessage(null)
    setError(null)
    try {
      await updateStudentProfile(values)
      setMessage('資料已更新。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '資料更新失敗，請稍後再試。')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">載入中…</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>學生共用資料</CardTitle>
        <CardDescription>學號與身分證件號碼為核心身分資料，不可自行修改。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label>學號（唯讀）</Label>
            <Input value={studentNo ?? ''} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>完整身分證件號碼（唯讀）</Label>
            <Input value={identityNumber} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label>姓名</Label>
            <Input disabled={submitting} {...form.register('name')} />
          </div>
          <div className="space-y-2">
            <Label>性別</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={submitting}
              {...form.register('gender')}
            >
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>部別</Label>
            <Input disabled={submitting} {...form.register('division')} />
          </div>
          <div className="space-y-2">
            <Label>制別</Label>
            <Input disabled={submitting} {...form.register('program_type')} />
          </div>
          <div className="space-y-2">
            <Label>年級</Label>
            <Input disabled={submitting} {...form.register('grade')} />
          </div>
          <div className="space-y-2">
            <Label>科系</Label>
            <Input disabled={submitting} {...form.register('department_name')} />
          </div>
          <div className="space-y-2">
            <Label>電話</Label>
            <Input disabled={submitting} {...form.register('phone')} />
          </div>
          <div className="space-y-2">
            <Label>LINE ID</Label>
            <Input disabled={submitting} {...form.register('line_id')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email</Label>
            <Input type="email" disabled={submitting} {...form.register('email')} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>銀行 / 郵局帳戶狀態</Label>
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
                    已建立
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={field.value === false}
                      onChange={() => field.onChange(false)}
                      disabled={submitting}
                    />
                    尚未建立
                  </label>
                </div>
              )}
            />
          </div>

          {!bankRegistered ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>銀行帳戶說明</Label>
              <Input disabled={submitting} {...form.register('bank_account_note')} />
            </div>
          ) : null}

          {message ? <p className="text-sm text-foreground sm:col-span-2">{message}</p> : null}
          {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? '儲存中…' : '儲存變更'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
