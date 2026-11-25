import type PocketBase from 'pocketbase'

import { createServicePb } from './pb'
import type { WorkerEnv } from './http'

type Row = Record<string, unknown>

const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Short fingerprint stored on staff record to reject a logged-out JWT. */
export async function tokenFingerprint(token: string): Promise<string> {
  return (await sha256Hex(token)).slice(0, 24)
}

export function staffTokenIsRevoked(record: Row, fingerprint: string): boolean {
  const revoked = obj(record.permissions_json).revoked_token_fps
  return Array.isArray(revoked) && revoked.some((item) => String(item) === fingerprint)
}

async function auditLogout(
  pb: PocketBase,
  input: { collection: 'hk_students' | 'hk_staff_users'; id: string },
): Promise<void> {
  try {
    await pb.collection('hk_events').create({
      event_type: 'auth',
      event_key: input.collection === 'hk_students' ? 'student.logout' : 'staff.logout',
      actor_student: input.collection === 'hk_students' ? input.id : null,
      actor_staff: input.collection === 'hk_staff_users' ? input.id : null,
      target_type: input.collection === 'hk_students' ? 'student' : 'staff',
      target_id: input.id,
      payload_json: { revoked: true },
      occurred_at: new Date().toISOString(),
    })
  } catch {
    // audit is best-effort
  }
}

/**
 * FIX-14 student logout: re-set password to the same identity_last4 as the
 * authenticated user. PocketBase rotates tokenKey on password change, so the
 * presented JWT stops working. (Service accounts cannot write tokenKey.)
 */
async function revokeStudentSession(env: WorkerEnv, token: string): Promise<void> {
  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) return

  const refresh = await fetch(`${base}/api/collections/hk_students/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  if (!refresh.ok) return
  const data = (await refresh.json().catch(() => null)) as {
    record?: { id?: string; identity_last4?: string }
  } | null
  const id = data?.record?.id
  const last4 = String(data?.record?.identity_last4 || '').trim()
  if (!id || !/^[0-9A-Z]{4}$/i.test(last4)) return

  const rotate = await fetch(`${base}/api/collections/hk_students/records/${id}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      oldPassword: last4,
      password: last4,
      passwordConfirm: last4,
    }),
  })
  if (!rotate.ok) return

  try {
    const pb = await createServicePb(env)
    await auditLogout(pb, { collection: 'hk_students', id })
  } catch {
    // ignore
  }
}

/**
 * FIX-14 staff logout: append token fingerprint to permissions_json so
 * requireStaff rejects this JWT. (Staff cannot self-update under service rules;
 * password is unknown to the gateway.)
 */
async function revokeStaffSession(env: WorkerEnv, token: string): Promise<void> {
  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) return

  const refresh = await fetch(`${base}/api/collections/hk_staff_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  if (!refresh.ok) return
  const data = (await refresh.json().catch(() => null)) as {
    record?: { id?: string; permissions_json?: unknown }
  } | null
  const id = data?.record?.id
  if (!id) return

  const fp = await tokenFingerprint(token)
  try {
    const pb = await createServicePb(env)
    const row = (await pb.collection('hk_staff_users').getOne(id)) as Row
    const perms = obj(row.permissions_json)
    const prev = Array.isArray(perms.revoked_token_fps)
      ? perms.revoked_token_fps.map((item) => String(item))
      : []
    const revoked = [...prev.filter((item) => item !== fp), fp].slice(-30)
    await pb.collection('hk_staff_users').update(id, {
      permissions_json: { ...perms, revoked_token_fps: revoked },
    })
    await auditLogout(pb, { collection: 'hk_staff_users', id })
  } catch {
    // best-effort
  }
}

export async function revokeCollectionSession(
  env: WorkerEnv,
  collection: 'hk_students' | 'hk_staff_users',
  bearerToken: string | null,
): Promise<void> {
  const token = bearerToken?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return
  if (collection === 'hk_students') {
    await revokeStudentSession(env, token)
    return
  }
  await revokeStaffSession(env, token)
}
