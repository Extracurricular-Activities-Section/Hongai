/**
 * Student Auth Gateway.
 *
 * Six-collection schema: student account and profile fields live together in
 * hk_students. Students still log in with the UI's student_no + identity_last4
 * flow; PocketBase only stores/authenticates the backing auth record.
 */

import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'

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

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function publicStudentRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { identity_encrypted, identity_hash, ...safe } = record
  void identity_encrypted
  void identity_hash
  return safe
}

async function studentAuthWithLast4(
  env: WorkerEnv,
  studentNo: string,
  identityLast4: string,
): Promise<Response> {
  const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
  if (!base) {
    return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
  }

  const upstream = await fetch(`${base}/api/collections/hk_students/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identity: studentInternalEmail(studentNo),
      password: identityLast4,
    }),
  })

  const text = await upstream.text()
  const headers = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  return new Response(text, { status: upstream.status, headers })
}

export async function handleStudentAuth(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path === '/api/hk/auth/logout' && request.method === 'POST') {
    return json({ success: true })
  }

  if (path === '/api/hk/auth/login' && request.method === 'POST') {
    let body: StudentLoginBody
    try {
      body = (await request.json()) as StudentLoginBody
    } catch {
      return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
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
      return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })
    }

    const studentNo = normalizeStudentNo(body.student_no)
    const identityNumber = String(body.identity_number || '').trim().toUpperCase()
    const identityLast4 = normalizeLast4(body.identity_last4 || identityNumber.slice(-4))
    if (!studentNo || !identityNumber || !/^[0-9A-Z]{4}$/.test(identityLast4) || !body.name) {
      return json({ error: 'bad_request', message: '註冊資料不完整或格式錯誤' }, { status: 400 })
    }

    let pb
    try {
      pb = await createServicePb(env)
    } catch (err) {
      return json(
        {
          error: 'service_account_required',
          message: err instanceof Error ? err.message : 'Service account required',
        },
        { status: 503 },
      )
    }

    try {
      const identityHash = await sha256Hex(identityNumber)
      await pb.collection('hk_students').create({
        email: studentInternalEmail(studentNo),
        emailVisibility: false,
        password: identityLast4,
        passwordConfirm: identityLast4,
        verified: true,
        student_no: studentNo,
        identity_last4: identityLast4,
        identity_hash: identityHash,
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
        profile_json: {
          contact_email: body.email || '',
          original_registration_email: body.email || '',
        },
        notification_preferences_json: {
          email_enabled: true,
          in_app_enabled: true,
          event_reminders: true,
          follow_up_reminders: true,
        },
        active: true,
        failed_login_count: 0,
        registered_at: new Date().toISOString(),
      })
    } catch (err) {
      return json(
        {
          error: 'register_failed',
          message: err instanceof Error ? err.message : '註冊失敗，請稍後再試或聯絡承辦。',
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
      return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
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
      },
    })
  }

  if (path === '/api/hk/student/profile/update' && request.method === 'POST') {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized', message: '請先登入' }, { status: 401 })

    const base = env.HK_POCKETBASE_URL?.replace(/\/$/, '')
    if (!base) {
      return json({ error: 'misconfigured', message: 'HK_POCKETBASE_URL missing' }, { status: 500 })
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
    if (!body) return json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 })

    let pb
    try {
      pb = await createServicePb(env)
    } catch (err) {
      return json(
        {
          error: 'service_account_required',
          message: err instanceof Error ? err.message : 'Service account required',
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
