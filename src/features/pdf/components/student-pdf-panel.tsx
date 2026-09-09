import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentSubmitPanel } from '@/features/applications/components/student-submit-panel'
import type { SignatureUploadMode } from '@/features/pdf/types'
import { downloadPdfBlob, generatePdf, listPdfsBySubmission } from '@/features/pdf/api'
import type { PdfDocument } from '@/features/pdf/types'
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

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">正式申請文件</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!completed ? (
          <p className="text-muted-foreground">請先完成填寫後再產生 PDF。</p>
        ) : null}

        {completed && !latestValid ? (
          <div className="space-y-3">
            <p>尚未產生 PDF</p>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                void (async () => {
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
                })()
              }}
            >
              {busy ? '產生中…' : '產生 PDF'}
            </Button>
          </div>
        ) : null}

        {latestValid ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="font-medium">✓ PDF 已產生（目前有效）</p>
            <p>文件編號：{latestValid.document_number}</p>
            <p>PDF 版本：V{latestValid.document_version}</p>
            <p>產生時間：{formatTaipeiDateTime(latestValid.generated_at)}</p>
            <div className="flex flex-wrap gap-2 pt-2">
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
                預覽 PDF
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void triggerDownload(latestValid).catch((err) =>
                    setError(err instanceof Error ? err.message : '下載失敗'),
                  )
                }}
              >
                下載 PDF
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onReedit}>
                重新編輯
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !completed}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      const result = await generatePdf(submissionId)
                      setMessage(result.message)
                      setItems(await listPdfsBySubmission(submissionId))
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '產生失敗')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                重新產生 PDF
              </Button>
            </div>
          </div>
        ) : null}

        {completed && latestValid ? (
          <p className="text-muted-foreground">
            下一步：1. 下載並列印申請表 2. 完成紙本簽核 3. 依規定上傳已簽文件（如需）後送交承辦
          </p>
        ) : null}

        {!completed && latestValid ? (
          <p className="text-amber-700">
            你已修改申請內容。既有 PDF 將保留為舊版本，完成修改後請重新產生最新 PDF。
          </p>
        ) : null}

        {items && items.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium">文件版本</p>
            {items.map((doc) => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
                <div>
                  <p>
                    PDF V{doc.document_version} ·{' '}
                    {doc.status === 'valid'
                      ? '目前有效'
                      : doc.status === 'superseded'
                        ? '已被新版取代'
                        : '已撤銷'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.document_number} · {formatTaipeiDateTime(doc.generated_at)}
                  </p>
                </div>
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
                  {doc.status === 'valid' ? '下載' : '查看／下載'}
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {previewUrl ? (
          <iframe title="PDF preview" src={previewUrl} className="h-96 w-full rounded border border-border" />
        ) : null}

        {message ? <p>{message}</p> : null}
        {error ? <p className="text-red-700">{error}</p> : null}
      </CardContent>
    </Card>

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
