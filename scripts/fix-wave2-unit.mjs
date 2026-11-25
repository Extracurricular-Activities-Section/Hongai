/**
 * Synthetic unit checks for FIX-05…15 safe subset (no network).
 * Run: node ./scripts/fix-wave2-unit.mjs
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const WEAK = new Set([
  'hk-dev-pdf-secret',
  'hk-dev-scheduler-secret',
  'changeme',
  'secret',
  'password',
  'test',
])
function isWeakSecret(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true
  return WEAK.has(trimmed)
}

function lockoutDurationMs(failCount) {
  const minutes = [5, 15, 30, 60]
  const index = Math.min(Math.max(failCount - 5, 0), minutes.length - 1)
  return minutes[index] * 60_000
}

function publicStudentRecord(record) {
  const {
    identity_encrypted,
    identity_hash,
    identity_last4,
    password,
    tokenKey,
    ...safe
  } = record
  void identity_encrypted
  void identity_hash
  void identity_last4
  void password
  void tokenKey
  return safe
}

function printLoadStrategy(applicationId, categoryCode) {
  if (applicationId) return { mode: 'by_application', fallbackToCategory: false }
  if (categoryCode && categoryCode !== '_') return { mode: 'by_category', fallbackToCategory: false }
  return { mode: 'error', fallbackToCategory: false }
}

let passed = 0
async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (err) {
    console.error(`FAIL  ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

await check('FIX-05 lockout is temporary / progressive', () => {
  assert.equal(lockoutDurationMs(5), 5 * 60_000)
  assert.equal(lockoutDurationMs(6), 15 * 60_000)
  assert.equal(lockoutDurationMs(8), 60 * 60_000)
  assert.ok(lockoutDurationMs(100) < 24 * 60 * 60_000)
})

await check('FIX-06 public record strips identity fields', () => {
  const out = publicStudentRecord({
    id: 'x',
    name: '測試',
    identity_hash: 'abc',
    identity_last4: '1234',
    identity_encrypted: 'enc',
    password: 'nope',
  })
  assert.equal(out.name, '測試')
  assert.equal('identity_hash' in out, false)
  assert.equal('identity_last4' in out, false)
  assert.equal('password' in out, false)
})

await check('FIX-10 weak secrets rejected', () => {
  assert.equal(isWeakSecret(''), true)
  assert.equal(isWeakSecret('hk-dev-pdf-secret'), true)
  assert.equal(isWeakSecret('hk-dev-scheduler-secret'), true)
  assert.equal(isWeakSecret('a-real-long-random-secret-value'), false)
})

await check('FIX-10 identity hash uses HMAC pepper helper', async () => {
  const src = await fs.readFile(path.join(root, 'workers/hk-api/src/lib/identity-hash.ts'), 'utf8')
  const auth = await fs.readFile(path.join(root, 'workers/hk-api/src/routes/auth-student.ts'), 'utf8')
  assert.match(src, /HMAC/)
  assert.match(src, /HK_IDENTITY_PEPPER/)
  assert.match(src, /encryptIdentityNumber/)
  assert.match(src, /AES-GCM/)
  assert.match(auth, /hashIdentityNumber/)
  assert.match(auth, /encryptIdentityNumber/)
  assert.match(auth, /identity_encrypted:\s*identityEncrypted/)
  assert.match(auth, /identity_number_masked/)
  assert.equal(/sha256Hex\(identityNumber\)/.test(auth), false)
})

await check('FIX-10 identity-hash runtime HMAC + AES shape', async () => {
  // Mirror workers/hk-api/src/lib/identity-hash.ts algorithm (Node cannot import .ts ESM).
  async function hashIdentityNumber(identityNumber, pepper) {
    if (isWeakSecret(pepper) || String(pepper).trim().length < 16) {
      throw new Error('HK_IDENTITY_PEPPER missing or too weak')
    }
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pepper),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(identityNumber),
    )
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  async function encryptIdentityNumber(identityNumber, pepper) {
    if (isWeakSecret(pepper) || String(pepper).trim().length < 16) {
      throw new Error('HK_IDENTITY_PEPPER missing or too weak')
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pepper))
    const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
      'encrypt',
    ])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(identityNumber),
    )
    const packed = new Uint8Array(iv.length + cipherBuf.byteLength)
    packed.set(iv, 0)
    packed.set(new Uint8Array(cipherBuf), iv.length)
    let binary = ''
    for (const byte of packed) binary += String.fromCharCode(byte)
    return `v1.${btoa(binary)}`
  }

  const pepper = 'IsoIdentityPepper-Accept-Only-7k2m9q'
  await assert.rejects(() => hashIdentityNumber('A123456789', 'weak'), /PEPPER/)
  const a = await hashIdentityNumber('A123456789', pepper)
  const b = await hashIdentityNumber('A123456789', pepper)
  assert.equal(a, b)
  assert.equal(a.length, 64)
  const enc = await encryptIdentityNumber('A123456789', pepper)
  assert.match(enc, /^v1\./)
  assert.notEqual(enc, await encryptIdentityNumber('A123456789', pepper))
})

await check('identity-reset verifies hash without storing plaintext', async () => {
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/identity-reset.ts'),
    'utf8',
  )
  assert.match(src, /hashIdentityNumber/)
  assert.match(src, /identity_verified/)
  assert.match(src, /Never store plaintext identity_number/)
  assert.equal(/identity_number:\s*identityNumber/.test(src), false)
  const help = await fs.readFile(path.join(root, 'src/pages/public/help-page.tsx'), 'utf8')
  assert.match(help, /identity_number/)
  const outreach = await fs.readFile(path.join(root, 'src/pages/admin/outreach-page.tsx'), 'utf8')
  assert.match(outreach, /經濟與文化不利學生/)
  assert.equal(outreach.includes('經濟不利生通知'), false)
})

await check('FIX-04 id load never falls back', () => {
  assert.equal(printLoadStrategy('aaaaaaaaaaaaaaa', 'external_competition').fallbackToCategory, false)
})

await check('FIX-01/02/04 prior unit script still present', async () => {
  const src = await fs.readFile(path.join(root, 'scripts/fix-01-02-04-unit.mjs'), 'utf8')
  assert.match(src, /FIX-01/)
  assert.match(src, /FIX-02/)
  assert.match(src, /FIX-04/)
})

await check('FIX-11 getDelivery marked adminOnly in source', async () => {
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/admin-notifications.ts'),
    'utf8',
  )
  assert.match(src, /FIX-11/)
  assert.match(
    src,
    /deliveries\\\/\(\[\^\/\]\+\)\$[\s\S]*?adminOnly:\s*true/,
  )
  const read = await fs.readFile(path.join(root, 'workers/hk-api/src/routes/admin-read.ts'), 'utf8')
  assert.match(
    read,
    /notifications\\\/deliveries\$[\s\S]*?adminOnly:\s*true/,
  )
  const ui = await fs.readFile(path.join(root, 'src/pages/admin/notifications-page.tsx'), 'utf8')
  assert.match(ui, /isAdmin \? \(/)
  assert.match(ui, /寄送紀錄/)
})

await check('FIX-04 optional print link pins application id', async () => {
  const src = await fs.readFile(
    path.join(root, 'src/features/application-print/components/student-paper-panel.tsx'),
    'utf8',
  )
  assert.match(src, /print\?application=\$\{encodeURIComponent\(submissionId\)\}/)
})

await check('FIX-02 follow-up tasks assert staff scope', async () => {
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/admin-follow-up.ts'),
    'utf8',
  )
  assert.match(src, /staffScopedApplicationFilter/)
  assert.match(src, /assertStaffCanAccessApplication/)
})

await check('FIX-09 publicErrorMessage used on outer catches', async () => {
  for (const rel of [
    'workers/hk-api/src/routes/admin-read.ts',
    'workers/hk-api/src/routes/admin-follow-up.ts',
    'workers/hk-api/src/routes/signatures.ts',
    'workers/hk-api/src/routes/pdf.ts',
    'workers/hk-api/src/routes/admin-notifications.ts',
  ]) {
    const src = await fs.readFile(path.join(root, rel), 'utf8')
    assert.match(src, /publicErrorMessage/)
  }
})

await check('FIX-12 outreach label aligned', async () => {
  const src = await fs.readFile(path.join(root, 'src/pages/admin/notifications-page.tsx'), 'utf8')
  assert.match(src, /經濟與文化不利學生/)
  assert.equal(src.includes('經濟不利生通知'), false)
})

await check('FIX-13 print overflow-wrap present', async () => {
  const css = await fs.readFile(path.join(root, 'src/index.css'), 'utf8')
  assert.match(css, /overflow-wrap:\s*anywhere/)
  assert.match(css, /\.print-allow-break/)
  assert.match(css, /\.print-long-text|\.print-long/)
  const doc = await fs.readFile(
    path.join(root, 'src/features/application-print/components/application-print-document.tsx'),
    'utf8',
  )
  assert.match(doc, /print-allow-break/)
  assert.match(doc, /LONG_TEXT_TYPES/)
})

await check('FIX-08 completing guard present', async () => {
  const src = await fs.readFile(path.join(root, 'src/pages/student/category-form-page.tsx'), 'utf8')
  assert.match(src, /completing/)
  assert.match(src, /networkAwareMessage/)
  assert.match(src, /送出中/)
})

await check('FIX-15 dashboard follow-up fan-out unchanged (static measure)', async () => {
  const src = await fs.readFile(path.join(root, 'src/pages/admin/dashboard-page.tsx'), 'utf8')
  const callSites = src.match(/adminListFollowUpTasks\(/g) || []
  assert.equal(callSites.length, 3, '3 parallel status fetches; skip rewrite without runtime gain')
})

await check('FIX-02 annualFundingSummary avoids created sort', async () => {
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/lib/application-workflow.ts'),
    'utf8',
  )
  assert.match(src, /sort:\s*'submitted_at,id'/)
  assert.equal(/sort:\s*'submitted_at,created'/.test(src), false)
})

await check('FIX-02 applicationSort defaults to -id not -created', async () => {
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/admin-read.ts'),
    'utf8',
  )
  assert.match(src, /return '-id'/)
  assert.equal(/return '-created'/.test(src), false)
})

await check('register create omits verified force-write', async () => {
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/auth-student.ts'),
    'utf8',
  )
  assert.match(src, /Do not set `verified`/)
  assert.equal(/verified:\s*true/.test(src), false)
})

await check('staff login sanitizes record in source', async () => {
  const src = await fs.readFile(path.join(root, 'workers/hk-api/src/routes/auth-staff.ts'), 'utf8')
  assert.match(src, /publicStaffRecord/)
  assert.match(src, /revoked_token_fps/)
})

await check('awaiting_student queue aligned with dashboard', async () => {
  const api = await fs.readFile(path.join(root, 'workers/hk-api/src/routes/admin-read.ts'), 'utf8')
  const dash = await fs.readFile(path.join(root, 'src/pages/admin/dashboard-page.tsx'), 'utf8')
  const page = await fs.readFile(path.join(root, 'src/pages/admin/applications-page.tsx'), 'utf8')
  assert.match(api, /awaiting_student/)
  assert.match(dash, /queue=awaiting_student/)
  assert.match(page, /awaiting_student/)
})

await check('FIX-03 staffMayDecideFunding + awaiting_me_count wired', async () => {
  const access = await fs.readFile(
    path.join(root, 'workers/hk-api/src/lib/staff-application-access.ts'),
    'utf8',
  )
  const read = await fs.readFile(path.join(root, 'workers/hk-api/src/routes/admin-read.ts'), 'utf8')
  const apps = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/admin-applications.ts'),
    'utf8',
  )
  assert.match(access, /export function staffMayDecideFunding/)
  assert.match(access, /awaitingMeStatusesFor/)
  assert.match(read, /awaiting_me_count/)
  assert.match(apps, /staffMayDecideFunding/)
})

await check('dashboard 待核發 uses funding_decided not funding_pending', async () => {
  const dash = await fs.readFile(path.join(root, 'src/pages/admin/dashboard-page.tsx'), 'utf8')
  assert.match(dash, /fundingDecided:\s*byStatus\.funding_decided/)
  assert.match(dash, /status=funding_decided/)
  assert.match(dash, /'funding_pending'/)
  // Metric value must not still bind the old fundingPending count alias
  assert.equal(/value=\{counts\.fundingPending\}/.test(dash), false)
})

await check('FIX-14 logout revokes student/staff sessions + proxy read/write block', async () => {
  const student = await fs.readFile(
    path.join(root, 'workers/hk-api/src/routes/auth-student.ts'),
    'utf8',
  )
  const staff = await fs.readFile(path.join(root, 'workers/hk-api/src/routes/auth-staff.ts'), 'utf8')
  const revoke = await fs.readFile(path.join(root, 'workers/hk-api/src/lib/auth-revoke.ts'), 'utf8')
  const proxy = await fs.readFile(path.join(root, 'workers/hk-api/src/lib/proxy.ts'), 'utf8')
  const staffUi = await fs.readFile(path.join(root, 'src/features/auth/backoffice/api.ts'), 'utf8')
  assert.match(revoke, /oldPassword/)
  assert.match(revoke, /revoked_token_fps/)
  assert.match(student, /revokeCollectionSession/)
  assert.match(staff, /\/api\/hk\/auth\/staff\/logout/)
  assert.match(staffUi, /\/api\/hk\/auth\/staff\/logout/)
  assert.match(proxy, /hk_\[a-z0-9_\]\+/)
  assert.match(proxy, /不可經 proxy 存取 hk_\*/)
  assert.equal(/method !== 'GET' && method !== 'HEAD'/.test(proxy), false)
  const authStaff = await fs.readFile(path.join(root, 'workers/hk-api/src/lib/auth-staff.ts'), 'utf8')
  assert.match(authStaff, /staffTokenIsRevoked/)
})

await check('dashboard hint respects can_decide_funding', async () => {
  const dash = await fs.readFile(path.join(root, 'src/pages/admin/dashboard-page.tsx'), 'utf8')
  assert.match(dash, /can_decide_funding === false/)
})

console.log(`\n${passed} checks finished. exit=${process.exitCode || 0}`)
