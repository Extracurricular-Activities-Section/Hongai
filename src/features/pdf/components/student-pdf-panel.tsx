import { Download, Eye, FileText, Pencil, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ProcessStepper, type ProcessStep } from '@/components/common/process-stepper'
import { ErrorState, InlineNotice } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StudentSubmitPanel } from '@/features/applications/components/student-submit-panel'
import { downloadPdfBlob, generatePdf, listPdfsBySubmission } from '@/features/pdf/api'
import type { PdfDocument, SignatureUploadMode } from '@/features/pdf/types'
import { formatTaipeiDateTime } from '@/lib/utils'

async function triggerDownload(doc: PdfDocument) {
  const blob = await downloadPdfBlob(doc.id)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${doc.document_number}-V${doc.document_version}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}

const VERSION_STATUS: Record<string, { label: string; tone: 'positive' | 'neutral' | 'critical' }> =
  {
    valid: { label: '目前有效', tone: 'positive' },
    superseded: { label: '已被新版取代', tone: 'neutral' },
  }

export function StudentPdfPanel({
  submissionId,
  completed,
  onReedit,
  signatureUploadMode = 'disabled',
  categoryCode,
}: {
  submissionId: string
  completed: boolean
  onReedit: () => void
  signatureUploadMode?: SignatureUploadMode
  categoryCode?: string
}) {
  const [items, setItems] = useState<PdfDocument[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    void listPdfsBySubmission(submissionId)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [submissionId])

  const latestValid = items?.find((item) => item.status === 'valid') || null

  async function regenerate() {
    setBusy(true)
    setError(null)
    setMessage('正在產生正式申請表…')
    try {
      const result = await generatePdf(submissionId)
      setMessage(result.message)
      setItems(await listPdfsBySubmission(submissionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '產生失敗')
      setMessage(null)
    } finally {
      setBusy(false)
    }
  }

  /** Paper-signature flow, spelled out so students know what is still ahead. */
  const steps: ProcessStep[] = [
    { id: 'complete', label: '完成填寫', state: completed ? 'complete' : 'current' },
    {
      id: 'generate',
      label: '產生申請表',
      state: latestValid ? 'complete' : completed ? 'current' : 'upcoming',
    },
    {
      id: 'sign',
      label: '列印並簽名',
      state: latestValid ? 'current' : 'upcoming',
    },
    {
      id: 'submit',
      label: '送交承辦',
      state: 'upcoming',
    },
  ]

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-card font-semibold text-foreground">正式申請文件</h2>
          <p className="mt-1 text-sm text-subtle">
            申請表需列印簽名後送交承辦，系統會保留每一次產生的版本。
          </p>
        </header>

        <div className="border-b border-border px-5 py-4">
          <ProcessStepper steps={steps} ariaLabel="正式文件流程" />
        </div>

        <div className="space-y-4 px-5 py-5">
          {!completed && !latestValid ? (
            <p className="text-sm text-muted-foreground">請先完成填寫後再產生 PDF。</p>
          ) : null}

          {completed && !latestValid ? (
            <div className="rounded-md border border-dashed border-border-strong px-5 py-8 text-center">
              <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium text-foreground">尚未產生申請表</p>
              <p className="mt-1 text-meta text-muted-foreground">
                產生後即可下載列印，並完成紙本簽核。
              </p>
              <Button
                type="button"
                variant="brand"
                className="mt-5"
                disabled={busy}
                onClick={() => void regenerate()}
              >
                {busy ? '產生中…' : '產生 PDF'}
              </Button>
            </div>
          ) : null}

          {latestValid ? (
            <div className="rounded-md border border-border bg-surface-muted p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="positive">目前有效</Badge>
                    <span className="text-meta text-muted-foreground tabular">
                      V{latestValid.document_version}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground tabular">
                    {latestValid.document_number}
                  </p>
                  <p className="mt-0.5 text-meta text-muted-foreground">
                    產生於 {formatTaipeiDateTime(latestValid.generated_at)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  onClick={() => {
                    void triggerDownload(latestValid).catch((err) =>
                      setError(err instanceof Error ? err.message : '下載失敗'),
                    )
                  }}
                >
                  <Download />
                  下載 PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void (async () => {
                      try {
                        const blob = await downloadPdfBlob(latestValid.id)
                        if (previewUrl) URL.revokeObjectURL(previewUrl)
                        setPreviewUrl(URL.createObjectURL(blob))
                      } catch (err) {
                        setError(err instanceof Error ? err.message : '預覽失敗')
                      }
                    })()
                  }}
                >
                  <Eye />
                  預覽
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onReedit}>
                  <Pencil />
                  重新編輯
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || !completed}
                  onClick={() => void regenerate()}
                >
                  <RefreshCw />
                  重新產生
                </Button>
              </div>
            </div>
          ) : null}

          {completed && latestValid ? (
            <ol className="space-y-1.5 text-sm text-subtle">
              <li>1. 下載並列印申請表</li>
              <li>2. 完成紙本簽核</li>
              <li>3. 依規定上傳已簽文件（如需）後送交承辦</li>
            </ol>
          ) : null}

          {!completed && latestValid ? (
            <InlineNotice tone="attention" title="申請內容已修改">
              既有 PDF 將保留為舊版本，完成修改後請重新產生最新 PDF。
            </InlineNotice>
          ) : null}

          {items && items.length > 0 ? (
            <details className="rounded-md border border-border">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-subtle">
                文件版本紀錄（{items.length}）
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {items.map((doc) => {
                  const status = VERSION_STATUS[doc.status] ?? { label: '已撤銷', tone: 'critical' as const }
                  return (
                    <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground tabular">
                          V{doc.document_version} · {doc.document_number}
                        </p>
                        <p className="mt-0.5 text-meta text-muted-foreground">
                          {formatTaipeiDateTime(doc.generated_at)}
                        </p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void triggerDownload(doc).catch((err) =>
                            setError(err instanceof Error ? err.message : '下載失敗'),
                          )
                        }}
                      >
                        <Download />
                        下載
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </details>
          ) : null}

          {previewUrl ? (
            <div className="rounded-md border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="text-sm font-medium text-foreground">PDF 預覽</p>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="關閉預覽"
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl)
                    setPreviewUrl(null)
                  }}
                >
                  <X />
                </Button>
              </div>
              <iframe title="PDF 預覽" src={previewUrl} className="h-[28rem] w-full rounded-b-md" />
            </div>
          ) : null}

          {message ? <p className="text-sm text-subtle">{message}</p> : null}
          {error ? <ErrorState message={error} /> : null}
        </div>
      </section>

      {latestValid ? (
        <StudentSubmitPanel
          submissionId={submissionId}
          completed={completed}
          hasValidPdf={!!latestValid}
          signatureUploadMode={signatureUploadMode}
          categoryCode={categoryCode}
        />
      ) : null}
    </div>
  )
}
