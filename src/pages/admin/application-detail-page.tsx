import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/features/applications/components/confirm-dialog'
import { StatusBadge } from '@/features/applications/components/status-badge'
import {
  adminApplicationAction,
  adminAssignApplication,
  adminCreateFunding,
  adminFundingPreview,
  adminGetApplication,
  adminListDepartmentsApi,
  adminListStaffUsers,
} from '@/features/applications/api'
import type {
  AdminApplicationDetail,
  ApplicationAction,
  FundingPreviewResponse,
  StaffUserAdmin,
} from '@/features/applications/types'
import {
  APPLICATION_ACTION_LABELS,
  formatAmount,
} from '@/features/applications/utils/status-labels'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import {
  adminCreateFollowUpTask,
  adminEnsureFollowUpTasks,
  adminListFollowUpTasks,
} from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import { followUpStatusLabel, followUpTypeLabel } from '@/features/follow-up/utils/status-labels'
import {
  listSignedDocumentsByApplication,
  type SignedDocument,
} from '@/features/signed-documents/api'
import { downloadPdfBlob } from '@/features/pdf/api'
import { formatTaipeiDateTime } from '@/lib/utils'
import type { Department } from '@/types'

const ACTIONS_NEEDING_CONFIRM: ApplicationAction[] = [
  'reject',
  'disqualify_eligibility',
  'return_for_edit',
]

const ACTIONS_BY_STATUS: Partial<Record<string, ApplicationAction[]>> = {
  submitted: ['start_eligibility_review'],
  eligibility_review: [
    'qualify_eligibility',
    'disqualify_eligibility',
    'request_supplement',
    'reject',
  ],
  under_review: [
    'request_supplement',
    'return_for_edit',
    'approve',
    'reject',
    'disqualify_eligibility',
  ],
  supplement_required: ['accept_supplement', 'return_for_edit', 'reject'],
  approved: ['begin_funding'],
  funding_decided: ['revise_funding', 'close'],
}

type Section = 'summary' | 'student' | 'form' | 'review' | 'funding' | 'followup' | 'history'

