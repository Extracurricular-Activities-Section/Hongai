import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { adminListDocuments, adminRevokeDocument, downloadPdfBlob } from '@/features/pdf/api'
import type { PdfDocument } from '@/features/pdf/types'
import { formatTaipeiDateTime } from '@/lib/utils'

export function AdminDocumentsPage() {
  const { isAdmin } = useBackofficeAuth()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PdfDocument[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PdfDocument | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    void adminListDocuments(query)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [isAdmin, query])

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">僅管理員可管理 PDF 文件。</p>
  }
  if (error && !items) return <p className="text-sm text-red-700">{error}</p>
  if (!items) return <p className="text-sm text-muted-foreground">載入中…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">正式申請文件</h1>
        <p className="mt-2 text-sm text-muted-foreground">可搜尋文件編號、學號、申請項目。不顯示身分證。</p>
      </div>

      <Input
        placeholder="搜尋文件編號／學號／項目"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
                <div>
                  <p className="font-medium">{item.document_number}</p>
                  <p className="text-muted-foreground">
                    {item.student_no} · {item.category_name} · V{item.document_version} ·{' '}
                    {item.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTaipeiDateTime(item.generated_at)}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setSelected(item)}>
                  詳情
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">文件詳情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selected ? (
              <p className="text-muted-foreground">請選擇文件。</p>
            ) : (
              <>
                <p>文件編號：{selected.document_number}</p>
                <p>版本：V{selected.document_version}</p>
                <p>狀態：{selected.status}</p>
                <p>SHA-256：{selected.file_sha256}</p>
                <p>學號：{selected.student_no}</p>
                <p>項目：{selected.category_name}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void downloadPdfBlob(selected.id).then((blob) => {
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${selected.document_number}-V${selected.document_version}.pdf`
                        a.click()
                        URL.revokeObjectURL(url)
                      })
                    }}
                  >
                    下載
                  </Button>
                </div>
                {selected.status !== 'revoked' ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Input
                      placeholder="撤銷原因"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void adminRevokeDocument(selected.id, revokeReason)
                          .then((doc) => {
                            setSelected(doc)
                            return adminListDocuments(query)
                          })
                          .then(setItems)
                          .catch((err) => setError(err instanceof Error ? err.message : '撤銷失敗'))
                      }}
                    >
                      撤銷文件
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
