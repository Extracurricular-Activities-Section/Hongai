import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import { ConfirmDialog } from '@/features/applications/components/confirm-dialog'
import {
  adminGetFollowUpTask,
  adminReviewFollowUpTask,
  adminUpdateFollowUpDueAt,
  adminWaiveFollowUpTask,
} from '@/features/follow-up/api'
import type { FollowUpReviewDecision, FollowUpTaskDetail } from '@/features/follow-up/types'
import { followUpStatusLabel, followUpTypeLabel } from '@/features/follow-up/utils/status-labels'
import { formatTaipeiDateTime } from '@/lib/utils'

export function AdminTaskDetailPage() {
  const { taskId = '' } = useParams()
  const [detail, setDetail] = useState<FollowUpTaskDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [studentMessage, setStudentMessage] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [allowResubmit, setAllowResubmit] = useState(true)
  const [dueAt, setDueAt] = useState('')
  const [waiveReason, setWaiveReason] = useState('')
  const [pendingDecision, setPendingDecision] = useState<FollowUpReviewDecision | null>(null)
  const [waiveOpen, setWaiveOpen] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const data = await adminGetFollowUpTask(taskId)
    setDetail(data)
    setDueAt(data.task.due_at ? data.task.due_at.slice(0, 16) : '')
  }, [taskId])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button asChild variant="outline">
          <Link to="/admin/tasks">返回列表</Link>
        </Button>
      </div>
    )
  }

  if (!detail) return <p className="text-sm text-muted-foreground">載入中…</p>

  const { task } = detail
  const canReview = task.status === 'under_review' || task.status === 'submitted'

  async function runReview(decision: FollowUpReviewDecision) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await adminReviewFollowUpTask(taskId, {
        decision,
        student_message: studentMessage || undefined,
        internal_note: internalNote || undefined,
        allow_resubmit: allowResubmit,
      })
      setMessage(result.message)
      setPendingDecision(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '審核失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link to="/admin/tasks" className="underline">
            追蹤任務
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{task.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {followUpStatusLabel(task.status)}
          {task.is_overdue ? ' · 逾期' : ''} · {followUpTypeLabel(task.task_type)}
        </p>
        <p className="mt-1 text-sm">
          案件：
          <Link className="underline" to={`/admin/applications/${task.application}`}>
            {task.application}
          </Link>
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">任務資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {task.description ? <p>{task.description}</p> : null}
          {task.student_instructions ? <p>學生說明：{task.student_instructions}</p> : null}
          {task.waive_reason ? <p>豁免原因：{task.waive_reason}</p> : null}
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <label className="space-y-1">
              <span className="text-muted-foreground">截止日期</span>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !dueAt}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    const iso = new Date(dueAt).toISOString()
                    const result = await adminUpdateFollowUpDueAt(taskId, iso)
                    setMessage(result.message)
                    await load()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '更新失敗')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              更新截止日
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">附件</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無附件。</p>
          ) : (
            <SecureFileUpload
              allowedExtensions={['pdf', 'jpg', 'jpeg', 'png', 'docx']}
              maxFiles={20}
              maxSizeMb={20}
              context="follow_up"
              followUpTaskId={task.id}
              applicationId={task.application}
              value={detail.attachments.map((a) => a.id)}
              onChange={() => undefined}
              disabled
              knownAttachments={detail.attachments}
              asStaff
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">繳交紀錄</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.submissions.length === 0 ? (
            <p className="text-muted-foreground">尚無繳交。</p>
          ) : (
            detail.submissions.map((sub) => (
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
            ))
          )}
        </CardContent>
      </Card>

      {canReview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">審核操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-muted-foreground">學生可見訊息</span>
              <Input value={studentMessage} onChange={(e) => setStudentMessage(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">內部備註</span>
              <Input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowResubmit}
                onChange={(e) => setAllowResubmit(e.target.checked)}
              />
              允許重新繳交（補件／駁回時）
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => setPendingDecision('approved')}
              >
                核准
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setPendingDecision('supplement_required')}
              >
                要求補件
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setPendingDecision('rejected')}
              >
                駁回
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {task.status !== 'approved' && task.status !== 'waived' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">豁免任務</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="text-muted-foreground">豁免原因</span>
              <Input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!waiveReason.trim()) {
                  setError('請填寫豁免原因')
                  return
                }
                setWaiveOpen(true)
              }}
            >
              豁免此任務
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {detail.reviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">審核紀錄</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.reviews.map((review) => (
              <div key={review.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{followUpStatusLabel(review.decision)}</p>
                <p>學生訊息：{review.student_message || '—'}</p>
                {review.internal_note ? <p>內部：{review.internal_note}</p> : null}
                <p className="text-xs text-muted-foreground">{formatTaipeiDateTime(review.created)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={pendingDecision != null}
        title="確認審核決定"
        description={
          pendingDecision === 'approved'
            ? '確定核准此追蹤任務？'
            : pendingDecision === 'supplement_required'
              ? '確定要求學生補件？'
              : '確定駁回此任務？'
        }
        confirmLabel="確認"
        confirmVariant={pendingDecision === 'rejected' ? 'destructive' : 'default'}
        busy={busy}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => {
          if (pendingDecision) void runReview(pendingDecision)
        }}
      />

      <ConfirmDialog
        open={waiveOpen}
        title="確認豁免"
        description="豁免後任務將標記為完成，學生無需再繳交。"
        confirmLabel="確認豁免"
        busy={busy}
        onCancel={() => setWaiveOpen(false)}
        onConfirm={() => {
          void (async () => {
            setBusy(true)
            setError(null)
            try {
              const result = await adminWaiveFollowUpTask(taskId, waiveReason)
              setMessage(result.message)
              setWaiveOpen(false)
              await load()
            } catch (err) {
              setError(err instanceof Error ? err.message : '豁免失敗')
            } finally {
              setBusy(false)
            }
          })()
        }}
      />
    </div>
  )
}
