/**
 * Student Auth Gateway.
 *
 * Six-collection schema: student account and profile fields live together in
 * hk_students. Students still log in with the UI's student_no + identity_last4
 * flow; PocketBase only stores/authenticates the backing auth record.
 */

import { maskIdentity } from '../lib/applications'
import { revokeCollectionSession } from '../lib/auth-revoke'
import { encryptIdentityNumber, hashIdentityNumber } from '../lib/identity-hash'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import { publicErrorMessage } from '../lib/public-error'

type StudentLoginBody = {
  student_no?: string
  identity_last4?: string
}

type StudentRegisterBody = StudentLoginBody & {
  identity_number?: string
  name?: string
  gender?: string
  division?: string
  program_type?: string
  grade?: string
  department_name?: string
  phone?: string
  line_id?: string
  email?: string
  bank_account_registered?: boolean
  bank_account_note?: string
}

function normalizeStudentNo(value: unknown): string {
  return String(value || '').trim()
}

function normalizeLast4(value: unknown): string {
  return String(value || '').trim().toUpperCase()
}

function studentInternalEmail(studentNo: string): string {
  return `hk.${encodeURIComponent(studentNo.toLowerCase())}@students.hongai.internal`
}

function publicStudentRecord(record: Record<string, unknown>): Record<string, unknown> {
  const {
    identity_encrypted,
    identity_hash,
    identity_last4,
    password,
    tokenKey,
    expand,
    collectionId,
    collectionName,
    ...safe
  } = record
  void identity_encrypted
  void identity_hash
  void identity_last4
  void password
  void tokenKey
  void expand
  void collectionId
  void collectionName
  return safe
}

/** FIX-05: progressive lockout — never permanent without admin unlock. */
const LOCKOUT_FAIL_THRESHOLD = 5
const LOCKOUT_MINUTES = [5, 15, 30, 60] as const

function lockoutDurationMs(failCount: number): number {
  const index = Math.min(
    Math.max(failCount - LOCKOUT_FAIL_THRESHOLD, 0),
    LOCKOUT_MINUTES.length - 1,
  )
  return LOCKOUT_MINUTES[index] * 60_000
}

async function findStudentByNo(
  env: WorkerEnv,
  studentNo: string,
): Promise<Record<string, unknown> | null> {
  try {
    const pb = await createServicePb(env)
    return (await pb.collection('hk_students').getFirstListItem(
      pb.filter('student_no = {:no}', { no: studentNo }),
    )) as Record<string, unknown>
  } catch {
    return null
  }
}

