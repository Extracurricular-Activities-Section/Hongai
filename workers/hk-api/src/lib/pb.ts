import PocketBase from 'pocketbase'

import { assertHkCollection, type WorkerEnv } from './http'

/**
 * Authenticated PocketBase client for server-side use.
 * Credentials come from Worker secrets — never from the browser.
 */
export async function createServicePb(env: WorkerEnv): Promise<PocketBase> {
  const url = env.HK_POCKETBASE_URL
  if (!url) throw new Error('HK_POCKETBASE_URL is not configured')

  const pb = new PocketBase(url)
  pb.autoCancellation(false)

  const email = env.HK_PB_SERVICE_EMAIL
  const password = env.HK_PB_SERVICE_PASSWORD
  if (!email || !password) {
    throw new Error('Service account secrets missing (HK_PB_SERVICE_EMAIL / HK_PB_SERVICE_PASSWORD)')
  }

  // Six-collection schema: service accounts live in hk_staff_users with role="service".
  await pb.collection(assertHkCollection('hk_staff_users')).authWithPassword(email, password)

  return pb
}
