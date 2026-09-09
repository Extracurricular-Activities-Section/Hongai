import { RouterProvider } from 'react-router-dom'

import { AppProviders } from '@/app/providers/app-providers'
import { createAppRouter, type AppSurface } from '@/app/router'
import { AppErrorBoundary } from '@/components/error-boundary'

function resolveSurface(): AppSurface {
  const value = document.documentElement.dataset.surface
  if (value === 'apply' || value === 'manage' || value === 'all') {
    return value
  }
  return 'all'
}

const router = createAppRouter(resolveSurface())

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  )
}
