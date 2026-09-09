const SENSITIVE_KEY_PATTERN =
  /(identity_number|identity_last4|password|token|auth|authorization|secret|credential)/i

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]'
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeUnknown(value as Record<string, unknown>)
  }
  return value
}

function sanitizeUnknown(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    output[key] = redactValue(key, value)
  }
  return output
}

/**
 * Convert API/PocketBase errors into a safe UI message.
 * Never expose internal stack traces or sensitive payload fields.
 */
export function sanitizeApiError(error: unknown): string {
  if (import.meta.env.DEV && error && typeof error === 'object') {
    const maybe = error as { message?: string; data?: Record<string, unknown> }
    const safeData = maybe.data ? sanitizeUnknown(maybe.data) : undefined
    // Developer console only — still redact sensitive keys.
    console.error('[api-error]', maybe.message ?? 'Unknown error', safeData)
  }

  return '操作失敗，請稍後再試'
}
