import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageLoader } from '@/components/common/states'
import { useStudentAuth } from '@/features/auth/student/context'

export function StudentRouteGuard() {
  const { ready, isAuthenticated } = useStudentAuth()
  const location = useLocation()

  if (!ready) {
    return <PageLoader label="確認登入狀態…" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
