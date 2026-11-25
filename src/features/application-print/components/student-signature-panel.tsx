import { CheckCircle2, PenLine, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Field } from '@/components/common/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTaipeiDateTime } from '@/lib/utils'

import {
  getMySignatures,
  saveStudentSignature,
  studentNotifyTeacher,
  type ApplicationSignatures,
} from '../api'
import { SignaturePad, type SignaturePadHandle } from './signature-pad'

const CONFIRMATION_TEXT = '本人確認以上資料屬實'

/**
 * Student e-signature + attestation, shown beside the print / submit step.
 * Saved to application.workflow_json.signatures.student (signed_at / signer_name / user_agent).
 */
export function StudentSignaturePanel({
  applicationId,
  submitted,
}: {
  applicationId: string
  /** The application has been sent to the office; enables the teacher notice. */
  submitted: boolean
}) {
  const padRef = useRef<SignaturePadHandle>(null)
  const [signatures, setSignatures] = useState<ApplicationSignatures | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [resigning, setResigning] = useState(false)
  const [teacherEmail, setTeacherEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await getMySignatures(applicationId)
    setSignatures(data.signatures)
    setSignerName((current) => current || data.signatures.student?.signer_name || data.default_signer_name)
    setTeacherEmail((current) => current || data.teacher_email || '')
    setLoaded(true)
  }, [applicationId])

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : '載入失敗')
      setLoaded(true)
    })
  }, [load])

  const signed = signatures?.student ?? null
  const showForm = !signed || resigning
  const teacherSigned = signatures?.teacher?.status === 'confirmed'

  async function handleSave() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (!dataUrl) throw new Error('請先簽名')
      if (!signerName.trim()) throw new Error('請填寫簽署人姓名')
      if (!confirmed) throw new Error(`請勾選「${CONFIRMATION_TEXT}」`)
      const result = await saveStudentSignature(applicationId, {
        signer_name: signerName.trim(),
        signature_data_url: dataUrl,
        confirmed: true,
      })
      setSignatures(result.signatures)
      setMessage(result.message)
      setResigning(false)
      setConfirmed(false)
      setDataUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '簽名儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleNotifyTeacher() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await studentNotifyTeacher(applicationId, teacherEmail.trim() || undefined)
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '通知導師失敗')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">載入簽名資料…</p>

  const lastNotice = signatures?.teacher_notifications[0]

  return (
    <section className="rounded-lg border border-border bg-card" aria-labelledby="student-signature-title">
      <header className="border-b border-border px-5 py-4">
        <h2 id="student-signature-title" className="text-card font-semibold text-foreground">
          學生簽名
        </h2>
        <p className="mt-1 text-sm text-subtle">
          請於下方簽名並勾選確認。簽名會記錄簽署時間與裝置資訊，列印申請表時可作為學生確認依據。
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        {signed ? (
          <div className="space-y-3 rounded-md border border-border bg-surface-muted/50 p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              已簽名：{signed.signer_name}
              <span className="text-meta font-normal text-muted-foreground">
                {formatTaipeiDateTime(signed.signed_at)}
              </span>
            </p>
            {signed.signature_data_url ? (
              <img
                src={signed.signature_data_url}
                alt={`${signed.signer_name} 的簽名`}
                className="h-24 w-auto max-w-full rounded-md border border-border bg-white"
              />
            ) : null}
            {!resigning ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setResigning(true)}>
                <PenLine />
                重新簽名
              </Button>
            ) : null}
          </div>
        ) : null}

        {showForm ? (
          <div className="space-y-4">
            <Field id="signature-signer-name" label="簽署人姓名" required>
              <Input
                id="signature-signer-name"
                value={signerName}
                maxLength={60}
                disabled={busy}
                onChange={(event) => setSignerName(event.target.value)}
              />
            </Field>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                手寫簽名<span className="ml-1 text-danger" aria-hidden>*</span>
                <span className="sr-only">（必填）</span>
              </p>
              <SignaturePad ref={padRef} label="學生簽名區" disabled={busy} onChange={setDataUrl} />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-accent-strong"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>{CONFIRMATION_TEXT}</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="brand"
                disabled={busy || !dataUrl || !confirmed || !signerName.trim()}
                onClick={() => void handleSave()}
              >
                {busy ? '儲存中…' : '儲存簽名'}
              </Button>
              {resigning ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setResigning(false)
                    padRef.current?.clear()
                  }}
                >
                  取消重簽
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {signed ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">通知導師簽核</p>
            {teacherSigned ? (
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" aria-hidden />
                導師已完成簽核
              </p>
            ) : (
              <>
                <Field
                  id="signature-teacher-email"
                  label="導師 email"
                  description="系統會寄出簽核提醒；若郵件尚未啟用，僅記錄並送出站內通知。"
                >
                  <Input
                    id="signature-teacher-email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={teacherEmail}
                    disabled={busy || !submitted}
                    onChange={(event) => setTeacherEmail(event.target.value)}
                  />
                </Field>
                {!submitted ? (
                  <p className="text-sm text-muted-foreground">請先送交承辦後，再通知導師簽核。</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !submitted || !teacherEmail.trim()}
                  onClick={() => void handleNotifyTeacher()}
                >
                  <Send />
                  通知導師
                </Button>
                {lastNotice ? (
                  <p className="text-meta text-muted-foreground">
                    最近通知：{formatTaipeiDateTime(lastNotice.created)} → {lastNotice.email}
                    {lastNotice.channel_email === 'skipped' ? '（郵件未啟用，已略過寄信）' : ''}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {message ? (
          <p role="status" className="text-sm font-medium text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
