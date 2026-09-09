import { ClientResponseError } from 'pocketbase'
import type { RecordModel } from 'pocketbase'

import { HK_COLLECTIONS, staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { StaffLoginInput } from '@/lib/validation'
import type { IdentityResetRequest, StaffUser } from '@/types'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) {
      return new Error(message)
    }
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

export async function loginStaff(input: StaffLoginInput): Promise<StaffUser> {
  try {
    // Prefer Cloudflare auth gateway when VITE_HK_API_BASE_URL is set.
    if (import.meta.env.VITE_HK_API_BASE_URL?.trim()) {
      const { hkApiSend } = await import('@/lib/api/hk-client')
      const data = await hkApiSend<{ token: string; record: StaffUser & RecordModel }>(
        '/api/hk/auth/staff/login',
        {
          method: 'POST',
          body: input,
        },
      )
      staffPb.authStore.save(data.token, data.record)
      const record = data.record
      if (!record.active || (!record.is_staff && !record.is_admin)) {
        staffPb.authStore.clear()
        throw new Error('登入失敗，請確認帳號狀態與權限。')
      }
      return record
    }

    const result = await staffPb
      .collection(HK_COLLECTIONS.staffUsers)
      .authWithPassword<StaffUser>(input.email, input.password)

    const record = result.record
    if (!record.active || (!record.is_staff && !record.is_admin)) {
      staffPb.authStore.clear()
      throw new Error('登入失敗，請確認帳號狀態與權限。')
    }
    return record
  } catch (error) {
    staffPb.authStore.clear()
    throw mapError(error, '登入失敗，請確認資料後再試。')
  }
}

export async function logoutStaff(): Promise<void> {
  staffPb.authStore.clear()
}

export async function refreshStaffSession(): Promise<boolean> {
  if (!staffPb.authStore.isValid) {
    staffPb.authStore.clear()
    return false
  }
  try {
    const result = await staffPb.collection(HK_COLLECTIONS.staffUsers).authRefresh<StaffUser>()
    const record = result.record
    if (!record.active || (!record.is_staff && !record.is_admin)) {
      staffPb.authStore.clear()
      return false
    }
    return true
  } catch {
    staffPb.authStore.clear()
    return false
  }
}

export async function listIdentityResets(status?: string): Promise<IdentityResetRequest[]> {
  try {
    const query = status ? { status } : undefined
    const data = await staffPb.send<{ items: IdentityResetRequest[] }>(
      '/api/hk/admin/identity-resets',
      {
        method: 'GET',
        query,
      },
    )
    return data.items
  } catch (error) {
    throw mapError(error, '無法載入身分重設申請。')
  }
}

export async function updateIdentityResetStatus(
  id: string,
  status: string,
  resolution_note: string,
): Promise<void> {
  try {
    await staffPb.send(`/api/hk/admin/identity-resets/${id}/status`, {
      method: 'POST',
      body: { status, resolution_note },
    })
  } catch (error) {
    throw mapError(error, '更新狀態失敗，請稍後再試。')
  }
}

export async function unlockStudent(studentId: string): Promise<void> {
  try {
    await staffPb.send(`/api/hk/admin/students/${studentId}/unlock`, {
      method: 'POST',
    })
  } catch (error) {
    throw mapError(error, '解除鎖定失敗，請稍後再試。')
  }
}
