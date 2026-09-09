/**
 * Mask a Taiwan-style identity number for list UI display only.
 * Does not alter stored values.
 *
 * Example: A123456789 → A123*****9
 */
export function maskIdentityNumber(identityNumber: string): string {
  const value = identityNumber.trim()
  if (value.length < 6) {
    return '*'.repeat(Math.max(value.length, 4))
  }
  const prefix = value.slice(0, 4)
  const suffix = value.slice(-1)
  const maskedLength = Math.max(value.length - 5, 1)
  return `${prefix}${'*'.repeat(maskedLength)}${suffix}`
}

/**
 * Extract last 4 characters for login comparison helpers.
 * Never log the full identity number when calling this.
 */
export function getIdentityLast4(identityNumber: string): string {
  const value = identityNumber.trim()
  return value.slice(-4)
}
