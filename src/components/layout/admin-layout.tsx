import {
  Bell,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  FileText,
  LayoutDashboard,
  ListTodo,
  Mail,
  Menu,
  ShieldAlert,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'
import { getStaffUnreadNotificationCount } from '@/features/notifications/api'
import { cn } from '@/lib/utils'

interface AdminNavLink {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
}

function AdminSidebarNav({
  links,
  onNavigate,
}: {
  links: AdminNavLink[]
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="管理後台導覽">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent font-medium text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{link.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
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

  const adminLinks = useMemo(() => {
    const links: Array<AdminNavLink & { show: boolean }> = [
      { to: '/admin', label: '儀表板', icon: LayoutDashboard, end: true, show: true },
      {
        to: '/admin/applications',
        label: '案件管理',
        icon: ClipboardList,
        end: false,
        show: isStaff || isAdmin,
      },
      {
        to: '/admin/tasks',
        label: '追蹤任務',
        icon: ListTodo,
        end: false,
        show: isStaff || isAdmin,
      },
      {
        to: '/admin/follow-up-templates',
        label: '追蹤範本',
        icon: ClipboardCheck,
        end: false,
        show: isAdmin,
      },
      {
        to: '/admin/notifications',
        label: unread > 0 ? `通知中心（${unread}）` : '通知中心',
        icon: Bell,
        end: true,
        show: isStaff || isAdmin,
      },
      {
        to: '/admin/notifications/templates',
        label: '通知範本',
        icon: Mail,
        end: true,
        show: isAdmin,
      },
      { to: '/admin/users', label: '帳號管理', icon: Users, end: false, show: isAdmin },
      { to: '/admin/departments', label: '單位管理', icon: Building2, end: false, show: isAdmin },
      { to: '/admin/periods', label: '申請梯次', icon: CalendarRange, end: false, show: isAdmin },
      { to: '/admin/forms', label: '表單主檔', icon: FileText, end: false, show: isAdmin },
      { to: '/admin/documents', label: '正式文件', icon: FileStack, end: false, show: isAdmin },
      {
        to: '/admin/students',
        label: '學生資料',
        icon: UsersRound,
        end: false,
        show: isStaff || isAdmin,
      },
      {
        to: '/admin/identity-reset',
        label: '身分重設',
        icon: ShieldAlert,
        end: false,
        show: isStaff || isAdmin,
      },
    ]
    return links.filter((link) => link.show).map(({ show: _show, ...link }) => link)
  }, [isAdmin, isStaff, unread])

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
          <div className="flex h-full flex-col px-4 py-5">
            <div className="px-2">
              <p className="text-sm font-semibold">管理後台</p>
              <p className="mt-1 text-xs text-muted-foreground">弘愛築夢申請管理系統</p>
            </div>
            <Separator className="my-4" />
            <AdminSidebarNav links={adminLinks} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="開啟側邊選單">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle>管理選單</SheetTitle>
                    </SheetHeader>
                    <AdminSidebarNav links={adminLinks} onNavigate={() => setOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
              <div>
                <p className="text-sm font-medium">{name || '承辦 / 管理員'}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={() => void handleLogout()}>
              登出
            </Button>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
