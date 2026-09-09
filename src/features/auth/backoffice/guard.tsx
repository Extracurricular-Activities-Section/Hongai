import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageLoader } from '@/components/common/states'
import { useBackofficeAuth } from '@/features/auth/backoffice/context'

export function BackofficeRouteGuard() {
  const { ready, isAuthenticated } = useBackofficeAuth()
  const location = useLocation()

  if (!ready) {
    return <PageLoader label="確認登入狀態…" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
