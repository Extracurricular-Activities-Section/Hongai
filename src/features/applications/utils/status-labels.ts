import type { ApplicationStatus, EligibilityStatus } from '../types'

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: '已送件',
  eligibility_review: '資格審核中',
  under_review: '內容審核中',
  supplement_required: '待補件',
  returned_for_edit: '退回修改',
  approved: '審核通過',
  rejected: '不通過',
  funding_pending: '待核定',
  funding_decided: '已核定',
  closed: '已結案',
}

export const ELIGIBILITY_STATUS_LABELS: Record<EligibilityStatus, string> = {
  pending: '待審核',
  qualified: '資格符合',
  supplement_required: '資格待補件',
  disqualified: '資格不符',
}

export const APPLICATION_ACTION_LABELS: Record<string, string> = {
  start_eligibility_review: '開始資格審核',
  qualify_eligibility: '資格符合',
  disqualify_eligibility: '資格不符',
  request_supplement: '要求補件',
  accept_supplement: '接受補件',
  return_for_edit: '退回修改',
  approve: '審核通過',
  reject: '駁回',
  begin_funding: '進入補助核定',
  decide_funding: '完成核定',
  revise_funding: '修正核定',
  close: '結案',
}

export function applicationStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return APPLICATION_STATUS_LABELS[status as ApplicationStatus] || status
}

export function eligibilityStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return ELIGIBILITY_STATUS_LABELS[status as EligibilityStatus] || status
}

/** Tailwind-friendly badge classes matching existing muted/border patterns. */
export function applicationStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'submitted':
    case 'eligibility_review':
    case 'under_review':
    case 'funding_pending':
      return 'border-border bg-muted text-foreground'
    case 'supplement_required':
    case 'returned_for_edit':
      return 'border-amber-300 bg-amber-50 text-amber-900'
    case 'approved':
    case 'funding_decided':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900'
    case 'rejected':
      return 'border-red-300 bg-red-50 text-red-800'
    case 'closed':
      return 'border-border bg-card text-muted-foreground'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

export function eligibilityStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'qualified':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900'
    case 'supplement_required':
      return 'border-amber-300 bg-amber-50 text-amber-900'
    case 'disqualified':
      return 'border-red-300 bg-red-50 text-red-800'
    case 'pending':
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

/** Short label for student category cards. */
export function studentFacingStatusLabel(
  status: string | null | undefined,
  options?: { approved_amount?: number | null },
): string {
  if (!status) return '尚未送件'
  if (status === 'funding_decided' && options?.approved_amount != null) {
    return `已核定金額：${formatAmount(options.approved_amount)}`
  }
  return applicationStatusLabel(status)
}

export function formatAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('zh-TW').format(Number(value))
}
