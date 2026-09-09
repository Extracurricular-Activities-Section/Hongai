import PocketBase from 'pocketbase'

import { createSessionAuthStore } from './session-auth-store'

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL

if (!pocketBaseUrl) {
  throw new Error(
    'VITE_POCKETBASE_URL is not defined. Copy .env.example to .env and set the PocketBase URL.',
  )
}

/**
 * Student PocketBase client — separate AuthStore from staff.
 * Do not mix student and staff tokens on the same client.
 */
export const studentPb = new PocketBase(
  pocketBaseUrl,
  createSessionAuthStore('had_student_auth'),
)

/**
 * Staff/Admin PocketBase client — separate AuthStore from students.
 * This is NOT PocketBase Superuser.
 */
export const staffPb = new PocketBase(pocketBaseUrl, createSessionAuthStore('had_staff_auth'))

/** @deprecated Prefer studentPb or staffPb explicitly */
export const pb = studentPb

export default studentPb
