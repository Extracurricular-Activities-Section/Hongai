import { Download, Plus, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AmountDisplay } from '@/components/common/amount-display'
import { ContextCard, ContextPanel, ContextRow } from '@/components/common/context-panel'
import { DataTable, Td, Th } from '@/components/common/data-table'
import { Field } from '@/components/common/field'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, InlineNotice } from '@/components/common/states'
import { Timeline, type TimelineEntry } from '@/components/common/timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import {
  adminApplicationAction,
  adminAssignApplication,
  adminCreateFunding,
  adminFundingPreview,
  adminGetApplication,
  adminListDepartmentsApi,
  adminListStaffUsers,
} from '@/features/applications/api'
import { ConfirmDialog } from '@/features/applications/components/confirm-dialog'
import { StatusBadge } from '@/features/applications/components/status-badge'
import type {
  AdminApplicationDetail,
  ApplicationAction,
  FundingPreviewResponse,
  StaffUserAdmin,
} from '@/features/applications/types'
import { APPLICATION_ACTION_LABELS } from '@/features/applications/utils/status-labels'
import { SecureFileUpload } from '@/features/attachments/components/secure-file-upload'
import {
  adminCreateFollowUpTask,
  adminEnsureFollowUpTasks,
  adminListFollowUpTasks,
} from '@/features/follow-up/api'
import type { FollowUpTask } from '@/features/follow-up/types'
import { followUpStatusLabel, followUpTypeLabel } from '@/features/follow-up/utils/status-labels'
import { downloadPdfBlob } from '@/features/pdf/api'
import {
  listSignedDocumentsByApplication,
  type SignedDocument,
} from '@/features/signed-documents/api'
import { followUpStatusTone } from '@/lib/status/tone'
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

const NEGATIVE_ACTIONS = new Set<ApplicationAction>(['reject', 'disqualify_eligibility'])

const ACTIONS_NEEDING_REASON = new Set<string>([
  'reject',
  'disqualify_eligibility',
  'return_for_edit',
  'request_supplement',
])

type Section = 'summary' | 'student' | 'form' | 'review' | 'funding' | 'followup' | 'history'

