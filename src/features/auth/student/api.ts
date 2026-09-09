import { ClientResponseError } from 'pocketbase'

import type { RecordModel } from 'pocketbase'

import { studentPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { StudentLoginInput, StudentProfileUpdateInput, StudentRegisterInput } from '@/lib/validation'
import type { StudentMeResponse, StudentProfile } from '@/types'

type AuthPayload = {
  token: string
  record: RecordModel
}

function mapAuthError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) {
      return new Error(message)
    }
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

export async function registerStudent(input: StudentRegisterInput): Promise<void> {
  try {
    const data = await studentPb.send<AuthPayload>('/api/had/auth/register', {
      method: 'POST',
      body: input,
    })
    studentPb.authStore.save(data.token, data.record)
  } catch (error) {
    throw mapAuthError(error, '註冊失敗，請稍後再試或聯絡承辦。')
  }
}

export async function loginStudent(input: StudentLoginInput): Promise<void> {
  try {
    const data = await studentPb.send<AuthPayload>('/api/had/auth/login', {
      method: 'POST',
      body: input,
    })
    studentPb.authStore.save(data.token, data.record)
  } catch (error) {
    throw mapAuthError(error, '登入失敗，請確認資料後再試。')
  }
}

export async function logoutStudent(): Promise<void> {
  try {
    if (studentPb.authStore.isValid) {
      await studentPb.send('/api/had/auth/logout', { method: 'POST' })
    }
  } catch {
    // still clear local session
  } finally {
    studentPb.authStore.clear()
  }
}

export async function fetchStudentMe(): Promise<StudentMeResponse> {
  try {
    return await studentPb.send<StudentMeResponse>('/api/had/student/me', { method: 'GET' })
  } catch (error) {
    throw mapAuthError(error, '無法載入學生資料，請重新登入。')
  }
}

export async function updateStudentProfile(
  input: StudentProfileUpdateInput,
): Promise<StudentProfile> {
  try {
    const data = await studentPb.send<{ success: boolean; profile: StudentProfile }>(
      '/api/had/student/profile/update',
      {
        method: 'POST',
        body: input,
      },
    )
    return data.profile
  } catch (error) {
    throw mapAuthError(error, '資料更新失敗，請稍後再試。')
  }
}

export async function refreshStudentSession(): Promise<boolean> {
  if (!studentPb.authStore.isValid) {
    studentPb.authStore.clear()
    return false
  }
  try {
    await studentPb.collection('had_students').authRefresh()
    return true
  } catch {
    studentPb.authStore.clear()
    return false
  }
}
