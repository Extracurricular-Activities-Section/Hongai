import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { BackofficeAuthProvider } from '@/features/auth/backoffice/context'
import { StudentAuthProvider } from '@/features/auth/student/context'
import { queryClient } from '@/lib/query'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <StudentAuthProvider>
        <BackofficeAuthProvider>{children}</BackofficeAuthProvider>
      </StudentAuthProvider>
    </QueryClientProvider>
  )
}
