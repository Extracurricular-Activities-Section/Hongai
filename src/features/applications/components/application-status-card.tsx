import { StatusBadge } from './status-badge'
import { formatAmount, studentFacingStatusLabel } from '../utils/status-labels'
import type { Application } from '../types'

export function ApplicationStatusCard({
  application,
  entryStatus,
}: {
  application?: Application | null
  entryStatus?: string | null
}) {
  if (!application) {
    return (
      <p>
        狀態：
        {entryStatus === 'draft' ? '草稿（尚未送件）' : entryStatus ? entryStatus : '尚未開始'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>申請狀態：</span>
        <StatusBadge status={application.status} />
      </div>
      <p className="text-muted-foreground">
        {studentFacingStatusLabel(application.status, {
          approved_amount: application.approved_amount,
        })}
      </p>
      {application.application_number ? (
        <p className="text-xs text-muted-foreground">編號：{application.application_number}</p>
      ) : null}
      {application.status === 'funding_decided' && application.approved_amount != null ? (
        <p className="text-sm">核定金額：{formatAmount(application.approved_amount)}</p>
      ) : null}
      {application.status === 'supplement_required' ? (
        <p className="text-sm text-warning">請至該項目頁面查看補件說明。</p>
      ) : null}
      {application.status === 'returned_for_edit' ? (
        <p className="text-sm text-warning">已退回修改，請重新編輯後送交。</p>
      ) : null}
    </div>
  )
}
