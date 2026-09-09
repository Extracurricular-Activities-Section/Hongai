import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { studentPb } from '@/lib/pocketbase'
import type { StudentAuthState } from '@/types'

import { logoutStudent, refreshStudentSession } from './api'

interface StudentAuthContextValue extends StudentAuthState {
  ready: boolean
  logout: () => Promise<void>
  refresh: () => Promise<boolean>
}

const StudentAuthContext = createContext<StudentAuthContextValue | null>(null)

function readState(): StudentAuthState {
  const record = studentPb.authStore.record
  const valid = studentPb.authStore.isValid && record?.collectionName === 'hk_students'
  return {
    isAuthenticated: valid,
    studentId: valid ? (record?.id ?? null) : null,
    studentNo: valid ? String(record?.student_no ?? '') || null : null,
  }
}

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<StudentAuthState>(readState)

  useEffect(() => {
    let cancelled = false

    const sync = () => {
      if (!cancelled) setState(readState())
    }

    void (async () => {
      if (studentPb.authStore.isValid) {
        await refreshStudentSession()
      }
      if (!cancelled) {
        sync()
        setReady(true)
      }
    })()

    const unsub = studentPb.authStore.onChange(() => {
      sync()
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const value = useMemo<StudentAuthContextValue>(
    () => ({
      ...state,
      ready,
      logout: async () => {
        await logoutStudent()
        setState(readState())
      },
      refresh: async () => {
        const ok = await refreshStudentSession()
        setState(readState())
        return ok
      },
    }),
    [state, ready],
  )

  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>
}

export function useStudentAuth(): StudentAuthContextValue {
  const ctx = useContext(StudentAuthContext)
  if (!ctx) {
    throw new Error('useStudentAuth must be used within StudentAuthProvider')
  }
  return ctx
}
