/**
 * Map internal/PB errors to a fixed Traditional Chinese message for clients.
 * Details stay in logs / Error.message for operators — never echo upstream text.
 */
export function publicErrorMessage(fallback: string, _err?: unknown): string {
  void _err
  return fallback
}
