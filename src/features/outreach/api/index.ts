import { ClientResponseError } from 'pocketbase'

import { staffPb } from '@/lib/pocketbase'
import { sanitizeApiError } from '@/lib/utils'
import type { OutreachBatch, OutreachImportResponse, OutreachSendResponse } from '../types'

const BASE = '/api/hk/admin/outreach/economically-disadvantaged'

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ClientResponseError) {
    const message = error.response?.message
    if (typeof message === 'string' && message.trim()) return new Error(message)
    if (error.status === 403) return new Error('需要管理員權限')
    if (error.status === 401) return new Error('請先登入')
  }
  sanitizeApiError(error)
  return new Error(fallback)
}

export async function adminListOutreachBatches(): Promise<{
  items: OutreachBatch[]
  mail_provider_configured: boolean
}> {
  try {
    return await staffPb.send(`${BASE}/batches`, { method: 'GET' })
  } catch (error) {
    throw mapError(error, '無法載入名冊批次')
  }
}

export async function adminImportOutreachRoster(
  csv: string,
  filename: string,
): Promise<OutreachImportResponse> {
  try {
    return await staffPb.send(`${BASE}/import`, { method: 'POST', body: { csv, filename } })
  } catch (error) {
    throw mapError(error, '匯入名冊失敗')
  }
}

export async function adminSendOutreachBatch(batchId: string): Promise<OutreachSendResponse> {
  try {
    return await staffPb.send(`${BASE}/send`, {
      method: 'POST',
      body: { batch_id: batchId, batch_size: 50, max_batches: 1 },
    })
  } catch (error) {
    throw mapError(error, '發送通知失敗')
  }
}
