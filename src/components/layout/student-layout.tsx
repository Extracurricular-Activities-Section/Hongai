import { Bell, FileClock, Home, ListTodo, LogOut, Menu, Sparkles, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useStudentAuth } from '@/features/auth/student/context'
import { getUnreadNotificationCount } from '@/features/notifications/api'
import { cn } from '@/lib/utils'

const UNREAD_POLL_MS = 60_000

/** Five destinations, matching the five things a student actually does. */
const studentLinks = [
  { to: '/student', label: '首頁', icon: Home, end: true },
  { to: '/student/current', label: '目前申請', icon: Sparkles, end: false },
  { to: '/student/tasks', label: '追蹤任務', icon: ListTodo, end: false },
  { to: '/student/notifications', label: '通知', icon: Bell, end: false, showUnread: true },
  { to: '/student/profile', label: '我的資料', icon: UserRound, end: false },
] as const

function StudentNav({
  onNavigate,
  unreadCount,
  orientation,
}: {
  onNavigate?: () => void
  unreadCount: number
  orientation: 'horizontal' | 'vertical'
}) {
  const vertical = orientation === 'vertical'

  return (
    <nav
      aria-label="學生導覽"
      className={cn('flex gap-1', vertical ? 'flex-col' : 'items-center')}
    >
      {studentLinks.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm transition-colors',
                vertical && 'justify-start',
                isActive
                  ? 'bg-ink font-medium text-ink-foreground'
                  : 'text-subtle hover:bg-surface-muted hover:text-foreground',
              )
            }
          >
            {vertical ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            <span>{link.label}</span>
            {'showUnread' in link && link.showUnread && unreadCount > 0 ? (
              <span className="inline-flex min-w-5 justify-center rounded-pill bg-accent px-1.5 py-0.5 text-[0.625rem] font-semibold text-accent-foreground tabular">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </NavLink>
        )
      })}

      {vertical ? (
        <NavLink
          to="/student/history"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'mt-1 flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm transition-colors',
              isActive
                ? 'bg-ink font-medium text-ink-foreground'
                : 'text-subtle hover:bg-surface-muted hover:text-foreground',
            )
          }
        >
          <FileClock className="size-4 shrink-0" aria-hidden />
          歷史申請
        </NavLink>
      ) : null}
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
      <a
        href="#student-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-ink-foreground"
      >
        跳至主要內容
      </a>

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="開啟選單">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>學生專區</SheetTitle>
                </SheetHeader>
                <StudentNav
                  orientation="vertical"
                  unreadCount={unreadCount}
                  onNavigate={() => setOpen(false)}
                />
                <Button
                  variant="outline"
                  type="button"
                  className="mt-auto w-full"
                  onClick={() => void handleLogout()}
                >
                  <LogOut />
                  登出
                </Button>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-[0.8125rem] font-bold text-ink-foreground"
            >
              弘
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">弘愛築夢申請系統</p>
              <p className="truncate text-[0.6875rem] leading-tight text-muted-foreground">
                {studentNo ? `學號 ${studentNo}` : '學生專區'}
              </p>
            </div>
          </div>

          <div className="mx-auto hidden md:block">
            <StudentNav orientation="horizontal" unreadCount={unreadCount} />
          </div>

          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="ml-auto hidden md:inline-flex"
            onClick={() => void handleLogout()}
          >
            <LogOut />
            登出
          </Button>
        </div>
      </header>

      <main id="student-main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
