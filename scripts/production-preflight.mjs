#!/usr/bin/env node
/**
 * Production preflight — READ ONLY checks. Never mutates PocketBase.
 * Usage: node scripts/production-preflight.mjs
 * Optional: HK_PREFLIGHT_PB_URL=https://db.keson.pro
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pbUrl = (process.env.HK_PREFLIGHT_PB_URL || process.env.VITE_POCKETBASE_URL || '').replace(
  /\/$/,
  '',
)

const report = {
  ok: true,
  status: 'READY_FOR_MANUAL_MIGRATION_REVIEW',
  checks: [],
  blockers: [],
  notes: [
    '本腳本不執行 migration、不寫入 production。',
    '正式套用前必須完成 PocketBase backup。',
  ],
}

function add(name, pass, detail, blocker = false) {
  report.checks.push({ name, pass, detail })
  if (!pass) {
    report.ok = false
    if (blocker) report.blockers.push(name + ': ' + detail)
  }
}

// Local repo checks
const migrations = readdirSync(path.join(root, 'pb_migrations')).filter((f) => f.endsWith('.js'))
add(
  'six_collection_migration_present',
  migrations.includes('1736500001_create_six_collection_data_layer.js'),
  `found ${migrations.length} active migration file(s)`,
  true,
)

const hooks = readdirSync(path.join(root, 'pb_hooks')).filter((f) => f.endsWith('.js'))
add(
  'hooks_repo_only',
  existsSync(path.join(root, 'pb_hooks', 'README.md')),
  `found ${hooks.length} legacy hook files; they must not be deployed to PocketBase`,
)

add('env_example', existsSync(path.join(root, '.env.example')), '.env.example exists')
add('gitignore', existsSync(path.join(root, '.gitignore')), '.gitignore exists')
add(
  'no_pb_data_in_repo',
  !existsSync(path.join(root, 'pb_data')),
  'pb_data should not be committed',
)

const collectionSource = readFileSync(path.join(root, 'src/lib/pocketbase/collections.ts'), 'utf8')
for (const collection of [
  'hk_students',
  'hk_staff_users',
  'hk_forms',
  'hk_applications',
  'hk_settings',
  'hk_events',
]) {
  add(
    `active_collection_${collection}`,
    collectionSource.includes(`'${collection}'`),
    `${collection} is part of the six-collection data layer`,
    true,
  )
}

const envExample = readFileSync(path.join(root, '.env.example'), 'utf8')
add(
  'scheduler_secret_documented',
  envExample.includes('HK_SCHEDULER_SECRET'),
  'HK_SCHEDULER_SECRET in .env.example',
)
add(
  'mail_provider_documented',
  envExample.includes('HK_MAIL_PROVIDER'),
  'HK_MAIL_PROVIDER in .env.example',
)

// Optional reachability (no auth, no mutation)
async function pingPb() {
  if (!pbUrl) {
    add('pocketbase_url_optional', true, 'HK_PREFLIGHT_PB_URL / VITE_POCKETBASE_URL not set; reachability check skipped')
    return
  }
  try {
    const res = await fetch(pbUrl + '/api/health', { method: 'GET' })
    // PocketBase may use /api/health or root — accept any response that is not network error
    add(
      'pocketbase_reachable',
      res.status > 0,
      `${pbUrl} responded HTTP ${res.status}`,
      false,
    )
  } catch (err) {
    add(
      'pocketbase_reachable',
      false,
      `Cannot reach ${pbUrl}: ${err instanceof Error ? err.message : String(err)}`,
      true,
    )
  }
}

await pingPb()

report.status = report.blockers.length
  ? 'BLOCKED'
  : 'READY_FOR_MANUAL_MIGRATION'

console.log(JSON.stringify(report, null, 2))
process.exit(report.blockers.length ? 1 : 0)