async function studentAuthWithLast4(
  env: WorkerEnv,
  studentNo: string,
  identityLast4: string,
): Promise<Response> {
  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: '系統服務未設定，請聯絡承辦。' }, { status: 500 })
  }

  const existing = await findStudentByNo(env, studentNo)
  if (existing) {
    const lockedUntil = existing.locked_until ? Date.parse(String(existing.locked_until)) : NaN
    if (!Number.isNaN(lockedUntil) && lockedUntil > Date.now()) {
      return json(
        {
          error: 'account_locked',
          message: '登入嘗試過於頻繁，帳號已暫時鎖定。請稍後再試，或透過身分重設協助解除。',
        },
        { status: 423 },
      )
    }
  }

  const upstream = await fetch(`${base}/api/collections/hk_students/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identity: studentInternalEmail(studentNo),
      password: identityLast4,
    }),
  })

  const data = (await upstream.json().catch(() => null)) as {
    token?: string
    record?: Record<string, unknown>
  } | null

  if (!upstream.ok || !data?.token || !data.record) {
    if (existing?.id) {
      try {
        const pb = await createServicePb(env)
        const fails = Number(existing.failed_login_count) || 0
        const next = fails + 1
        const patch: Record<string, unknown> = { failed_login_count: next }
        if (next >= LOCKOUT_FAIL_THRESHOLD) {
          patch.locked_until = new Date(Date.now() + lockoutDurationMs(next)).toISOString()
        }
        await pb.collection('hk_students').update(String(existing.id), patch)
      } catch {
        /* best-effort lockout bookkeeping */
      }
    }
    return json(
      { error: 'unauthorized', message: '學號或身分驗證資料錯誤。' },
      { status: 401 },
    )
  }

  try {
    const pb = await createServicePb(env)
    await pb.collection('hk_students').update(String(data.record.id), {
      failed_login_count: 0,
      locked_until: null,
    })
  } catch {
    /* login succeeded; clearing counters is best-effort */
  }

  return json({
    token: data.token,
    record: publicStudentRecord(data.record),
  })
}

export async function handleStudentAuth(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path === '/api/hk/auth/logout' && request.method === 'POST') {
    // FIX-14: rotate tokenKey so the presented JWT cannot be reused.
    const token = request.headers.get('authorization')
    await revokeCollectionSession(env, 'hk_students', token)
    return json({ success: true })
  }

  if (path === '/api/hk/auth/login' && request.method === 'POST') {
    let body: StudentLoginBody
    try {
      body = (await request.json()) as StudentLoginBody
    } catch {
      return json({ error: 'bad_request', message: '請求格式錯誤。' }, { status: 400 })
    }

    const studentNo = normalizeStudentNo(body.student_no)
    const identityLast4 = normalizeLast4(body.identity_last4)
    if (!studentNo || !/^[0-9A-Z]{4}$/.test(identityLast4)) {
      return json({ error: 'bad_request', message: '學號或身分驗證資料錯誤。' }, { status: 400 })
    }

    return studentAuthWithLast4(env, studentNo, identityLast4)
  }

  if (path === '/api/hk/auth/register' && request.method === 'POST') {
    let body: StudentRegisterBody
    try {
      body = (await request.json()) as StudentRegisterBody
    } catch {
      return json({ error: 'bad_request', message: '請求格式錯誤。' }, { status: 400 })
    }

    const studentNo = normalizeStudentNo(body.student_no)
    const identityNumber = String(body.identity_number || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
    const identityLast4 = normalizeLast4(body.identity_last4 || identityNumber.slice(-4))
    const contactEmail = String(body.email || '')
      .trim()
      .toLowerCase()
    if (
      !studentNo ||
      !/^[A-Z][0-9]{9}$/.test(identityNumber) ||
      !/^[0-9A-Z]{4}$/.test(identityLast4) ||
      !body.name
    ) {
      return json(
        {
          error: 'bad_request',
          message: '註冊資料不完整或格式錯誤（身分證須為 1 碼英文＋9 碼數字）',
        },
        { status: 400 },
      )
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return json({ error: 'bad_request', message: '請輸入有效 Email' }, { status: 400 })
    }

    let pb
    try {
      pb = await createServicePb(env)
    } catch (err) {
      return json(
        {
          error: 'service_account_required',
          message: publicErrorMessage('系統服務未設定，請聯絡承辦。', err),
        },
        { status: 503 },
      )
    }

    let identityHash: string
    let identityEncrypted: string
    try {
      identityHash = await hashIdentityNumber(identityNumber, env.HK_IDENTITY_PEPPER)
      identityEncrypted = await encryptIdentityNumber(identityNumber, env.HK_IDENTITY_PEPPER)
    } catch {
      return json(
        {
          error: 'misconfigured',
          message: '系統身分保護金鑰未設定，暫時無法註冊。請聯絡承辦。',
        },
        { status: 503 },
      )
    }

    try {
      const existing = await pb
        .collection('hk_students')
        .getFirstListItem(`student_no="${studentNo.replace(/"/g, '\\"')}"`)
        .catch(() => null)

      // FIX-01: never overwrite password / identity / contact on an existing account.
      // Recovery must go through the independent identity-reset flow.
      if (existing) {
        return json(
          {
            error: 'already_registered',
            message: '此學號已註冊。請直接登入；若無法登入，請使用身分重設協助，勿重複註冊。',
          },
          { status: 409 },
        )
      }

      // Do not set `verified` here: PocketBase only allows superusers to force-verify,
      // and the Worker must use the service account (not Superuser). Login authRule is active=true.
      await pb.collection('hk_students').create({
        email: studentInternalEmail(studentNo),
        emailVisibility: false,
        student_no: studentNo,
        password: identityLast4,
        passwordConfirm: identityLast4,
        identity_last4: identityLast4,
        identity_hash: identityHash,
        identity_encrypted: identityEncrypted,
        name: body.name,
        gender: body.gender || '',
        division: body.division || '',
        program_type: body.program_type || '',
        grade: body.grade || '',
        department_name: body.department_name || '',
        phone: body.phone || '',
        line_id: body.line_id || '',
        bank_account_registered: Boolean(body.bank_account_registered),
        bank_account_note: body.bank_account_note || '',
        active: true,
        failed_login_count: 0,
        profile_json: {
          contact_email: contactEmail,
          original_registration_email: contactEmail,
        },
        notification_preferences_json: {
          email_enabled: true,
          in_app_enabled: true,
          event_reminders: true,
          follow_up_reminders: true,
        },
        registered_at: new Date().toISOString(),
      })
    } catch (err) {
      return json(
        {
          error: 'register_failed',
          message: publicErrorMessage('註冊失敗，請稍後再試或聯絡承辦。', err),
        },
        { status: 400 },
      )
    }

    return studentAuthWithLast4(env, studentNo, identityLast4)
  }

  if (path === '/api/hk/student/me' && request.method === 'GET') {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized', message: '請先登入' }, { status: 401 })

    const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
    if (!base) {
      return json({ error: 'misconfigured', message: '系統服務未設定，請聯絡承辦。' }, { status: 500 })
    }

    const upstream = await fetch(`${base}/api/collections/hk_students/auth-refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const data = (await upstream.json().catch(() => null)) as {
      record?: Record<string, unknown>
    } | null
    if (!upstream.ok || !data?.record) {
      return json({ error: 'unauthorized', message: '請重新登入' }, { status: 401 })
    }

    const maskedIdentity = maskIdentity(data.record.identity_last4)
    const record = publicStudentRecord(data.record)
    const contactEmail =
      typeof record.profile_json === 'object' &&
      record.profile_json !== null &&
      'contact_email' in record.profile_json
        ? (record.profile_json as { contact_email?: string }).contact_email || ''
        : ''
    return json({
      student: record,
      profile: {
        ...record,
        student: record.id,
        email: contactEmail,
        identity_number: maskedIdentity,
        identity_number_masked: maskedIdentity,
      },
    })
  }

  if (path === '/api/hk/student/profile/update' && request.method === 'POST') {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized', message: '請先登入' }, { status: 401 })

    const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
    if (!base) {
      return json({ error: 'misconfigured', message: '系統服務未設定，請聯絡承辦。' }, { status: 500 })
    }

    const refresh = await fetch(`${base}/api/collections/hk_students/auth-refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const refreshed = (await refresh.json().catch(() => null)) as {
      record?: Record<string, unknown>
    } | null
    if (!refresh.ok || !refreshed?.record?.id) {
      return json({ error: 'unauthorized', message: '請重新登入' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return json({ error: 'bad_request', message: '請求格式錯誤。' }, { status: 400 })

    let pb
    try {
      pb = await createServicePb(env)
    } catch (err) {
      return json(
        {
          error: 'service_account_required',
          message: publicErrorMessage('系統服務未設定，請聯絡承辦。', err),
        },
        { status: 503 },
      )
    }

    const allowlist = [
      'name',
      'gender',
      'division',
      'program_type',
      'grade',
      'department_name',
      'phone',
      'line_id',
      'bank_account_registered',
      'bank_account_note',
    ]
    const update: Record<string, unknown> = { updated_by_student_at: new Date().toISOString() }
    for (const key of allowlist) {
      if (key in body) update[key] = body[key]
    }
    if ('email' in body) {
      update.profile_json = {
        ...(typeof refreshed.record.profile_json === 'object' && refreshed.record.profile_json
          ? refreshed.record.profile_json
          : {}),
        contact_email: body.email,
      }
    }

    const updated = await pb.collection('hk_students').update(String(refreshed.record.id), update)
    const record = publicStudentRecord(updated as Record<string, unknown>)
    return json({ success: true, profile: { ...record, student: record.id } })
  }

  return null
}
