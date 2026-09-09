import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTaipeiDateTime, cn } from '@/lib/utils'
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
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const unread = isNotificationUnread(item)
        const href = resolveActionHref(item.action_url)
        const isExternal = href ? /^https?:\/\//i.test(href) : false

        return (
          <Card
            key={item.id}
            className={cn(unread && 'border-primary/40 bg-accent/30')}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {unread ? <span className="mr-2 text-xs font-medium text-primary">未讀</span> : null}
                  {item.title}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {formatTaipeiDateTime(item.created)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap text-muted-foreground">{item.message}</p>
              <p className="text-xs text-muted-foreground">
                分類：{notificationCategoryLabel(item.ui_category)}
                {showRecipient && item.recipient_student
                  ? ` · 學生 ${item.recipient_student}`
                  : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {unread && onMarkRead ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={markingId === item.id}
                    onClick={() => onMarkRead(item.id)}
                  >
                    {markingId === item.id ? '處理中…' : '標示已讀'}
                  </Button>
                ) : null}
                {href ? (
                  isExternal ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={href} target="_blank" rel="noreferrer">
                        開啟連結
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link to={href}>前往相關頁面</Link>
                    </Button>
                  )
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
