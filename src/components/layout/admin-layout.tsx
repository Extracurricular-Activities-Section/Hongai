import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  FileText,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Scale,
  ShieldAlert,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { getStaffUnreadNotificationCount } from '@/features/notifications/api'
import { cn } from '@/lib/utils'

interface AdminNavLink {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
  badge?: number
}

interface AdminNavGroup {
  id: string
  label: string
  links: AdminNavLink[]
}

function SidebarNav({
  groups,
  onNavigate,
  variant,
}: {
  groups: AdminNavGroup[]
  onNavigate?: () => void
  variant: 'ink' | 'light'
}) {
  const ink = variant === 'ink'

  return (
    <nav aria-label="管理後台導覽" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.id}>
          <p
            className={cn(
              'px-3 pb-2 text-[0.6875rem] font-medium uppercase tracking-wider',
              ink ? 'text-ink-subtle' : 'text-muted-foreground',
            )}
          >
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const Icon = link.icon
              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-accent font-medium text-accent-foreground'
                          : ink
                            ? 'text-ink-subtle hover:bg-white/8 hover:text-ink-foreground'
                            : 'text-subtle hover:bg-surface-muted hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    {link.badge && link.badge > 0 ? (
                      <span
                        className={cn(
                          'inline-flex min-w-5 justify-center rounded-pill px-1.5 py-0.5 text-[0.625rem] font-semibold tabular',
                          ink
                            ? 'bg-white/12 text-ink-foreground'
                            : 'bg-surface-sunken text-foreground',
                        )}
                      >
                        {link.badge > 99 ? '99+' : link.badge}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || '').trim()
  if (!source) return 'HA'
  return source.slice(0, 2).toUpperCase()
}

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { name, email, isAdmin, isStaff, logout } = useBackofficeAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const n = await getStaffUnreadNotificationCount()
        if (!cancelled) setUnread(n)
      } catch {
        if (!cancelled) setUnread(0)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 60000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const navGroups = useMemo<AdminNavGroup[]>(() => {
    const canReview = isStaff || isAdmin
    const groups: Array<{
      id: string
      label: string
      links: Array<AdminNavLink & { show: boolean }>
    }> = [
      {
        id: 'workspace',
        label: '工作區',
        links: [
          { to: '/admin', label: '儀表板', icon: LayoutDashboard, end: true, show: true },
          {
            to: '/admin/applications',
            label: '案件管理',
            icon: ClipboardList,
            end: false,
            show: canReview,
          },
          { to: '/admin/tasks', label: '追蹤任務', icon: ListTodo, end: false, show: canReview },
          {
            to: '/admin/notifications',
            label: '通知中心',
            icon: Bell,
            end: true,
            badge: unread,
            show: canReview,
          },
        ],
      },
      {
        id: 'records',
        label: '資料',
        links: [
          {
            to: '/admin/students',
            label: '學生資料',
            icon: UsersRound,
            end: false,
            show: canReview,
          },
          {
            to: '/admin/documents',
            label: '正式文件',
            icon: FileStack,
            end: false,
            show: isAdmin,
          },
          {
            to: '/admin/funding',
            label: '資助核發',
            icon: Banknote,
            end: false,
            show: canReview,
          },
        ],
      },
      {
        id: 'configuration',
        label: '設定',
        links: [
          { to: '/admin/periods', label: '申請梯次', icon: CalendarRange, end: false, show: isAdmin },
          { to: '/admin/forms', label: '表單主檔', icon: FileText, end: false, show: isAdmin },
          {
            to: '/admin/policy',
            label: '類別政策',
            icon: Scale,
            end: false,
            show: isAdmin,
          },
          {
            to: '/admin/faq',
            label: '常見問題',
            icon: BookOpen,
            end: false,
            show: isAdmin,
          },
          {
            to: '/admin/follow-up-templates',
            label: '追蹤範本',
            icon: ClipboardCheck,
            end: false,
            show: isAdmin,
          },
          {
            to: '/admin/notifications/templates',
            label: '通知範本',
            icon: Mail,
            end: true,
            show: isAdmin,
          },
        ],
      },
      {
        id: 'system',
        label: '系統',
        links: [
          { to: '/admin/users', label: '帳號管理', icon: Users, end: false, show: isAdmin },
          { to: '/admin/departments', label: '單位管理', icon: Building2, end: false, show: isAdmin },
          {
            to: '/admin/identity-reset',
            label: '身分重設',
            icon: ShieldAlert,
            end: false,
            show: canReview,
          },
        ],
      },
    ]

    return groups
      .map((group) => ({
        ...group,
        links: group.links.filter((link) => link.show).map(({ show: _show, ...link }) => link),
      }))
      .filter((group) => group.links.length > 0)
  }, [isAdmin, isStaff, unread])

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-ink-foreground"
      >
        跳至主要內容
      </a>

      <div className="flex min-h-screen">
        <aside className="on-ink hidden w-[15.5rem] shrink-0 bg-ink lg:flex lg:flex-col">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <span
              aria-hidden
              className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-[0.8125rem] font-bold text-accent-foreground"
            >
              弘
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-foreground">弘愛築夢管理系統</p>
              <p className="truncate text-[0.6875rem] text-ink-subtle">承辦工作區</p>
            </div>
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-6">
            <SidebarNav groups={navGroups} variant="ink" />
          </div>

          <div className="border-t border-ink-border p-3">
            <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-white/10 text-[0.6875rem] font-semibold text-ink-foreground"
              >
                {initialsOf(name, email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-foreground">
                  {name || '承辦人員'}
                </p>
                <p className="truncate text-[0.6875rem] text-ink-subtle">{email}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                aria-label="登出"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="開啟管理選單">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="scrollbar-thin overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>管理選單</SheetTitle>
                </SheetHeader>
                <SidebarNav
                  groups={navGroups}
                  variant="light"
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">弘愛築夢管理系統</p>
              <p className="truncate text-[0.6875rem] text-muted-foreground">{name || email}</p>
            </div>

            <Button variant="ghost" size="sm" type="button" onClick={() => void handleLogout()}>
              <LogOut />
              登出
            </Button>
          </header>

          <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
