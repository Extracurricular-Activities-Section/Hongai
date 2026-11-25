/** Known placeholder secrets that must never be accepted in runtime. */
export const WEAK_SECRET_VALUES = new Set([
  'hk-dev-pdf-secret',
  'hk-dev-scheduler-secret',
  'changeme',
  'secret',
  'password',
  'test',
])

export function isWeakSecret(value: string | undefined | null): boolean {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  return WEAK_SECRET_VALUES.has(trimmed)
}
