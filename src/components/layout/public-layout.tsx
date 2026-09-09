import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const publicLinks = [
  { to: '/', label: '學生登入' },
  { to: '/register', label: '首次註冊' },
  { to: '/help', label: '登入協助' },
]

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold tracking-wide text-foreground">
              弘愛築夢申請管理系統
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Hong Ai Dream Application Management System</p>
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm" aria-label="公開導覽">
            {publicLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent font-medium text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
