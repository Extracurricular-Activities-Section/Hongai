import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const publicLinks = [
  { to: '/', label: '學生登入' },
  { to: '/register', label: '首次註冊' },
  { to: '/help', label: '登入協助' },
]

/**
 * Split shell: an ink brand column that carries the institutional voice, and a
 * light column that holds whatever form the route needs. Collapses to a
 * compact header on small screens.
 */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,26rem)_1fr]">
      <aside className="on-ink relative flex flex-col justify-between bg-ink px-6 py-8 lg:px-10 lg:py-12">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground"
          >
            弘
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-foreground">弘愛築夢申請系統</p>
            <p className="text-[0.6875rem] text-ink-subtle">學生申請入口</p>
          </div>
        </div>

        <div className="hidden lg:block">
          <p className="text-display font-semibold text-ink-foreground">
            一次申請，
            <br />
            全程追蹤。
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-subtle">
            線上填寫申請表、上傳證明文件、追蹤審核進度與後續任務，
            所有紀錄集中在同一個地方。
          </p>
        </div>

        <p className="hidden text-[0.6875rem] text-ink-subtle lg:block">
          若無法登入或資料有誤，請洽學務處承辦人員。
        </p>
      </aside>

      <div className="flex min-h-full flex-col">
        <header className="border-b border-border">
          <nav
            aria-label="公開導覽"
            className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-1 px-4 py-3 sm:px-6"
          >
            {publicLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-pill px-3.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-ink font-medium text-ink-foreground'
                      : 'text-subtle hover:bg-surface-muted hover:text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
