import { RouterProvider } from 'react-router-dom'

import { AppProviders } from '@/app/providers/app-providers'
import { router } from '@/app/router'
import { AppErrorBoundary } from '@/components/error-boundary'

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  )
}
