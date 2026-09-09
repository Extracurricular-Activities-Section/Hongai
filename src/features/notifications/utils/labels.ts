import type { MailProviderStatus, NotificationDeliveryStatus } from '../types'

export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  application: '申請進度',
  supplement: '補件',
  funding: '補助核定',
  follow_up: '追蹤任務',
  event: '活動提醒',
  system: '系統',
}

export const NOTIFICATION_CATEGORY_OPTIONS = [
  { value: '', label: '全部分類' },
  { value: 'application', label: NOTIFICATION_CATEGORY_LABELS.application },
  { value: 'supplement', label: NOTIFICATION_CATEGORY_LABELS.supplement },
  { value: 'funding', label: NOTIFICATION_CATEGORY_LABELS.funding },
  { value: 'follow_up', label: NOTIFICATION_CATEGORY_LABELS.follow_up },
  { value: 'event', label: NOTIFICATION_CATEGORY_LABELS.event },
  { value: 'system', label: NOTIFICATION_CATEGORY_LABELS.system },
] as const

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  queued: '佇列中',
  sending: '寄送中',
  sent: '已寄出',
  sent_simulated: '模擬寄出',
  failed: '失敗',
  cancelled: '已取消',
}

export const TEMPLATE_CHANNEL_LABELS: Record<string, string> = {
  email: '僅 Email',
  in_app: '僅站內',
  both: '站內與 Email',
}

export function notificationCategoryLabel(category?: string | null): string {
  if (!category) return '未分類'
  return NOTIFICATION_CATEGORY_LABELS[category] || category
}

export function deliveryStatusLabel(status: NotificationDeliveryStatus | string): string {
  return DELIVERY_STATUS_LABELS[status] || status
}

export function templateChannelLabel(channel?: string | null): string {
  if (!channel) return '—'
  return TEMPLATE_CHANNEL_LABELS[channel] || channel
}

/** Banner copy for admin mail provider status — never invent success. */
export function mailProviderBanner(status: MailProviderStatus): {
  tone: 'warning' | 'info' | 'ok'
  title: string
  description: string
} {
  const provider = (status.provider || 'none').toLowerCase()
  if (!status.configured || provider === 'none' || provider === '') {
    return {
      tone: 'warning',
      title: '郵件提供者未設定',
      description: status.notes || '尚未設定 HAD_MAIL_PROVIDER，無法真正寄送信件。',
    }
  }
  if (provider === 'development' || provider === 'console') {
    return {
      tone: 'info',
      title: '開發模式（模擬寄送）',
      description: status.notes || '開發模式：郵件僅模擬發送，不會真正寄出。',
    }
  }
  return {
    tone: 'ok',
    title: `郵件提供者：${provider}`,
    description: status.notes || `寄件者：${status.from || '（未設定）'}`,
  }
}
