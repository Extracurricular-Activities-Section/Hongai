import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchHistoryForm } from '@/features/forms/api'
import { DynamicFormRenderer } from '@/features/forms/components/dynamic-form-renderer'
import { buildInitialValues, evaluateRules } from '@/features/forms/engine'
import type { FormSchema, FormValues } from '@/features/forms/types'
import { downloadPdfBlob, listPdfsBySubmission } from '@/features/pdf/api'
import type { PdfDocument } from '@/features/pdf/types'
import { formatTaipeiDateTime } from '@/lib/utils'

export function StudentHistoryFormPage() {
  const { periodId = '', categoryCode = '' } = useParams()
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [pdfs, setPdfs] = useState<PdfDocument[]>([])
  const [meta, setMeta] = useState<{
    title: string
    periodName: string
    versionNumber: number
    completedAt: string | null
    submissionId: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchHistoryForm(periodId, categoryCode)
        if (cancelled) return
        const initial = buildInitialValues(data.schema, data.answers)
        setSchema(data.schema)
        setValues(initial)
        setMeta({
          title: data.category.name,
          periodName: data.period.name,
          versionNumber: data.latest_version.version_number,
          completedAt: data.submission.completed_at,
          submissionId: data.submission.id,
        })
        try {
          setPdfs(await listPdfsBySubmission(data.submission.id))
        } catch {
          setPdfs([])
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [periodId, categoryCode])

  const fieldState = useMemo(() => (schema ? evaluateRules(schema, values) : {}), [schema, values])

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button asChild variant="outline">
          <Link to={`/student/history/${periodId}`}>返回</Link>
        </Button>
      </div>
    )
  }

  if (!schema || !meta) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {meta.periodName} · 歷史唯讀 · 版本 {meta.versionNumber}
        </p>
        {meta.completedAt ? (
          <p className="text-sm text-muted-foreground">
            完成時間：{formatTaipeiDateTime(meta.completedAt)}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">表單內容（最新有效版本）</CardTitle>
        </CardHeader>
        <CardContent>
          <DynamicFormRenderer
            schema={schema}
            values={values}
            fieldState={fieldState}
            mode="readonly"
            submissionId={meta?.submissionId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">歷史 PDF（不可重新產生）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {pdfs.length === 0 ? (
            <p className="text-muted-foreground">此歷史梯次尚無 PDF 文件。</p>
          ) : (
            pdfs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 border-b border-border py-2"
              >
                <div>
                  <p>
                    {doc.document_number} · V{doc.document_version} · {doc.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTaipeiDateTime(doc.generated_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void downloadPdfBlob(doc.id).then((blob) => {
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${doc.document_number}-V${doc.document_version}.pdf`
                      a.click()
                      URL.revokeObjectURL(url)
                    })
                  }}
                >
                  下載
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to={`/student/history/${periodId}`}>返回歷史詳情</Link>
      </Button>
    </div>
  )
}
