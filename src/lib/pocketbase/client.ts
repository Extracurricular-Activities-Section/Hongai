import PocketBase from 'pocketbase'

import { getHkApiBaseUrl, isHkApiViaCloudflare } from '@/lib/api/hk-client'
import { createSessionAuthStore } from './session-auth-store'

/**
 * PocketBase SDK base URL.
 * Prefer Cloudflare Worker gateway (VITE_HK_API_BASE_URL) so the browser never
 * talks to PocketBase directly when the gateway is configured.
 */
const apiBaseUrl = (() => {
  try {
    return getHkApiBaseUrl()
  } catch {
    const fallback = import.meta.env.VITE_POCKETBASE_URL
    if (!fallback) {
      throw new Error(
        'VITE_HK_API_BASE_URL or VITE_POCKETBASE_URL is required. See .env.example.',
      )
    }
    return fallback.replace(/\/+$/, '')
  }
})()

/**
 * Student PocketBase client — separate AuthStore from staff.
 * Do not mix student and staff tokens on the same client.
 */
export const studentPb = new PocketBase(
  apiBaseUrl,
  createSessionAuthStore('hk_student_auth'),
)

/**
 * Staff/Admin PocketBase client — separate AuthStore from students.
 * This is NOT PocketBase Superuser.
 */
export const staffPb = new PocketBase(apiBaseUrl, createSessionAuthStore('hk_staff_auth'))

/** @deprecated Prefer studentPb or staffPb explicitly */
export const pb = studentPb

export const hkGatewayEnabled = isHkApiViaCloudflare()

export default studentPb
