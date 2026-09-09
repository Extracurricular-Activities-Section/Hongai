import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import { getMyFollowUpTask, submitFollowUpTask } from '@/features/follow-up/api'
import type { FollowUpTaskDetail } from '@/features/follow-up/types'
import {
  followUpStatusLabel,
  followUpTypeLabel,
  isStudentActionableStatus,
} from '@/features/follow-up/utils/status-labels'
import { formatTaipeiDateTime } from '@/lib/utils'

export function StudentTaskDetailPage() {
  const { taskId = '' } = useParams()
  const [detail, setDetail] = useState<FollowUpTaskDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [textContent, setTextContent] = useState('')
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setError(null)
    const data = await getMyFollowUpTask(taskId)
    setDetail(data)
    const latest = data.submissions.find((s) => s.status === 'submitted')
    if (latest?.text_content) setTextContent(latest.text_content)
    setAttachmentIds(data.attachments.map((a) => a.id))
  }, [taskId])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button asChild variant="outline">
          <Link to="/student/tasks">返回列表</Link>
        </Button>
      </div>
    )
  }

  if (!detail) return <p className="text-sm text-muted-foreground">載入中…</p>

  const { task } = detail
  const canSubmit = isStudentActionableStatus(task.status, task.allow_resubmit)
  const needsFile = task.task_type === 'file_upload' || task.task_type === 'file_and_text'
  const needsText = task.task_type === 'text' || task.task_type === 'file_and_text'
  const allowed = task.allowed_extensions?.length
    ? task.allowed_extensions
    : ['pdf', 'jpg', 'jpeg', 'png', 'docx']
  const maxFiles = task.max_files && task.max_files > 0 ? task.max_files : 5
  const maxSizeMb = task.max_file_size_mb && task.max_file_size_mb > 0 ? task.max_file_size_mb : 10

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await submitFollowUpTask(taskId, {
        text_content: textContent || undefined,
        attachment_ids: needsFile ? attachmentIds : undefined,
      })
      setMessage(result.message)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '繳交失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link to="/student/tasks" className="underline">
            追蹤任務
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{task.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {followUpStatusLabel(task.status)}
          {task.is_overdue ? ' · 逾期' : ''} · {followUpTypeLabel(task.task_type)}
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">任務說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {task.description ? <p>{task.description}</p> : null}
          {task.student_instructions ? <p>{task.student_instructions}</p> : null}
          {task.due_at ? <p>截止：{formatTaipeiDateTime(task.due_at)}</p> : null}
          {task.event_location ? <p>地點：{task.event_location}</p> : null}
          {task.event_note ? <p>活動備註：{task.event_note}</p> : null}
          {!task.description && !task.student_instructions ? (
            <p className="text-muted-foreground">無額外說明。</p>
          ) : null}
        </CardContent>
      </Card>

      {detail.reviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">審核回覆</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.reviews.map((review) => (
              <div key={review.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{followUpStatusLabel(review.decision)}</p>
                <p>{review.student_message || '—'}</p>
                <p className="text-xs text-muted-foreground">{formatTaipeiDateTime(review.created)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{canSubmit ? '繳交內容' : '已繳交內容'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {needsText ? (
            <label className="block space-y-1">
              <span className="text-muted-foreground">文字內容{needsText && canSubmit ? ' *' : ''}</span>
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={textContent}
                disabled={!canSubmit || busy}
                onChange={(e) => setTextContent(e.target.value)}
              />
            </label>
          ) : null}

          {needsFile || detail.attachments.length > 0 ? (
            <SecureFileUpload
              allowedExtensions={allowed}
              maxFiles={maxFiles}
              maxSizeMb={maxSizeMb}
              context="follow_up"
              followUpTaskId={task.id}
              applicationId={task.application}
              value={attachmentIds}
              onChange={setAttachmentIds}
              disabled={!canSubmit || busy}
              knownAttachments={detail.attachments}
              required={needsFile}
            />
          ) : null}

          {canSubmit ? (
            <Button type="button" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? '送出中…' : '送出繳交'}
            </Button>
          ) : (
            <p className="text-muted-foreground">目前狀態不可修改繳交內容。</p>
          )}
        </CardContent>
      </Card>

      {detail.submissions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">繳交紀錄</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.submissions.map((sub) => (
              <div key={sub.id} className="rounded-md border border-border p-3">
                <p>
                  第 {sub.submission_version} 版 · {sub.status}
                  {sub.is_overdue_at_submit ? ' · 逾期繳交' : ''}
                </p>
                {sub.text_content ? <p className="mt-1 whitespace-pre-wrap">{sub.text_content}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {formatTaipeiDateTime(sub.submitted_at || sub.created)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
