import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useStudentAuth } from '@/features/auth/student/context'
import { getUnreadNotificationCount } from '@/features/notifications/api'
import { cn } from '@/lib/utils'

const UNREAD_POLL_MS = 60_000

const studentLinks = [
  { to: '/student', label: '學生首頁', end: true },
  { to: '/student/current', label: '目前申請', end: false },
  { to: '/student/tasks', label: '追蹤任務', end: false },
  { to: '/student/notifications', label: '通知', end: false, badgeKey: 'notifications' as const },
  { to: '/student/profile', label: '共用資料', end: false },
  { to: '/student/history', label: '歷史申請', end: false },
]

function StudentNav({
  onNavigate,
  unreadCount,
}: {
  onNavigate?: () => void
  unreadCount: number
}) {
  return (
    <nav className="flex flex-col gap-1 sm:flex-row sm:items-center" aria-label="學生導覽">
      {studentLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent font-medium text-foreground',
            )
          }
        >
          <span className="inline-flex items-center gap-1.5">
            {link.label}
            {'badgeKey' in link && link.badgeKey === 'notifications' && unreadCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </span>
        </NavLink>
      ))}
    </nav>
  )
}

export function StudentLayout() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { logout, studentNo } = useStudentAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function refreshUnread() {
      try {
        const count = await getUnreadNotificationCount()
        if (!cancelled) setUnreadCount(count)
      } catch {
        if (!cancelled) setUnreadCount(0)
      }
    }

    void refreshUnread()
    const timer = window.setInterval(() => void refreshUnread(), UNREAD_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="sm:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="開啟選單">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>學生選單</SheetTitle>
                  </SheetHeader>
                  <StudentNav
                    unreadCount={unreadCount}
                    onNavigate={() => setOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            </div>
            <div>
              <p className="text-sm font-semibold">弘愛築夢 · 學生專區</p>
              <p className="text-xs text-muted-foreground">{studentNo ? `學號 ${studentNo}` : '申請與個人資料'}</p>
            </div>
          </div>

          <div className="hidden sm:block">
            <StudentNav unreadCount={unreadCount} />
          </div>

          <Button variant="outline" size="sm" type="button" onClick={() => void handleLogout()}>
            登出
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
