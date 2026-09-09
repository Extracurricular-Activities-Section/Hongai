import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { verifyPdfToken } from '@/features/pdf/api'
import type { PdfVerificationResult } from '@/features/pdf/types'
import { formatTaipeiDateTime } from '@/lib/utils'

export function PublicVerifyPage() {
  const { token = '' } = useParams()
  const [result, setResult] = useState<PdfVerificationResult | null>(null)

  useEffect(() => {
    void verifyPdfToken(token).then(setResult)
  }, [token])

  if (!result) {
    return <p className="p-8 text-sm text-muted-foreground">驗證中…</p>
  }

  const tone =
    result.status === 'valid'
      ? 'text-emerald-700'
      : result.status === 'unknown'
        ? 'text-muted-foreground'
        : 'text-warning'

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-start justify-center bg-background px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>文件驗證</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className={`font-medium ${tone}`}>{result.message}</p>
          {result.status !== 'unknown' ? (
            <>
              <p>申請編號：{result.document_number}</p>
              <p>申請項目：{result.category_name || '—'}</p>
              <p>
                學年度／學期：{result.academic_year || '—'} / {result.semester || '—'}
              </p>
              <p>PDF 版本：V{result.document_version}</p>
              <p>產生日期：{formatTaipeiDateTime(result.generated_at)}</p>
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">
            本頁僅驗證文件有效性，不顯示姓名、學號、身分證或其他申請內容。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