/** Readable view of the submitted snapshot, with raw JSON kept one click away. */
function SnapshotView({ snapshot }: { snapshot: unknown }) {
  if (!snapshot || typeof snapshot !== 'object') {
    return <p className="text-sm text-muted-foreground">無可用表單快照。</p>
  }

  const entries = Object.entries(snapshot as Record<string, unknown>)

  return (
    <div className="space-y-5">
      <dl className="divide-y divide-border">
        {entries.map(([key, value]) => {
          const primitive = value == null || typeof value !== 'object'
          return (
            <div key={key} className="grid gap-1 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-meta text-muted-foreground">{key}</dt>
              <dd className="min-w-0 text-sm text-foreground">
                {primitive ? (
                  String(value ?? '—')
                ) : (
                  <pre className="scrollbar-thin max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-surface-muted p-3 text-[0.75rem] leading-relaxed">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-subtle">
          顯示原始 JSON
        </summary>
        <pre className="scrollbar-thin max-h-96 overflow-auto border-t border-border bg-surface-muted p-4 text-[0.75rem] leading-relaxed">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>
    </div>
  )
}

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
    void Promise.all([
      adminListStaffUsers().catch(() => []),
      adminListDepartmentsApi().catch(() => []),
    ]).then(([users, depts]) => {
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
    if (ACTIONS_NEEDING_REASON.has(action) && !reason.trim()) {
      setSection('review')
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
      <div className="space-y-4">
        <ErrorState message={error} />
        <Button asChild variant="outline">
          <Link to="/admin/applications">返回案件清單</Link>
        </Button>
      </div>
    )
  }

  if (!detail || !application) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-96" />
          <Skeleton className="hidden h-72 xl:block" />
        </div>
      </div>
    )
  }

  const profile = detail.student.profile as Record<string, unknown> | null
  const snapshot = detail.submission_snapshot
  const approvedTotal = application.approved_amount

  const tabs: TabItem[] = [
    { value: 'summary', label: '摘要' },
    { value: 'student', label: '學生／資格' },
    { value: 'form', label: '表單內容' },
    { value: 'review', label: '審核操作' },
    { value: 'funding', label: '補助核定', count: detail.funding_history.length || null },
    { value: 'followup', label: '附件／追蹤', count: followUpTasks.length || null },
    { value: 'history', label: '歷程', count: detail.status_history.length || null },
  ]

  const historyEntries: TimelineEntry[] = detail.status_history.map((entry, index) => ({
    id: entry.id,
    title: `${entry.from_status || '建立'} → ${entry.to_status}`,
    meta: formatTaipeiDateTime(entry.created),
    body: (
      <>
        {entry.reason ? <p>{entry.reason}</p> : null}
        <p className="text-meta text-muted-foreground">{entry.changed_by_type}</p>
      </>
    ),
    tone: index === 0 ? 'current' : 'default',
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/admin/applications"
        backLabel="案件管理"
        eyebrow={`${application.category_name || application.category} · ${
          application.period_name || application.period
        }`}
        title={<span className="tabular">{application.application_number}</span>}
        meta={
          <>
            <StatusBadge status={application.status} />
            <StatusBadge status={application.eligibility_status} kind="eligibility" />
          </>
        }
        actions={
          detail.pdf ? (
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
              <Download />
              下載 PDF
            </Button>
          ) : null
        }
      />

      {message ? <InlineNotice tone="positive">{message}</InlineNotice> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Tabs
            items={tabs}
            value={section}
            onValueChange={(value) => setSection(value as Section)}
            ariaLabel="案件檢視分頁"
          />

          <TabPanel value="summary" activeValue={section}>
            <div className="rounded-lg border border-border bg-card p-5">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <ContextRow label="項目" value={application.category_name || application.category} />
                <ContextRow label="梯次" value={application.period_name || application.period} />
                <ContextRow
                  label="學生"
                  value={`${application.student_name}（${application.student_no}）`}
                />
                <ContextRow label="單位" value={application.department_name || '—'} />
                <ContextRow
                  label="申請金額"
                  value={<AmountDisplay value={application.requested_amount} />}
                />
                <ContextRow
                  label="核定金額"
                  value={<AmountDisplay value={application.approved_amount} />}
                />
                <ContextRow
                  label="送件時間"
                  value={formatTaipeiDateTime(application.submitted_at)}
                />
                <ContextRow
                  label="最近審核"
                  value={formatTaipeiDateTime(application.latest_reviewed_at)}
                />
              </dl>

              {application.return_reason ||
              application.reject_reason ||
              application.supplement_message ? (
                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  {application.return_reason ? (
                    <InlineNotice tone="attention" title="退回原因">
                      {application.return_reason}
                    </InlineNotice>
                  ) : null}
                  {application.supplement_message ? (
                    <InlineNotice tone="attention" title="補件說明">
                      {application.supplement_message}
                    </InlineNotice>
                  ) : null}
                  {application.reject_reason ? (
                    <InlineNotice tone="attention" title="駁回原因">
                      {application.reject_reason}
                    </InlineNotice>
                  ) : null}
                </div>
              ) : null}

              {detail.pdf ? (
                <p className="mt-5 border-t border-border pt-4 text-meta text-muted-foreground">
                  PDF：{detail.pdf.document_number} V{detail.pdf.document_version}（
                  {detail.pdf.status}）
                </p>
              ) : null}
            </div>
          </TabPanel>

          <TabPanel value="student" activeValue={section}>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-3 text-card font-semibold text-foreground">學生資料</h2>
                <dl>
                  <ContextRow label="學號" value={detail.student.student_no} />
                  <ContextRow
                    label="姓名"
                    value={String(profile?.name || application.student_name || '—')}
                  />
                  <ContextRow
                    label="科系"
                    value={String(profile?.department_name || application.department_name || '—')}
                  />
                  <ContextRow label="年級" value={String(profile?.grade || '—')} />
                  <ContextRow label="Email" value={String(profile?.email || '—')} />
                  <ContextRow label="電話" value={String(profile?.phone || '—')} />
                  <ContextRow
                    label="身分證"
                    value={String(profile?.identity_masked || application.identity_masked || '****')}
                  />
                </dl>
              </section>

              <section className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-3 text-card font-semibold text-foreground">本梯次資格資料</h2>
                {!detail.period_profile ? (
                  <p className="text-sm text-muted-foreground">無 Period Profile</p>
                ) : (
                  <dl>
                    <ContextRow
                      label="身分類型"
                      value={
                        (detail.period_profile.application_identity_types || []).join('、') || '—'
                      }
                    />
                    <ContextRow
                      label="障礙等級"
                      value={detail.period_profile.disability_level || '—'}
                    />
                    <ContextRow
                      label="弱勢助學"
                      value={detail.period_profile.weak_aid_level || '—'}
                    />
                    <ContextRow
                      label="銀行帳戶"
                      value={
                        <Badge
                          tone={detail.period_profile.bank_account_registered ? 'positive' : 'neutral'}
                        >
                          {detail.period_profile.bank_account_registered ? '已登錄' : '未登錄'}
                        </Badge>
                      }
                    />
                    <ContextRow
                      label="確認時間"
                      value={formatTaipeiDateTime(detail.period_profile.confirmed_at)}
                    />
                  </dl>
                )}

                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-meta text-muted-foreground">
                    {detail.annual_funding_summary.academic_year} 學年已核定合計
                  </p>
                  <p className="mt-1">
                    <AmountDisplay value={detail.annual_funding_summary.total_approved} size="lg" />
                  </p>
                </div>
              </section>
            </div>
          </TabPanel>

          <TabPanel value="form" activeValue={section}>
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">送件快照（唯讀）</h2>
              <SnapshotView snapshot={snapshot} />
            </div>
          </TabPanel>

          <TabPanel value="review" activeValue={section} className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">審核操作</h2>
              {availableActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  目前狀態沒有可執行的審核操作，請改至「補助核定」。
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="review-reason"
                      label="原因／說明"
                      description="退回、駁回、資格不符與補件要求為必填。"
                    >
                      <Input
                        id="review-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </Field>
                    <Field id="review-student-message" label="學生可見訊息">
                      <Input
                        id="review-student-message"
                        value={studentMessage}
                        onChange={(event) => setStudentMessage(event.target.value)}
                      />
                    </Field>
                    <Field id="review-internal-note" label="內部備註">
                      <Input
                        id="review-internal-note"
                        value={internalNote}
                        onChange={(event) => setInternalNote(event.target.value)}
                      />
                    </Field>
                    <Field id="review-comment" label="審核意見">
                      <Input
                        id="review-comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                      />
                    </Field>
                    <Field id="review-due" label="補件截止" description="ISO 或日期時間字串。">
                      <Input
                        id="review-due"
                        value={dueAt}
                        onChange={(event) => setDueAt(event.target.value)}
                      />
                    </Field>
                    <Field id="review-edit-override" label="退回修改期限">
                      <Input
                        id="review-edit-override"
                        value={editOverrideUntil}
                        onChange={(event) => setEditOverrideUntil(event.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    {availableActions.map((action) => (
                      <Button
                        key={action}
                        type="button"
                        size="sm"
                        variant={NEGATIVE_ACTIONS.has(action) ? 'danger-outline' : 'default'}
                        disabled={busy}
                        onClick={() => requestAction(action)}
                      >
                        {APPLICATION_ACTION_LABELS[action] || action}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">指派承辦／單位</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="assign-staff" label="承辦人">
                  <Select
                    id="assign-staff"
                    value={assignStaffId}
                    onChange={(event) => setAssignStaffId(event.target.value)}
                  >
                    <option value="">未指定</option>
                    {staffUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}（{user.email}）
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="assign-dept" label="單位">
                  <Select
                    id="assign-dept"
                    value={assignDeptId}
                    onChange={(event) => setAssignDeptId(event.target.value)}
                  >
                    <option value="">未指定</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Button
                type="button"
                size="sm"
                className="mt-4"
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
                <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                  {detail.assignments.map((item) => (
                    <li key={item.id} className="text-meta text-muted-foreground">
                      {item.assignment_type} · staff={item.staff || '—'} · dept=
                      {item.department || '—'} · {item.active ? '有效' : '停用'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">審核紀錄</h2>
              {detail.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無審核紀錄。</p>
              ) : (
                <Timeline
                  entries={detail.reviews.map((review, index) => ({
                    id: review.id,
                    title: `${review.review_type} · ${review.decision}`,
                    meta: formatTaipeiDateTime(review.created),
                    body: review.comment || review.student_message || '—',
                    tone: index === 0 ? 'current' : 'default',
                  }))}
                />
              )}
            </section>
          </TabPanel>

          <TabPanel value="funding" activeValue={section} className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">補助核定</h2>

              {application.status !== 'funding_pending' &&
              application.status !== 'funding_decided' ? (
                <p className="text-sm text-muted-foreground">
                  目前狀態不可核定。請先審核通過並執行「進入補助核定」。
                </p>
              ) : !fundingPreview ? (
                <Button type="button" disabled={busy} onClick={() => void loadFundingPreview()}>
                  <Sparkles />
                  載入核定項目
                </Button>
              ) : (
                <div className="space-y-5">
                  <DataTable
                    caption="核定項目"
                    minWidth="34rem"
                    head={
                      <>
                        <Th>項目</Th>
                        <Th align="right">申請金額</Th>
                        <Th align="right">核定金額</Th>
                      </>
                    }
                  >
                    {fundingPreview.extracted.items.map((item) => (
                      <tr key={item.item_code} className="border-b border-border last:border-0">
                        <Td>{item.item_label}</Td>
                        <Td align="right">
                          <AmountDisplay value={item.requested_amount} muted />
                        </Td>
                        <Td align="right">
                          <Input
                            type="number"
                            min={0}
                            max={item.requested_amount}
                            aria-label={`${item.item_label} 核定金額`}
                            className="ml-auto h-9 w-32 text-right tabular"
                            value={approvedMap[item.item_code] ?? ''}
                            onChange={(event) =>
                              setApprovedMap((prev) => ({
                                ...prev,
                                [item.item_code]: event.target.value,
                              }))
                            }
                          />
                        </Td>
                      </tr>
                    ))}
                  </DataTable>

                  <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-surface-muted px-4 py-3">
                    <div>
                      <p className="text-meta text-muted-foreground">申請合計</p>
                      <AmountDisplay value={fundingPreview.extracted.requested_total} />
                    </div>
                    <div>
                      <p className="text-meta text-muted-foreground">年度已核定</p>
                      <AmountDisplay
                        value={fundingPreview.annual_funding_summary.total_approved}
                      />
                    </div>
                  </div>

                  {fundingPreview.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {fundingPreview.warnings.map((warning, index) => (
                        <InlineNotice key={index} tone="attention">
                          {warning.message}
                        </InlineNotice>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="funding-note" label="核定說明">
                      <Textarea
                        id="funding-note"
                        value={decisionNote}
                        onChange={(event) => setDecisionNote(event.target.value)}
                      />
                    </Field>
                    {application.status === 'funding_decided' ? (
                      <Field
                        id="funding-change-reason"
                        label="變更原因"
                        required
                        description="修正既有核定時必填。"
                      >
                        <Textarea
                          id="funding-change-reason"
                          value={changeReason}
                          onChange={(event) => setChangeReason(event.target.value)}
                        />
                      </Field>
                    ) : null}
                  </div>

                  <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-accent-strong"
                      checked={notifyStudent}
                      disabled
                      onChange={() => setNotifyStudent(false)}
                    />
                    通知學生（Email 尚未實作）
                  </label>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="brand"
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
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">核定歷史</h2>
              {detail.funding_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無核定紀錄。</p>
              ) : (
                <Timeline
                  entries={detail.funding_history.map((record, index) => ({
                    id: record.id,
                    title: (
                      <>
                        V{record.decision_version} · {record.status} · 核定{' '}
                        <AmountDisplay value={record.approved_total} />
                      </>
                    ),
                    meta: formatTaipeiDateTime(record.decided_at),
                    tone: index === 0 ? 'current' : 'default',
                    body: (
                      <>
                        <p>{record.decision_note || record.change_reason || '—'}</p>
                        {record.items?.length ? (
                          <ul className="mt-2 space-y-0.5 text-meta text-muted-foreground">
                            {record.items.map((item) => (
                              <li key={item.id}>
                                {item.item_label}：申請{' '}
                                <AmountDisplay value={item.requested_amount} size="sm" muted /> → 核定{' '}
                                <AmountDisplay value={item.approved_amount} size="sm" />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ),
                  }))}
                />
              )}
            </section>
          </TabPanel>

          <TabPanel value="followup" activeValue={section} className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">已簽文件</h2>
              {signedDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無已簽文件。</p>
              ) : (
                <div className="space-y-4">
                  {signedDocs.map((doc) => (
                    <div key={doc.id} className="rounded-md border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          第 {doc.version_number} 版
                        </span>
                        <Badge tone="neutral">{doc.status}</Badge>
                        {doc.uploaded_at ? (
                          <span className="text-meta text-muted-foreground">
                            {formatTaipeiDateTime(doc.uploaded_at)}
                          </span>
                        ) : null}
                      </div>
                      {doc.student_note ? (
                        <p className="mt-2 text-sm text-subtle">學生備註：{doc.student_note}</p>
                      ) : null}
                      <div className="mt-3">
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
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-card font-semibold text-foreground">追蹤任務</h2>
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
              </div>

              {followUpTasks.length === 0 ? (
                <EmptyState compact title="尚無追蹤任務" description="可建立預設任務或於下方新增。" />
              ) : (
                <ul className="divide-y divide-border">
                  {followUpTasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{task.name}</p>
                        <p className="mt-0.5 text-meta text-muted-foreground">
                          {followUpTypeLabel(task.task_type)}
                          {task.due_at ? ` · 截止 ${formatTaipeiDateTime(task.due_at)}` : ''}
                        </p>
                      </div>
                      <Badge tone={followUpStatusTone(task.status, task.is_overdue)}>
                        {task.is_overdue ? '已逾期' : followUpStatusLabel(task.status)}
                      </Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/tasks/${task.id}`}>處理</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-foreground">新增追蹤任務</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="task-name" label="名稱" required>
                    <Input
                      id="task-name"
                      value={newTaskName}
                      onChange={(event) => setNewTaskName(event.target.value)}
                    />
                  </Field>
                  <Field id="task-type" label="類型">
                    <Select
                      id="task-type"
                      value={newTaskType}
                      onChange={(event) => setNewTaskType(event.target.value)}
                    >
                      <option value="file_upload">檔案上傳</option>
                      <option value="text">文字回報</option>
                      <option value="file_and_text">檔案與文字</option>
                      <option value="event_attendance">活動出席</option>
                      <option value="confirmation">確認事項</option>
                      <option value="other">其他</option>
                    </Select>
                  </Field>
                  <Field id="task-due" label="截止">
                    <Input
                      id="task-due"
                      type="datetime-local"
                      value={newTaskDue}
                      onChange={(event) => setNewTaskDue(event.target.value)}
                    />
                  </Field>
                  <Field id="task-instructions" label="學生說明">
                    <Input
                      id="task-instructions"
                      value={newTaskInstructions}
                      onChange={(event) => setNewTaskInstructions(event.target.value)}
                    />
                  </Field>
                </div>
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
                  <Plus />
                  新增任務
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">補件紀錄</h2>
              {detail.supplements.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無補件要求。</p>
              ) : (
                <Timeline
                  entries={detail.supplements.map((item, index) => ({
                    id: item.id,
                    title: item.status,
                    meta: formatTaipeiDateTime(item.created),
                    tone: index === 0 ? 'current' : 'default',
                    body: (
                      <>
                        <p>{item.message}</p>
                        {item.student_reply ? <p className="mt-1">學生回覆：{item.student_reply}</p> : null}
                      </>
                    ),
                  }))}
                />
              )}
            </section>
          </TabPanel>

          <TabPanel value="history" activeValue={section}>
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 text-card font-semibold text-foreground">狀態歷程</h2>
              {historyEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無歷程。</p>
              ) : (
                <Timeline entries={historyEntries} />
              )}
            </section>
          </TabPanel>
        </div>

        <ContextPanel>
          <ContextCard title="金額">
            <dl>
              <ContextRow
                label="申請金額"
                value={<AmountDisplay value={application.requested_amount} />}
              />
              <ContextRow
                label="核定金額"
                emphasis
                value={<AmountDisplay value={approvedTotal} size="lg" />}
              />
              <ContextRow
                label={`${detail.annual_funding_summary.academic_year} 學年累計`}
                value={<AmountDisplay value={detail.annual_funding_summary.total_approved} />}
              />
            </dl>
          </ContextCard>

          <ContextCard title="現在可以做什麼">
            {availableActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                此狀態沒有待辦操作。
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={NEGATIVE_ACTIONS.has(action) ? 'danger-outline' : 'outline'}
                    disabled={busy}
                    onClick={() => requestAction(action)}
                  >
                    {APPLICATION_ACTION_LABELS[action] || action}
                  </Button>
                ))}
                <p className="mt-1 text-meta text-muted-foreground">
                  需填寫原因的操作會帶你回「審核操作」分頁。
                </p>
              </div>
            )}
          </ContextCard>

          <ContextCard title="追蹤任務">
            {followUpTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無任務。</p>
            ) : (
              <ul className="space-y-2">
                {followUpTasks.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2">
                    <Link
                      to={`/admin/tasks/${task.id}`}
                      className="min-w-0 flex-1 truncate rounded-sm text-sm text-foreground hover:text-accent-strong"
                    >
                      {task.name}
                    </Link>
                    <Badge tone={followUpStatusTone(task.status, task.is_overdue)}>
                      {task.is_overdue ? '逾期' : followUpStatusLabel(task.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </ContextCard>
        </ContextPanel>
      </div>

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
