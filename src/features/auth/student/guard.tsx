import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useStudentAuth } from '@/features/auth/student/context'

export function StudentRouteGuard() {
  const { ready, isAuthenticated } = useStudentAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        載入中…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
