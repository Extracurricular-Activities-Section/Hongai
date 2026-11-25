import { Download, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Field } from '@/components/common/field'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, InlineNotice, PageSkeleton } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/features/applications/components/confirm-dialog'
import {
  adminImportOutreachRoster,
  adminListOutreachBatches,
  adminSendOutreachBatch,
} from '@/features/outreach/api'
import type { OutreachBatch } from '@/features/outreach/types'
import { formatTaipeiDateTime } from '@/lib/utils'

const MAX_FILE_BYTES = 1_000_000
const TEMPLATE_CSV = '\uFEFFstudent_no,name,email\r\nU0000001,王小明,example@school.edu.tw\r\n'

const STATUS_LABELS: Record<string, string> = {
  imported: '待發送',
  sending: '發送中（未完成）',
  completed: '已完成',
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'economically-disadvantaged-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function BatchCard({
  batch,
  mailConfigured,
  sending,
  disabled,
  onSend,
}: {
  batch: OutreachBatch
  mailConfigured: boolean
  sending: boolean
  disabled: boolean
  onSend: () => void
}) {
  const percent = batch.total ? Math.round((batch.processed / batch.total) * 100) : 0
  const done = batch.status === 'completed'

  return (
    <li className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{batch.filename || '名冊'}</p>
          <p className="mt-0.5 text-meta text-muted-foreground">
            匯入於 {formatTaipeiDateTime(batch.created_at)} · 批次 {batch.id}
          </p>
        </div>
        <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-meta font-medium text-foreground">
          {STATUS_LABELS[batch.status] || batch.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-meta text-muted-foreground">名冊筆數</dt>
          <dd className="tabular text-foreground">
            {batch.total}
            {batch.invalid || batch.duplicates
              ? `（略過：無效 ${batch.invalid}、重複 ${batch.duplicates}）`
              : ''}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">已處理</dt>
          <dd className="tabular text-foreground">
            {batch.processed} / {batch.total}（{percent}%）
          </dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">站內通知已建立</dt>
          <dd className="tabular text-foreground">{batch.counters.in_app}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">
            {mailConfigured ? 'Email 已排入佇列' : 'Email 已略過（郵件未設定）'}
          </dt>
          <dd className="tabular text-foreground">
            {mailConfigured ? batch.counters.email_queued : batch.counters.email_skipped}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">尚無系統帳號（無站內通知）</dt>
          <dd className="tabular text-foreground">{batch.counters.no_account}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">失敗</dt>
          <dd className="tabular text-foreground">{batch.counters.failed}</dd>
        </div>
      </dl>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-pill bg-surface-muted"
        role="progressbar"
        aria-label="發送進度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-accent-strong transition-[width]" style={{ width: `${percent}%` }} />
      </div>

      {batch.invalid_samples.length > 0 ? (
        <details className="mt-3 text-meta text-muted-foreground">
          <summary className="cursor-pointer">無效資料列（前 {batch.invalid_samples.length} 筆）</summary>
          <ul className="mt-1 space-y-0.5">
            {batch.invalid_samples.map((item) => (
              <li key={`${item.line}-${item.reason}`}>
                第 {item.line} 列：{item.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-4">
        <Button type="button" size="sm" disabled={done || disabled} onClick={onSend}>
          {sending ? '發送中…' : done ? '已全部處理' : batch.processed > 0 ? '繼續發送' : '發送通知'}
        </Button>
      </div>
    </li>
  )
}

export function AdminOutreachPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [batches, setBatches] = useState<OutreachBatch[] | null>(null)
  const [mailConfigured, setMailConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmBatch, setConfirmBatch] = useState<OutreachBatch | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await adminListOutreachBatches()
    setBatches(data.items)
    setMailConfigured(data.mail_provider_configured)
  }, [])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  async function importFile() {
    if (!file) return
    setError(null)
    setMessage(null)
    if (file.size > MAX_FILE_BYTES) {
      setError('檔案過大（上限約 1MB）')
      return
    }
    setImporting(true)
    try {
      const result = await adminImportOutreachRoster(await file.text(), file.name)
      setMessage(result.message)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  /** No Queue binding: the page drives one server batch (<= 50) per request until done. */
  async function sendAll(batch: OutreachBatch) {
    setConfirmBatch(null)
    setSendingId(batch.id)
    setError(null)
    setMessage(null)
    let processed = 0
    try {
      for (;;) {
        const result = await adminSendOutreachBatch(batch.id)
        processed += result.result.processed
        setBatches((current) =>
          current ? current.map((item) => (item.id === result.batch.id ? result.batch : item)) : current,
        )
        setMailConfigured(result.mail_provider_configured)
        if (result.result.done || result.result.processed === 0) break
      }
      setMessage(`本次已處理 ${processed} 筆，每批最多 50 筆。`)
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : '發送失敗'}（已處理 ${processed} 筆，可按「繼續發送」從中斷處接續）`,
      )
    } finally {
      setSendingId(null)
      await load().catch(() => undefined)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/admin/notifications"
        backLabel="通知中心"
        title="經濟不利生通知"
        description="上傳經濟不利名冊（CSV），分批建立站內通知與 Email 寄送紀錄，邀請符合資格的同學申請弘愛築夢。僅管理員可使用。"
      />

      {!mailConfigured ? (
        <InlineNotice tone="attention" title="郵件提供者尚未設定">
          站內通知仍會建立（限已有系統帳號的學生）；Email 會在寄送紀錄中標記為「已略過」，不會實際寄出。
        </InlineNotice>
      ) : null}

      {message ? <InlineNotice tone="positive">{message}</InlineNotice> : null}
      {error ? <ErrorState title="無法完成操作" message={error} /> : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-card font-semibold text-foreground">1. 匯入名冊</h2>
        <p className="mt-1 text-sm text-subtle">
          欄位：<code className="tabular">student_no,name,email</code>（第一列為標題，UTF-8，上限 5,000 筆）。
          重複學號只保留第一筆。
        </p>
        <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Field id="outreach-file" label="CSV 檔案">
            <Input
              id="outreach-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Button type="button" disabled={!file || importing} onClick={() => void importFile()}>
            <Upload />
            {importing ? '匯入中…' : '匯入名冊'}
          </Button>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download />
            下載範本
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-card font-semibold text-foreground">2. 發送通知</h2>
          <p className="mt-1 text-sm text-subtle">
            通知內容：「您符合經濟不利資格，歡迎申請弘愛築夢」。文字可於
            <Link
              to="/admin/notifications/templates"
              className="mx-1 underline underline-offset-4 hover:text-accent-strong"
            >
              通知範本
            </Link>
            修改（代碼 economically_disadvantaged_outreach；尚未建立該範本時使用內建文字）。
          </p>
        </div>

        {!batches && !error ? <PageSkeleton /> : null}
        {batches && batches.length === 0 ? (
          <EmptyState title="尚未匯入名冊" description="上傳 CSV 後，批次會顯示在這裡。" compact />
        ) : null}
        {batches && batches.length > 0 ? (
          <ul className="space-y-3">
            {batches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                mailConfigured={mailConfigured}
                sending={sendingId === batch.id}
                disabled={sendingId !== null}
                onSend={() => setConfirmBatch(batch)}
              />
            ))}
          </ul>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(confirmBatch)}
        title="確認發送通知？"
        description={
          confirmBatch
            ? `將處理名冊剩餘 ${confirmBatch.remaining} 位學生（每批 50 筆），建立站內通知與 Email 寄送紀錄。${
                mailConfigured ? '' : '郵件提供者未設定，Email 不會實際寄出。'
              }發送過程請勿關閉此頁。`
            : undefined
        }
        confirmLabel="開始發送"
        onConfirm={() => confirmBatch && void sendAll(confirmBatch)}
        onCancel={() => setConfirmBatch(null)}
      />
    </div>
  )
}
