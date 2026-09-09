import { BellOff, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { cn, formatTaipeiDateTime } from '@/lib/utils'
import type { HadNotification } from '../types'
import { notificationCategoryLabel } from '../utils/labels'
import { isNotificationUnread } from '../utils/preferences'

function resolveActionHref(actionUrl: string | null): string | null {
  if (!actionUrl) return null
  const trimmed = actionUrl.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * Activity feed rather than a stack of cards: unread is marked by a lime dot
 * and a heavier title, so the eye can scan the column without colour blocks.
 */
export function NotificationList({
  items,
  emptyText = '目前沒有通知。',
  onMarkRead,
  markingId,
  showRecipient = false,
}: {
  items: HadNotification[]
  emptyText?: string
  onMarkRead?: (id: string) => void
  markingId?: string | null
  showRecipient?: boolean
}) {
  if (items.length === 0) {
    return <EmptyState icon={BellOff} title={emptyText} compact />
  }

  return (
    <ul className="overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item) => {
        const unread = isNotificationUnread(item)
        const href = resolveActionHref(item.action_url)
        const isExternal = href ? /^https?:\/\//i.test(href) : false

        return (
          <li
            key={item.id}
            className={cn(
              'relative border-b border-border px-5 py-4 last:border-0',
              unread && 'bg-accent-soft/35',
            )}
          >
            {unread ? (
              <span
                aria-hidden
                className="absolute left-2 top-[1.4rem] size-1.5 rounded-pill bg-accent-strong"
              />
            ) : null}

            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p
                className={cn(
                  'text-sm text-foreground',
                  unread ? 'font-semibold' : 'font-medium',
                )}
              >
                {item.title}
                {unread ? <span className="sr-only">（未讀）</span> : null}
              </p>
              <time className="text-meta text-muted-foreground">
                {formatTaipeiDateTime(item.created)}
              </time>
            </div>

            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-subtle">
              {item.message}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-meta text-muted-foreground">
                {notificationCategoryLabel(item.ui_category)}
                {showRecipient && item.recipient_student
                  ? ` · 學生 ${item.recipient_student}`
                  : null}
              </span>

              {href ? (
                isExternal ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm text-meta font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
                  >
                    開啟連結
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  <Link
                    to={href}
                    className="rounded-sm text-meta font-medium text-foreground underline underline-offset-4 hover:text-accent-strong"
                  >
                    前往相關頁面
                  </Link>
                )
              ) : null}

              {unread && onMarkRead ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={markingId === item.id}
                  onClick={() => onMarkRead(item.id)}
                >
                  {markingId === item.id ? '處理中…' : '標示已讀'}
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
