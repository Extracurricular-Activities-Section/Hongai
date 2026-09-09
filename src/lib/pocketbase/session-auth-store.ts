import { AsyncAuthStore } from 'pocketbase'

/**
 * Session-scoped auth persistence (tab lifetime).
 * Tokens live in sessionStorage — XSS can still read them in an SPA;
 * HttpOnly cookies require a future edge/BFF architecture.
 */
export function createSessionAuthStore(storageKey: string) {
  const initial =
    typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem(storageKey) ?? '') : ''

  return new AsyncAuthStore({
    save: async (serialized) => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(storageKey, serialized)
      }
    },
    clear: async () => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(storageKey)
      }
    },
    initial,
  })
}
