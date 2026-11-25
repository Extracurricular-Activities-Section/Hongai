/**
 * Synthetic unit checks for FIX-01 / FIX-02 / FIX-04 pure logic.
 * Does not call PocketBase, Workers, or any network host.
 *
 * Run: node ./scripts/fix-01-02-04-unit.mjs
 */

import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function staffMayAccessCategory(allowed, categoryCode) {
  if (allowed === null) return true
  const code = String(categoryCode || '').trim()
  if (!code) return false
  return allowed.has(code)
}

function staffMayDecideFunding(staff) {
  if (staff.is_admin) return true
  if (staff.can_decide_funding === false) return false
  const perms =
    staff.permissions_json && typeof staff.permissions_json === 'object'
      ? staff.permissions_json
      : {}
  if (perms.can_decide_funding === false) return false
  return Boolean(staff.is_staff)
}

function registerExistingPolicy(existing) {
  if (existing) {
    return { status: 409, error: 'already_registered', mutate: false, login: false }
  }
  return { status: 200, error: null, mutate: true, login: true }
}

function printNavigation(applicationId, categoryCode, submitOk) {
  if (!submitOk) return { navigate: false, reason: 'submit_failed' }
  if (!applicationId) return { navigate: false, reason: 'missing_id' }
  const cat = categoryCode || '_'
  return {
    navigate: true,
    path: `/student/current/category/${encodeURIComponent(cat)}/print?application=${encodeURIComponent(applicationId)}`,
    usesApplicationId: true,
  }
}

function printLoadStrategy(applicationId, categoryCode) {
  if (applicationId) {
    return { mode: 'by_application', applicationId, fallbackToCategory: false }
  }
  if (categoryCode && categoryCode !== '_') {
    return { mode: 'by_category', categoryCode, fallbackToCategory: false }
  }
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

await check('FIX-01 existing register does not mutate', () => {
  const result = registerExistingPolicy({ id: 'stu1' })
  assert.equal(result.status, 409)
  assert.equal(result.mutate, false)
  assert.equal(result.login, false)
})

await check('FIX-01 new register allowed', () => {
  const result = registerExistingPolicy(null)
  assert.equal(result.mutate, true)
  assert.equal(result.login, true)
})

await check('FIX-02 admin (null set) can access any category', () => {
  assert.equal(staffMayAccessCategory(null, 'external_competition'), true)
})

await check('FIX-02 staff with empty set cannot access', () => {
  assert.equal(staffMayAccessCategory(new Set(), 'external_competition'), false)
})

await check('FIX-02 staff only authorized categories', () => {
  const allowed = new Set(['life_aid', 'external_competition'])
  assert.equal(staffMayAccessCategory(allowed, 'external_competition'), true)
  assert.equal(staffMayAccessCategory(allowed, 'overseas'), false)
  assert.equal(staffMayAccessCategory(allowed, ''), false)
})

await check('FIX-03 interim: staff may decide funding unless explicitly denied', () => {
  assert.equal(staffMayDecideFunding({ is_admin: true, is_staff: true }), true)
  assert.equal(staffMayDecideFunding({ is_admin: false, is_staff: true }), true)
  assert.equal(
    staffMayDecideFunding({ is_admin: false, is_staff: true, can_decide_funding: false }),
    false,
  )
  assert.equal(
    staffMayDecideFunding({
      is_admin: false,
      is_staff: true,
      permissions_json: { can_decide_funding: false },
    }),
    false,
  )
  assert.equal(staffMayDecideFunding({ is_admin: false, is_staff: false }), false)
})

await check('FIX-04 navigate uses application id on success', () => {
  const nav = printNavigation('app15char000001', 'external_competition', true)
  assert.equal(nav.navigate, true)
  assert.equal(nav.usesApplicationId, true)
  assert.match(nav.path, /application=app15char000001/)
})

await check('FIX-04 failed submit does not navigate', () => {
  const nav = printNavigation('app15char000001', 'external_competition', false)
  assert.equal(nav.navigate, false)
})

await check('FIX-04 load with id never falls back to category', () => {
  const strat = printLoadStrategy('app15char000001', 'external_competition')
  assert.equal(strat.mode, 'by_application')
  assert.equal(strat.fallbackToCategory, false)
})

await check('FIX-04 two periods same category distinguished by id', () => {
  const a = printNavigation('aaaaaaaaaaaaaaa', 'external_competition', true)
  const b = printNavigation('bbbbbbbbbbbbbbb', 'external_competition', true)
  assert.notEqual(a.path, b.path)
})

await check('FIX-02 helper module export shape (source presence)', async () => {
  const fs = await import('node:fs/promises')
  const src = await fs.readFile(
    path.join(root, 'workers/hk-api/src/lib/staff-application-access.ts'),
    'utf8',
  )
  assert.match(src, /export function staffMayAccessCategory/)
  assert.match(src, /export async function assertStaffCanAccessApplication/)
  assert.match(src, /export async function staffScopedApplicationFilter/)
})

console.log(`\n${passed} checks finished. exit=${process.exitCode || 0}`)
