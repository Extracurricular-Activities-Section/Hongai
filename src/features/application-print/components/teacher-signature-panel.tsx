import { CheckCircle2, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Field } from '@/components/common/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTaipeiDateTime } from '@/lib/utils'

import {
  adminGetSignatures,
  adminNotifyTeacher,
  adminSaveTeacherSignature,
  type ApplicationSignatures,
} from '../api'
import { SignaturePad, type SignaturePadHandle } from './signature-pad'

/**
 * Staff view of signatures: shows the student's signature, registers the teacher's signature
 * (canvas or "signed on paper"), sends the teacher notice, and lets staff mark the teacher as signed.
 * Marking runs the existing `mark_teacher_signed` application action via `onMarkSigned`.
 */
export function TeacherSignaturePanel({
  applicationId,
  status,
  disabled = false,
  onMarkSigned,
  onChanged,
}: {
  applicationId: string
  status: string
  disabled?: boolean
  /** Runs the `mark_teacher_signed` action; resolves when the application has been reloaded. */
  onMarkSigned: () => Promise<void>
  onChanged?: () => void
}) {
  const padRef = useRef<SignaturePadHandle>(null)
  const [signatures, setSignatures] = useState<ApplicationSignatures | null>(null)
  const [signerName, setSignerName] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [onPaper, setOnPaper] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await adminGetSignatures(applicationId)
    setSignatures(data.signatures)
    setTeacherEmail((current) => current || data.signatures.teacher_email || '')
    setSignerName((current) => current || data.signatures.teacher?.signer_name || '')
  }, [applicationId])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  async function run(task: () => Promise<string | void>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await task()
      if (result) setMessage(result)
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setBusy(false)
    }
  }

  const student = signatures?.student ?? null
  const teacher = signatures?.teacher ?? null
  const confirmed = teacher?.status === 'confirmed'
  const canMark = status === 'submitted'
  const locked = disabled || busy

  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="signatures-title">
      <h2 id="signatures-title" className="mb-4 text-card font-semibold text-foreground">
        電子簽名
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">學生簽名</p>
            <Badge tone={student ? 'positive' : 'neutral'}>{student ? '已簽名' : '尚未簽名'}</Badge>
          </div>
          {student ? (
            <>
              {student.signature_data_url ? (
                <img
                  src={student.signature_data_url}
                  alt={`${student.signer_name} 的簽名`}
                  className="h-24 w-auto max-w-full rounded-md border border-border bg-white"
                />
              ) : null}
              <p className="text-sm text-subtle">
                {student.signer_name}・{formatTaipeiDateTime(student.signed_at)}
              </p>
              {student.confirmation_text ? (
                <p className="text-meta text-muted-foreground">已勾選：{student.confirmation_text}</p>
              ) : null}
              {student.user_agent ? (
                <p className="break-all text-meta text-muted-foreground">裝置：{student.user_agent}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">學生尚未於系統簽名（可能採紙本簽名）。</p>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">老師簽名</p>
            <Badge tone={confirmed ? 'positive' : teacher ? 'attention' : 'neutral'}>
              {confirmed ? '已簽核' : teacher ? '已登記' : '尚未登記'}
            </Badge>
          </div>
          {teacher ? (
            <>
              {teacher.signature_data_url ? (
                <img
                  src={teacher.signature_data_url}
                  alt={`${teacher.signer_name} 的簽名`}
                  className="h-24 w-auto max-w-full rounded-md border border-border bg-white"
                />
              ) : (
                <p className="text-sm text-subtle">老師已於紙本簽名</p>
              )}
              <p className="text-sm text-subtle">
                {teacher.signer_name}・{formatTaipeiDateTime(teacher.signed_at)}
                {teacher.signer_email ? `・${teacher.signer_email}` : ''}
              </p>
              {confirmed && teacher.confirmed_at ? (
                <p className="flex items-center gap-1.5 text-meta text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  標記簽核於 {formatTaipeiDateTime(teacher.confirmed_at)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">尚未登記老師簽名。</p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">通知導師</p>
          <Field
            id="teacher-notify-email"
            label="導師 email"
            description="優先使用學生表單中的導師 email 欄位；未填時會儲存於案件流程資料。"
          >
            <Input
              id="teacher-notify-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={teacherEmail}
              disabled={locked}
              onChange={(event) => setTeacherEmail(event.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !teacherEmail.trim()}
            onClick={() =>
              void run(async () => (await adminNotifyTeacher(applicationId, teacherEmail.trim())).message)
            }
          >
            <Send />
            寄送通知（站內＋email）
          </Button>
          {signatures?.teacher_notifications[0] ? (
            <p className="text-meta text-muted-foreground">
              最近通知：{formatTaipeiDateTime(signatures.teacher_notifications[0].created)} →{' '}
              {signatures.teacher_notifications[0].email}
              {signatures.teacher_notifications[0].channel_email === 'skipped'
                ? '（郵件未啟用，已略過寄信）'
                : ''}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">登記老師簽名</p>
          <Field id="teacher-signer-name" label="老師姓名" required>
            <Input
              id="teacher-signer-name"
              value={signerName}
              maxLength={60}
              disabled={locked}
              onChange={(event) => setSignerName(event.target.value)}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-accent-strong"
              checked={onPaper}
              disabled={locked}
              onChange={(event) => setOnPaper(event.target.checked)}
            />
            老師已於紙本簽名（不需手寫）
          </label>
          {!onPaper ? (
            <SignaturePad ref={padRef} label="老師簽名區" disabled={locked} onChange={setDataUrl} />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={locked || !signerName.trim() || (!onPaper && !dataUrl)}
              onClick={() =>
                void run(async () => {
                  const result = await adminSaveTeacherSignature(applicationId, {
                    signer_name: signerName.trim(),
                    teacher_email: teacherEmail.trim() || undefined,
                    signature_data_url: onPaper ? undefined : (dataUrl ?? undefined),
                    signed_on_paper: onPaper,
                  })
                  padRef.current?.clear()
                  return result.message
                })
              }
            >
              登記老師簽名
            </Button>
            {canMark ? (
              <Button
                type="button"
                variant="brand"
                disabled={locked}
                onClick={() => void run(onMarkSigned)}
              >
                標記老師已簽核
              </Button>
            ) : null}
          </div>
          {!canMark && !confirmed ? (
            <p className="text-meta text-muted-foreground">
              僅「已送件」狀態可標記老師已簽核（目前：{status}）。
            </p>
          ) : null}
        </div>
      </div>

      {message ? (
        <p role="status" className="mt-4 text-sm font-medium text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}
