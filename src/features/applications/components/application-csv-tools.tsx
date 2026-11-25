import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Field } from '@/components/common/field'
import { InlineNotice } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  adminDownloadApplicationsCsv,
  adminImportApprovedAmountsCsv,
  type ApplicationCsvFilters,
  type ApplicationCsvImportResult,
} from '../api/csv'

const MAX_FILE_BYTES = 1_000_000

/**
 * 案件列表的「Excel／CSV」匯出（所有承辦，授權範圍內）與核定金額匯入（僅管理員）。
 * 匯出沿用目前篩選條件；CSV 為 UTF-8 含 BOM，Excel 可直接開啟。
 */
export function ApplicationCsvTools({
  filters,
  canImport,
}: {
  filters: ApplicationCsvFilters
  canImport: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState<'applications' | 'items' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reason, setReason] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ApplicationCsvImportResult | null>(null)

  async function download(format: 'applications' | 'items') {
    setExporting(format)
    setError(null)
    try {
      await adminDownloadApplicationsCsv(filters, format)
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯出失敗')
    } finally {
      setExporting(null)
    }
  }

  async function runImport() {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError('檔案過大（上限約 1MB）')
      return
    }
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      setResult(await adminImportApprovedAmountsCsv(await file.text(), reason.trim()))
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={exporting !== null}
        onClick={() => void download('applications')}
      >
        <Download />
        {exporting === 'applications' ? '匯出中…' : '匯出 Excel／CSV'}
      </Button>
      {canImport ? (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Upload />
          匯入核定金額
        </Button>
      ) : null}
      {error && !open ? (
        <p role="alert" className="basis-full text-meta font-medium text-danger">
          {error}
        </p>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (importing) return
          setOpen(next)
          if (!next) {
            setResult(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>以 CSV 匯入核定金額</DialogTitle>
            <DialogDescription>
              欄位：application_number,item_code,approved_amount。僅「待核定」或「已核定」案件可更新；
              單一項目案件的 item_code 可留空；不在 CSV 中的項目維持原核定金額。每次最多 50 件，不會通知學生。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void download('items')}
              >
                <Download />
                {exporting === 'items' ? '產生中…' : '下載核定項目範本（依目前篩選）'}
              </Button>
              <p className="mt-1 text-meta text-muted-foreground">
                範本含目前篩選範圍內「待核定／已核定」案件的各補助項目，修改 approved_amount 後再上傳。
              </p>
            </div>
            <Field id="csv-import-file" label="CSV 檔案">
              <Input
                id="csv-import-file"
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field
              id="csv-import-reason"
              label="變更原因"
              description="更新「已核定」案件時會記錄；留空則使用「CSV 批次調整核定金額」。"
            >
              <Input
                id="csv-import-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>

            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            {result ? (
              <div className="space-y-2" aria-live="polite">
                <InlineNotice tone={result.errors.length ? 'attention' : 'positive'}>
                  {result.message}（請重新整理列表以檢視最新金額）
                </InlineNotice>
                {result.errors.length > 0 ? (
                  <ul className="max-h-40 space-y-1 overflow-auto rounded-md border border-border p-3 text-meta text-danger">
                    {result.errors.map((item, index) => (
                      <li key={`${item.application_number}-${index}`}>
                        {item.application_number}：{item.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={importing} onClick={() => setOpen(false)}>
              關閉
            </Button>
            <Button type="button" disabled={!file || importing} onClick={() => void runImport()}>
              {importing ? '匯入中…' : '開始匯入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
