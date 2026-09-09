import { ClientResponseError } from 'pocketbase'

import { studentPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { IdentityResetInput } from '@/lib/validation'

const UNIFORM_MESSAGE = '已收到申請，如資料可核對，承辦人員將協助處理。'

export async function submitIdentityReset(input: IdentityResetInput): Promise<string> {
  try {
    const data = await studentPb.send<{ message: string }>('/api/had/identity-reset', {
      method: 'POST',
      body: input,
    })
    return data.message || UNIFORM_MESSAGE
  } catch (error) {
    if (error instanceof ClientResponseError && error.status >= 400 && error.status < 500) {
      const message = error.response?.message
      return typeof message === 'string' && message.trim() ? message : UNIFORM_MESSAGE
    }
    sanitizeApiError(error)
    throw new Error('送出失敗，請稍後再試。')
  }
}
