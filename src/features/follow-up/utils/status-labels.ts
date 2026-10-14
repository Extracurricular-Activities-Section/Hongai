import type { FollowUpTaskStatus, FollowUpTaskType } from '../types'

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  pending: '待繳交',
  submitted: '已繳交',
  under_review: '審核中',
  supplement_required: '需補件',
  approved: '已核准',
  rejected: '未通過',
  waived: '已豁免',
  overdue: '已逾期',
}

export const FOLLOW_UP_TYPE_LABELS: Record<string, string> = {
  file_upload: '檔案上傳',
  text: '文字回報',
  file_and_text: '檔案與文字',
  event_attendance: '活動出席',
  confirmation: '確認事項',
  other: '其他',
}

export function followUpStatusLabel(status: FollowUpTaskStatus | string): string {
  return FOLLOW_UP_STATUS_LABELS[status] || status
}

export function followUpTypeLabel(type: FollowUpTaskType | string): string {
  return FOLLOW_UP_TYPE_LABELS[type] || type
}

export function isStudentActionableStatus(status: string, allowResubmit: boolean): boolean {
  return (
    status === 'pending' ||
    status === 'supplement_required' ||
    status === 'overdue' ||
    (status === 'rejected' && allowResubmit)
  )
}

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  submitted: '待審核',
  superseded: '已被新版取代',
  approved: '已核准',
  supplement_required: '需補件',
  rejected: '未通過',
}

export function submissionStatusLabel(status: string): string {
  return SUBMISSION_STATUS_LABELS[status] || status
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function countPendingStudentTasks(
  tasks: Array<{ status: string; is_overdue?: boolean }>,
): number {
  return tasks.filter(
    (task) =>
      task.status === 'pending' ||
      task.status === 'supplement_required' ||
      task.status === 'rejected' ||
      Boolean(task.is_overdue && task.status !== 'approved' && task.status !== 'waived'),
  ).length
}
