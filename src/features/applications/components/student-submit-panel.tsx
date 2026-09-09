import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import {
  listSignedDocumentsByApplication,
  registerSignedDocument,
  type SignedDocument,
} from '@/features/signed-documents/api'
import {
  getMyApplication,
  listMyApplications,
  replySupplement,
  submitApplication,
} from '../api'
import type { Application, SignatureUploadModeProp, SupplementRequest } from '../types'
import { formatAmount, studentFacingStatusLabel } from '../utils/status-labels'
import { StatusBadge } from './status-badge'
import { formatTaipeiDateTime } from '@/lib/utils'

export function StudentSubmitPanel({
  submissionId,
  completed,
  hasValidPdf,
  signatureUploadMode = 'disabled',
  categoryCode,
}: {
  submissionId: string
  completed: boolean
  hasValidPdf: boolean
  signatureUploadMode?: SignatureUploadModeProp
  categoryCode?: string
}) {
  const [application, setApplication] = useState<Application | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [detailNote, setDetailNote] = useState<string | null>(null)
  const [pendingSupplement, setPendingSupplement] = useState<SupplementRequest | null>(null)
  const [signedIds, setSignedIds] = useState<string[]>([])
  const [signedDocs, setSignedDocs] = useState<SignedDocument[]>([])
  const [supplementIds, setSupplementIds] = useState<string[]>([])
  const [studentNote, setStudentNote] = useState('')

  const showSignedUpload =
    signatureUploadMode === 'optional' || signatureUploadMode === 'required'

  const load = useCallback(async () => {
    setError(null)
    const items = await listMyApplications()
    const match =
      items.find((item) => item.submission === submissionId) ||
      (categoryCode
        ? items.find((item) => item.category_code === categoryCode)
        : undefined) ||
      null
    setApplication(match)

    if (match) {
      try {
        const docs = await listSignedDocumentsByApplication(match.id)
        setSignedDocs(docs)
        const active = docs.find((doc) => doc.status === 'active')
        if (active?.attachment) setSignedIds([active.attachment])
      } catch {
        setSignedDocs([])
      }
    } else {
      setSignedDocs([])
    }

    if (match && (match.status === 'supplement_required' || match.status === 'returned_for_edit')) {
      try {
        const detail = await getMyApplication(match.id)
        const pending = detail.pending_supplements?.[0] || null
        setPendingSupplement(pending)
        if (pending?.message) setDetailNote(pending.message)
        else if (match.supplement_message) setDetailNote(match.supplement_message)
        else if (match.return_reason) setDetailNote(match.return_reason)
        else setDetailNote(null)
      } catch {
        setPendingSupplement(null)
        setDetailNote(match.supplement_message || match.return_reason)
      }
    } else {
      setPendingSupplement(null)
      setDetailNote(match?.return_reason || match?.supplement_message || null)
    }
  }, [submissionId, categoryCode])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  if (application === undefined) {
    return <p className="text-sm text-muted-foreground">載入送件狀態…</p>
  }

  const requiresSignedUpload = signatureUploadMode === 'required'
  const hasSigned = signedIds.length > 0 || Boolean(application?.signed_document)
  const canSubmit =
    completed &&
    hasValidPdf &&
    (!requiresSignedUpload || hasSigned) &&
    (!application || application.status === 'returned_for_edit')

  async function handleSignedChange(ids: string[]) {
    setSignedIds(ids)
    setError(null)
    const latestId = ids[ids.length - 1]
    if (!latestId || !application) return
    try {
      const result = await registerSignedDocument({
        attachment_id: latestId,
        application_id: application.id,
        student_note: studentNote || undefined,
      })
      setMessage(result.message)
      setSignedDocs(await listSignedDocumentsByApplication(application.id))
    } catch (err) {
      // Before first submit, attachment alone is enough; registration needs application
      if (application) {
        setError(err instanceof Error ? err.message : '已簽文件登錄失敗')
      }
    }
  }

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await submitApplication(submissionId)
      setApplication(result.application)
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '送件失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleSupplementReply() {
    if (!application) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await replySupplement(application.id, reply, supplementIds)
      setMessage(result.message)
      setReply('')
      setSupplementIds([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '補件回覆失敗')
    } finally {
      setBusy(false)
    }
  }

  const editableForSigned =
    !application ||
    application.status === 'returned_for_edit' ||
    application.status === 'supplement_required'

  return (
    <div className="space-y-4">
      {showSignedUpload && completed && hasValidPdf ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已簽文件上傳</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              請下載 PDF 並列印完成紙本簽核後，上傳已簽 PDF
              {signatureUploadMode === 'required' ? '（必填）' : '（選填）'}。
            </p>
            {signedDocs.filter((doc) => doc.status === 'active').length > 0 ? (
              <div className="rounded-md border border-border p-3">
                {signedDocs
                  .filter((doc) => doc.status === 'active')
                  .map((doc) => (
                    <p key={doc.id}>
                      已登錄第 {doc.version_number} 版
                      {doc.uploaded_at ? ` · ${formatTaipeiDateTime(doc.uploaded_at)}` : ''}
                    </p>
                  ))}
              </div>
            ) : null}
            {editableForSigned ? (
              <>
                <label className="block space-y-1">
                  <span className="text-muted-foreground">備註（選填）</span>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 text-sm"
                    value={studentNote}
                    onChange={(e) => setStudentNote(e.target.value)}
                    placeholder="可說明簽核狀態"
                  />
                </label>
                <SecureFileUpload
                  allowedExtensions={['pdf']}
                  maxFiles={1}
                  maxSizeMb={10}
                  context="signed_document"
                  submissionId={submissionId}
                  applicationId={application?.id}
                  value={signedIds}
                  onChange={(ids) => void handleSignedChange(ids)}
                  helpText="僅接受 PDF。送件前請確認為最新有效 PDF 對應之已簽版本。"
                />
              </>
            ) : (
              <SecureFileUpload
                allowedExtensions={['pdf']}
                maxFiles={1}
                maxSizeMb={10}
                context="signed_document"
                submissionId={submissionId}
                applicationId={application?.id}
                value={signedIds}
                onChange={() => undefined}
                disabled
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">送交承辦</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!application ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">尚未送件。完成有效 PDF 後即可送交承辦單位審核。</p>
              {requiresSignedUpload && !hasSigned ? (
                <p className="text-warning">請先上傳已簽 PDF 文件後再送件。</p>
              ) : null}
              {!completed || !hasValidPdf ? (
                <p className="text-muted-foreground">請先完成填寫並產生有效 PDF。</p>
              ) : null}
              <Button type="button" disabled={busy || !canSubmit} onClick={() => void handleSubmit()}>
                {busy ? '送件中…' : '送交承辦'}
              </Button>
            </div>
          ) : null}

          {application?.status === 'returned_for_edit' ? (
            <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                <span className="font-medium">{application.application_number}</span>
              </div>
              <p>退回原因：{detailNote || application.return_reason || '—'}</p>
              {application.edit_override_until ? (
                <p className="text-xs text-muted-foreground">
                  修改期限：{formatTaipeiDateTime(application.edit_override_until)}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                請修改申請內容並重新產生 PDF 後再送交。
                {categoryCode ? (
                  <>
                    {' '}
                    <Link className="underline" to={`/student/current/category/${categoryCode}`}>
                      前往編輯
                    </Link>
                  </>
                ) : null}
              </p>
              {requiresSignedUpload && !hasSigned ? (
                <p className="text-warning">請先上傳已簽 PDF 文件後再送件。</p>
              ) : null}
              <Button type="button" disabled={busy || !canSubmit} onClick={() => void handleSubmit()}>
                {busy ? '送件中…' : '重新送交'}
              </Button>
            </div>
          ) : null}

          {application?.status === 'supplement_required' ? (
            <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                <span className="font-medium">{application.application_number}</span>
              </div>
              <p>補件說明：{detailNote || application.supplement_message || '—'}</p>
              {application.supplement_due_at ? (
                <p className="text-xs text-muted-foreground">
                  截止：{formatTaipeiDateTime(application.supplement_due_at)}
                </p>
              ) : null}
              <SecureFileUpload
                allowedExtensions={['pdf', 'jpg', 'jpeg', 'png', 'docx']}
                maxFiles={5}
                maxSizeMb={10}
                context="supplement"
                applicationId={application.id}
                supplementRequestId={pendingSupplement?.id}
                value={supplementIds}
                onChange={setSupplementIds}
                helpText="可上傳補件相關證明文件（選填）。"
              />
              <label className="block space-y-1">
                <span className="text-muted-foreground">回覆說明（選填）</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-surface text-foreground transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 px-3 py-2 text-sm"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="可填寫補充說明"
                />
              </label>
              <Button type="button" disabled={busy} onClick={() => void handleSupplementReply()}>
                {busy ? '送出中…' : '送出補件回覆'}
              </Button>
            </div>
          ) : null}

          {application &&
          application.status !== 'returned_for_edit' &&
          application.status !== 'supplement_required' ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                <span className="font-medium">{application.application_number}</span>
              </div>
              <p>
                {studentFacingStatusLabel(application.status, {
                  approved_amount: application.approved_amount,
                })}
              </p>
              {application.requested_amount != null ? (
                <p className="text-muted-foreground">
                  申請金額：{formatAmount(application.requested_amount)}
                </p>
              ) : null}
              {application.status === 'funding_decided' && application.approved_amount != null ? (
                <p>核定金額：{formatAmount(application.approved_amount)}</p>
              ) : null}
              {application.reject_reason ? <p>原因：{application.reject_reason}</p> : null}
              {application.submitted_at ? (
                <p className="text-xs text-muted-foreground">
                  送件時間：{formatTaipeiDateTime(application.submitted_at)}
                </p>
              ) : null}
            </div>
          ) : null}

          {message ? <p className="text-emerald-800">{message}</p> : null}
          {error ? <p className="text-red-700">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
