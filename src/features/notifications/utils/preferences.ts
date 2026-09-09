import type { NotificationPreferences, UpdateNotificationPreferencesPayload } from '../types'

/** Fields students may toggle in the preferences UI. */
export const STUDENT_PREF_TOGGLES = [
  {
    key: 'event_reminders' as const,
    label: '活動提醒',
    description: '活動開始前提醒通知。',
  },
  {
    key: 'follow_up_reminders' as const,
    label: '追蹤任務提醒',
    description: '繳交截止前提醒。',
  },
  {
    key: 'email_enabled' as const,
    label: 'Email 通知',
    description: '非關鍵通知是否以 Email 寄送。關鍵系統信仍會寄出。',
  },
]

export type StudentPrefToggleKey = (typeof STUDENT_PREF_TOGGLES)[number]['key']

export function buildPreferencesUpdate(
  prefs: NotificationPreferences,
  patch: Partial<Pick<NotificationPreferences, StudentPrefToggleKey>>,
): UpdateNotificationPreferencesPayload {
  return {
    email_enabled: patch.email_enabled ?? prefs.email_enabled,
    event_reminders: patch.event_reminders ?? prefs.event_reminders,
    follow_up_reminders: patch.follow_up_reminders ?? prefs.follow_up_reminders,
  }
}

export function isNotificationUnread(item: { read_at?: string | null }): boolean {
  return !item.read_at
}
