export interface OutreachCounters {
  in_app: number
  email_queued: number
  email_skipped: number
  no_account: number
  failed: number
}

export interface OutreachBatch {
  id: string
  filename: string
  created_at: string
  status: 'imported' | 'sending' | 'completed' | string
  total: number
  invalid: number
  duplicates: number
  processed: number
  remaining: number
  last_sent_at: string | null
  counters: OutreachCounters
  invalid_samples: Array<{ line: number; reason: string }>
}

export interface OutreachImportResponse {
  batch: OutreachBatch
  message: string
}

export interface OutreachSendResponse {
  batch: OutreachBatch
  result: {
    processed: number
    batches: number
    queued: number
    in_app_created: number
    email_skipped: number
    no_account: number
    failed: number
    done: boolean
  }
  mail_provider_configured: boolean
  message: string
}