export function AdminApplicationDetailPage() {
  const { applicationId = '' } = useParams()
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState<Section>('summary')

  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [studentMessage, setStudentMessage] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [editOverrideUntil, setEditOverrideUntil] = useState('')

  const [pendingAction, setPendingAction] = useState<ApplicationAction | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [staffUsers, setStaffUsers] = useState<StaffUserAdmin[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [assignStaffId, setAssignStaffId] = useState('')
  const [assignDeptId, setAssignDeptId] = useState('')

  const [fundingPreview, setFundingPreview] = useState<FundingPreviewResponse | null>(null)
  const [approvedMap, setApprovedMap] = useState<Record<string, string>>({})
  const [decisionNote, setDecisionNote] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [notifyStudent, setNotifyStudent] = useState(false)
  const [fundingConfirm, setFundingConfirm] = useState<'complete' | 'revise' | null>(null)

  const [followUpTasks, setFollowUpTasks] = useState<FollowUpTask[]>([])
  const [signedDocs, setSignedDocs] = useState<SignedDocument[]>([])
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskType, setNewTaskType] = useState('file_upload')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskInstructions, setNewTaskInstructions] = useState('')
  const [closeConfirm, setCloseConfirm] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const data = await adminGetApplication(applicationId)
    setDetail(data)
    const [tasks, signed] = await Promise.all([
      adminListFollowUpTasks({ application_id: applicationId }).catch(() => [] as FollowUpTask[]),
      listSignedDocumentsByApplication(applicationId, true).catch(() => [] as SignedDocument[]),
    ])
    setFollowUpTasks(tasks)
    setSignedDocs(signed)
  }, [applicationId])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '載入失敗'))
  }, [load])

  useEffect(() => {
    void Promise.all([adminListStaffUsers().catch(() => []), adminListDepartmentsApi().catch(() => [])])
      .then(([users, depts]) => {
        setStaffUsers(users)
        setDepartments(depts)
      })
  }, [])

  const application = detail?.application
  const availableActions = useMemo(
    () => (application ? ACTIONS_BY_STATUS[application.status] || [] : []),
    [application],
  )

  async function runAction(action: ApplicationAction) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await adminApplicationAction(applicationId, {
        action,
        reason: reason || undefined,
        comment: comment || undefined,
        student_message: studentMessage || undefined,
        internal_note: internalNote || undefined,
        due_at: dueAt || undefined,
        edit_override_until: editOverrideUntil || undefined,
      })
      setMessage(result.message)
      setReason('')
      setComment('')
      setStudentMessage('')
      setInternalNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗')
    } finally {
      setBusy(false)
      setConfirmOpen(false)
      setPendingAction(null)
    }
  }

  function requestAction(action: ApplicationAction) {
    const needsReason = [
      'reject',
      'disqualify_eligibility',
      'return_for_edit',
      'request_supplement',
    ].includes(action)
    if (needsReason && !reason.trim()) {
      setError('請填寫原因')
      return
    }
    if (ACTIONS_NEEDING_CONFIRM.includes(action)) {
      setPendingAction(action)
      setConfirmOpen(true)
      return
    }
    void runAction(action)
  }

  async function loadFundingPreview() {
    setBusy(true)
    setError(null)
    try {
      const preview = await adminFundingPreview(applicationId)
      setFundingPreview(preview)
      const next: Record<string, string> = {}
      for (const item of preview.extracted.items) {
        next[item.item_code] = String(item.requested_amount)
      }
      setApprovedMap(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法載入核定預覽')
    } finally {
      setBusy(false)
    }
  }

  async function submitFunding(isRevise: boolean) {
    if (!fundingPreview) return
    if (isRevise && !changeReason.trim()) {
      setError('修正核定請填寫變更原因')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await adminCreateFunding(applicationId, {
        items: fundingPreview.extracted.items.map((item) => ({
          item_code: item.item_code,
          approved_amount: Number(approvedMap[item.item_code] || 0),
        })),
        decision_note: decisionNote || undefined,
        change_reason: changeReason || undefined,
        student_message: studentMessage || undefined,
        internal_note: internalNote || undefined,
        notify_student: notifyStudent,
      })
      setMessage(result.message)
      setFundingConfirm(null)
      setFundingPreview(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '核定失敗')
    } finally {
      setBusy(false)
    }
  }

  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <Button asChild variant="outline">
          <Link to="/admin/applications">返回列表</Link>
        </Button>
      </div>
    )
  }

  if (!detail || !application) {
    return <p className="text-sm text-muted-foreground">載入中…</p>
  }

  const profile = detail.student.profile as Record<string, unknown> | null
  const snapshot = detail.submission_snapshot

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/admin/applications" className="underline">
              案件管理
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{application.application_number}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={application.status} />
            <StatusBadge status={application.eligibility_status} kind="eligibility" />
          </div>
        </div>
        {detail.pdf ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void downloadPdfBlob(detail.pdf!.id).then((blob) => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${detail.pdf!.document_number}-V${detail.pdf!.document_version}.pdf`
                a.click()
                URL.revokeObjectURL(url)
              })
            }}
          >
            下載 PDF
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['summary', '摘要'],
            ['student', '學生／資格'],
            ['form', '表單內容'],
            ['review', '審核操作'],
            ['funding', '補助核定'],
            ['followup', '附件／追蹤'],
            ['history', '歷程'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={section === key ? 'default' : 'outline'}
            onClick={() => setSection(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {section === 'summary' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">案件摘要</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>項目：{application.category_name || application.category}</p>
            <p>梯次：{application.period_name || application.period}</p>
            <p>學生：{application.student_name}（{application.student_no}）</p>
            <p>單位：{application.department_name || '—'}</p>
            <p>申請金額：{formatAmount(application.requested_amount)}</p>
            <p>核定金額：{formatAmount(application.approved_amount)}</p>
            <p>送件時間：{formatTaipeiDateTime(application.submitted_at)}</p>
            <p>最近審核：{formatTaipeiDateTime(application.latest_reviewed_at)}</p>
            {application.return_reason ? <p>退回原因：{application.return_reason}</p> : null}
            {application.reject_reason ? <p>駁回原因：{application.reject_reason}</p> : null}
            {application.supplement_message ? (
              <p>補件說明：{application.supplement_message}</p>
            ) : null}
            {detail.pdf ? (
              <p>
                PDF：{detail.pdf.document_number} V{detail.pdf.document_version}（
                {detail.pdf.status}）
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === 'student' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">學生資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>學號：{detail.student.student_no}</p>
              <p>姓名：{String(profile?.name || application.student_name || '—')}</p>
              <p>科系：{String(profile?.department_name || application.department_name || '—')}</p>
              <p>年級：{String(profile?.grade || '—')}</p>
              <p>Email：{String(profile?.email || '—')}</p>
              <p>電話：{String(profile?.phone || '—')}</p>
              <p>
                身分證：
                {String(profile?.identity_masked || application.identity_masked || '****')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">本梯次資格資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {!detail.period_profile ? (
                <p className="text-muted-foreground">無 Period Profile</p>
              ) : (
                <>
                  <p>
                    身分類型：
                    {(detail.period_profile.application_identity_types || []).join('、') || '—'}
                  </p>
                  <p>障礙等級：{detail.period_profile.disability_level || '—'}</p>
                  <p>弱勢助學：{detail.period_profile.weak_aid_level || '—'}</p>
                  <p>
                    銀行帳戶：
                    {detail.period_profile.bank_account_registered ? '已登錄' : '未登錄'}
                  </p>
                  <p>確認時間：{formatTaipeiDateTime(detail.period_profile.confirmed_at)}</p>
                </>
              )}
              <div className="border-t border-border pt-3">
                <p className="font-medium">年度補助摘要</p>
                <p>
                  {detail.annual_funding_summary.academic_year} 學年 · 已核定合計{' '}
                  {formatAmount(detail.annual_funding_summary.total_approved)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'form' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">送件快照（唯讀）</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {!snapshot ? (
              <p className="text-muted-foreground">無可用表單快照。</p>
            ) : (
              <pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      ) : null}

      {section === 'review' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">審核操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {availableActions.length === 0 ? (
                <p className="text-muted-foreground">目前狀態無可執行操作（或請至補助核定）。</p>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">原因／說明（部分操作必填）</span>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">學生可見訊息</span>
                    <Input
                      value={studentMessage}
                      onChange={(e) => setStudentMessage(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">內部備註</span>
                    <Input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">審核意見</span>
                    <Input value={comment} onChange={(e) => setComment(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">補件截止（ISO／日期時間）</span>
                    <Input value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">退回修改期限</span>
                    <Input
                      value={editOverrideUntil}
                      onChange={(e) => setEditOverrideUntil(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {availableActions.map((action) => (
                      <Button
                        key={action}
                        type="button"
                        size="sm"
                        variant={
                          action === 'reject' || action === 'disqualify_eligibility'
                            ? 'outline'
                            : 'default'
                        }
                        disabled={busy}
                        onClick={() => requestAction(action)}
                      >
                        {APPLICATION_ACTION_LABELS[action] || action}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">指派承辦／單位</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={assignStaffId}
                  onChange={(e) => setAssignStaffId(e.target.value)}
                >
                  <option value="">選擇承辦人</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}（{u.email}）
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={assignDeptId}
                  onChange={(e) => setAssignDeptId(e.target.value)}
                >
                  <option value="">選擇單位</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy || (!assignStaffId && !assignDeptId)}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      await adminAssignApplication(applicationId, {
                        staff_id: assignStaffId || undefined,
                        department_id: assignDeptId || undefined,
                        assignment_type: 'primary',
                      })
                      setMessage('已指派')
                      await load()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '指派失敗')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                儲存指派
              </Button>
              {detail.assignments.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-3">
                  {detail.assignments.map((a) => (
                    <p key={a.id} className="text-xs text-muted-foreground">
                      {a.assignment_type} · staff={a.staff || '—'} · dept={a.department || '—'} ·{' '}
                      {a.active ? '有效' : '停用'}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">審核紀錄</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {detail.reviews.length === 0 ? (
                <p className="text-muted-foreground">尚無審核紀錄。</p>
              ) : (
                detail.reviews.map((r) => (
                  <div key={r.id} className="rounded-md border border-border p-3">
                    <p className="font-medium">
                      {r.review_type} / {r.decision}
                    </p>
                    <p className="text-muted-foreground">{r.comment || r.student_message || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTaipeiDateTime(r.created)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'funding' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">補助核定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {application.status !== 'funding_pending' &&
              application.status !== 'funding_decided' ? (
                <p className="text-muted-foreground">
                  目前狀態不可核定。請先審核通過並「進入補助核定」。
                </p>
              ) : (
                <>
                  {!fundingPreview ? (
                    <Button type="button" disabled={busy} onClick={() => void loadFundingPreview()}>
                      載入核定項目
                    </Button>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead className="border-b border-border bg-muted/40">
                            <tr>
                              <th className="px-3 py-2">項目</th>
                              <th className="px-3 py-2">申請金額</th>
                              <th className="px-3 py-2">核定金額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fundingPreview.extracted.items.map((item) => (
                              <tr key={item.item_code} className="border-b border-border">
                                <td className="px-3 py-2">{item.item_label}</td>
                                <td className="px-3 py-2">
                                  {formatAmount(item.requested_amount)}
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={item.requested_amount}
                                    value={approvedMap[item.item_code] ?? ''}
                                    onChange={(e) =>
                                      setApprovedMap((prev) => ({
                                        ...prev,
                                        [item.item_code]: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p>
                        申請合計：{formatAmount(fundingPreview.extracted.requested_total)} ·
                        年度已核定：
                        {formatAmount(fundingPreview.annual_funding_summary.total_approved)}
                      </p>
                      {fundingPreview.warnings.length > 0 ? (
                        <div className="space-y-1 text-amber-800">
                          {fundingPreview.warnings.map((w, i) => (
                            <p key={i}>{w.message}</p>
                          ))}
                        </div>
                      ) : null}
                      <label className="block space-y-1">
                        <span className="text-muted-foreground">核定說明</span>
                        <Input
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                        />
                      </label>
                      {application.status === 'funding_decided' ? (
                        <label className="block space-y-1">
                          <span className="text-muted-foreground">變更原因（修正必填）</span>
                          <Input
                            value={changeReason}
                            onChange={(e) => setChangeReason(e.target.value)}
                          />
                        </label>
                      ) : null}
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={notifyStudent}
                          disabled
                          onChange={() => setNotifyStudent(false)}
                        />
                        通知學生（Email 尚未實作）
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setFundingConfirm(
                              application.status === 'funding_decided' ? 'revise' : 'complete',
                            )
                          }
                        >
                          {application.status === 'funding_decided' ? '修正核定' : '完成核定'}
                        </Button>
                        {application.status === 'funding_decided' ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setCloseConfirm(true)}
                          >
                            結案
                          </Button>
                        ) : null}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">核定歷史</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {detail.funding_history.length === 0 ? (
                <p className="text-muted-foreground">尚無核定紀錄。</p>
              ) : (
                detail.funding_history.map((fd) => (
                  <div key={fd.id} className="rounded-md border border-border p-3">
                    <p className="font-medium">
                      V{fd.decision_version} · {fd.status} · 核定{' '}
                      {formatAmount(fd.approved_total)}
                    </p>
                    <p className="text-muted-foreground">
                      {fd.decision_note || fd.change_reason || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTaipeiDateTime(fd.decided_at)}
                    </p>
                    {fd.items?.length ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {fd.items.map((item) => (
                          <li key={item.id}>
                            {item.item_label}：申請 {formatAmount(item.requested_amount)} → 核定{' '}
                            {formatAmount(item.approved_amount)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'followup' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">已簽文件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {signedDocs.length === 0 ? (
                <p className="text-muted-foreground">尚無已簽文件。</p>
              ) : (
                signedDocs.map((doc) => (
                  <div key={doc.id} className="space-y-2 rounded-md border border-border p-3">
                    <p>
                      第 {doc.version_number} 版 · {doc.status}
                      {doc.uploaded_at ? ` · ${formatTaipeiDateTime(doc.uploaded_at)}` : ''}
                    </p>
                    {doc.student_note ? <p>學生備註：{doc.student_note}</p> : null}
                    <SecureFileUpload
                      allowedExtensions={['pdf']}
                      maxFiles={1}
                      maxSizeMb={10}
                      context="signed_document"
                      applicationId={applicationId}
                      value={[doc.attachment]}
                      onChange={() => undefined}
                      disabled
                      asStaff
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">追蹤任務</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      const result = await adminEnsureFollowUpTasks(applicationId)
                      setMessage(
                        result.created > 0
                          ? `已建立 ${result.created} 項預設任務`
                          : '預設任務已就緒',
                      )
                      await load()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '建立失敗')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                確保預設任務
              </Button>

              {followUpTasks.length === 0 ? (
                <p className="text-muted-foreground">尚無追蹤任務。</p>
              ) : (
                <div className="space-y-2">
                  {followUpTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                    >
                      <div>
                        <p className="font-medium">{task.name}</p>
                        <p className="text-muted-foreground">
                          {followUpStatusLabel(task.status)}
                          {task.is_overdue ? '（逾期）' : ''} · {followUpTypeLabel(task.task_type)}
                          {task.due_at ? ` · ${formatTaipeiDateTime(task.due_at)}` : ''}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/tasks/${task.id}`}>處理</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <p className="font-medium">新增追蹤任務</p>
                <label className="block space-y-1">
                  <span className="text-muted-foreground">名稱 *</span>
                  <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-muted-foreground">類型</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                  >
                    <option value="file_upload">檔案上傳</option>
                    <option value="text">文字回報</option>
                    <option value="file_and_text">檔案與文字</option>
                    <option value="event_attendance">活動出席</option>
                    <option value="confirmation">確認事項</option>
                    <option value="other">其他</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-muted-foreground">截止</span>
                  <Input
                    type="datetime-local"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-muted-foreground">學生說明</span>
                  <Input
                    value={newTaskInstructions}
                    onChange={(e) => setNewTaskInstructions(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !newTaskName.trim()}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        const result = await adminCreateFollowUpTask({
                          application_id: applicationId,
                          name: newTaskName.trim(),
                          task_type: newTaskType,
                          due_at: newTaskDue ? new Date(newTaskDue).toISOString() : undefined,
                          student_instructions: newTaskInstructions || undefined,
                          required: true,
                          requires_review: true,
                        })
                        setMessage(result.message)
                        setNewTaskName('')
                        setNewTaskInstructions('')
                        setNewTaskDue('')
                        await load()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : '建立失敗')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  新增任務
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">補件紀錄</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {detail.supplements.length === 0 ? (
                <p className="text-muted-foreground">尚無補件要求。</p>
              ) : (
                detail.supplements.map((s) => (
                  <div key={s.id} className="rounded-md border border-border p-3">
                    <p className="font-medium">{s.status}</p>
                    <p>{s.message}</p>
                    {s.student_reply ? <p>學生回覆：{s.student_reply}</p> : null}
                    <p className="text-xs text-muted-foreground">{formatTaipeiDateTime(s.created)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'history' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">狀態歷程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.status_history.length === 0 ? (
              <p className="text-muted-foreground">尚無歷程。</p>
            ) : (
              detail.status_history.map((h) => (
                <div key={h.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    {h.from_status || '—'} → {h.to_status}
                  </p>
                  <p className="text-muted-foreground">{h.reason || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.changed_by_type} · {formatTaipeiDateTime(h.created)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen && !!pendingAction}
        title={`確認：${pendingAction ? APPLICATION_ACTION_LABELS[pendingAction] || pendingAction : ''}`}
        description="此操作將變更案件狀態，請確認原因與內容無誤。"
        confirmLabel="確認執行"
        confirmVariant="destructive"
        busy={busy}
        onCancel={() => {
          setConfirmOpen(false)
          setPendingAction(null)
        }}
        onConfirm={() => {
          if (pendingAction) void runAction(pendingAction)
        }}
      />

      <ConfirmDialog
        open={!!fundingConfirm}
        title={fundingConfirm === 'revise' ? '確認修正核定？' : '確認完成核定？'}
        description="核定後將更新案件狀態與金額。"
        confirmLabel="確認"
        busy={busy}
        onCancel={() => setFundingConfirm(null)}
        onConfirm={() => void submitFunding(fundingConfirm === 'revise')}
      />

      <ConfirmDialog
        open={closeConfirm}
        title="確認結案？"
        description="結案後案件將標記為已關閉。請確認追蹤任務已處理完畢。"
        confirmLabel="確認結案"
        busy={busy}
        onCancel={() => setCloseConfirm(false)}
        onConfirm={() => {
          void (async () => {
            setBusy(true)
            setError(null)
            try {
              const result = await adminApplicationAction(applicationId, { action: 'close' })
              setMessage(result.message)
              setCloseConfirm(false)
              await load()
            } catch (err) {
              setError(err instanceof Error ? err.message : '結案失敗')
            } finally {
              setBusy(false)
            }
          })()
        }}
      />
    </div>
  )
}
