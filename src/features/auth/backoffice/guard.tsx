import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useBackofficeAuth } from '@/features/auth/backoffice/context'

export function BackofficeRouteGuard() {
  const { ready, isAuthenticated } = useBackofficeAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        載入中…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
