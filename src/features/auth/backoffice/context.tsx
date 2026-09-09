import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { staffPb } from '@/lib/pocketbase'
import type { BackofficeAuthState } from '@/types'

import { logoutStaff, refreshStaffSession } from './api'

interface BackofficeAuthContextValue extends BackofficeAuthState {
  ready: boolean
  logout: () => Promise<void>
  refresh: () => Promise<boolean>
}

const BackofficeAuthContext = createContext<BackofficeAuthContextValue | null>(null)

function readState(): BackofficeAuthState {
  const record = staffPb.authStore.record
  const valid = staffPb.authStore.isValid && record?.collectionName === 'had_staff_users'
  const isStaff = Boolean(record?.is_staff)
  const isAdmin = Boolean(record?.is_admin)
  const active = Boolean(record?.active)
  return {
    isAuthenticated: valid && active && (isStaff || isAdmin),
    staffId: valid ? (record?.id ?? null) : null,
    email: valid ? String(record?.email ?? '') || null : null,
    name: valid ? String(record?.name ?? '') || null : null,
    isStaff,
    isAdmin,
    active,
  }
}

export function BackofficeAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<BackofficeAuthState>(readState)

  useEffect(() => {
    let cancelled = false

    const sync = () => {
      if (!cancelled) setState(readState())
    }

    void (async () => {
      if (staffPb.authStore.isValid) {
        await refreshStaffSession()
      }
      if (!cancelled) {
        sync()
        setReady(true)
      }
    })()

    const unsub = staffPb.authStore.onChange(() => {
      sync()
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const value = useMemo<BackofficeAuthContextValue>(
    () => ({
      ...state,
      ready,
      logout: async () => {
        await logoutStaff()
        setState(readState())
      },
      refresh: async () => {
        const ok = await refreshStaffSession()
        setState(readState())
        return ok
      },
    }),
    [state, ready],
  )

  return <BackofficeAuthContext.Provider value={value}>{children}</BackofficeAuthContext.Provider>
}

export function useBackofficeAuth(): BackofficeAuthContextValue {
  const ctx = useContext(BackofficeAuthContext)
  if (!ctx) {
    throw new Error('useBackofficeAuth must be used within BackofficeAuthProvider')
  }
  return ctx
}
