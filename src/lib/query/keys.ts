export const queryKeys = {
  root: ['hong-ai-dream'] as const,
  student: {
    all: ['hong-ai-dream', 'student'] as const,
    profile: () => [...queryKeys.student.all, 'profile'] as const,
    history: () => [...queryKeys.student.all, 'history'] as const,
  },
  admin: {
    all: ['hong-ai-dream', 'admin'] as const,
    users: () => [...queryKeys.admin.all, 'users'] as const,
    departments: () => [...queryKeys.admin.all, 'departments'] as const,
    periods: () => [...queryKeys.admin.all, 'periods'] as const,
    students: () => [...queryKeys.admin.all, 'students'] as const,
    identityReset: () => [...queryKeys.admin.all, 'identity-reset'] as const,
  },
} as const

export { queryClient } from './client'
