/**
 * One-shot: replace 學務處生活住宿組 → 學務處生輔組 in published
 * external_competition form display text (申請說明).
 *
 * Usage (from repo root, with service account in workers/hk-api/.dev.vars):
 *   node ./scripts/patch-external-competition-unit.mjs
 *
 * Does not print secrets. Only touches hk_forms for external_competition.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PocketBase from 'pocketbase'

const OLD = '學務處生活住宿組'
const NEW = '學務處生輔組'

function loadDevVars(path) {
  const out = {}
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i <= 0) continue
    const key = trimmed.slice(0, i).trim()
    let value = trimmed.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function patchSchema(schema) {
  let hits = 0
  const sections = Array.isArray(schema?.sections) ? schema.sections : []
  for (const section of sections) {
    const fields = Array.isArray(section.fields) ? section.fields : []
    for (const field of fields) {
      for (const key of ['help_text', 'label', 'description']) {
        const value = field[key]
        if (typeof value === 'string' && value.includes(OLD)) {
          field[key] = value.split(OLD).join(NEW)
          hits += 1
        }
      }
    }
    if (typeof section.description === 'string' && section.description.includes(OLD)) {
      section.description = section.description.split(OLD).join(NEW)
      hits += 1
    }
    if (typeof section.title === 'string' && section.title.includes(OLD)) {
      section.title = section.title.split(OLD).join(NEW)
      hits += 1
    }
  }
  return hits
}

const varsPath = resolve('workers/hk-api/.dev.vars')
const fileEnv = loadDevVars(varsPath)
const url = process.env.HK_POCKETBASE_URL || fileEnv.HK_POCKETBASE_URL
const email = process.env.HK_PB_SERVICE_EMAIL || fileEnv.HK_PB_SERVICE_EMAIL
const password = process.env.HK_PB_SERVICE_PASSWORD || fileEnv.HK_PB_SERVICE_PASSWORD

if (!url || !email || !password) {
  console.error(
    '需要服務帳號才能改正式表單。請在 workers/hk-api/.dev.vars 補上：\n' +
      '  HK_PB_SERVICE_EMAIL=...\n' +
      '  HK_PB_SERVICE_PASSWORD=...\n' +
      '（與 Cloudflare Worker secrets 相同；勿 commit）\n' +
      `目前已有 URL: ${url ? 'yes' : 'no'} / EMAIL: ${email ? 'yes' : 'no'} / PASSWORD: ${password ? 'yes' : 'no'}`,
  )
  process.exit(1)
}

const pb = new PocketBase(url)
pb.autoCancellation(false)
await pb.collection('hk_staff_users').authWithPassword(email, password)

const forms = await pb.collection('hk_forms').getFullList({
  filter: 'category_code = "external_competition" && status = "published" && active = true',
})

if (!forms.length) {
  console.error('No published external_competition form found')
  process.exit(1)
}

let totalHits = 0
for (const form of forms) {
  const schema =
    form.schema_json && typeof form.schema_json === 'object' ? structuredClone(form.schema_json) : {}
  const hits = patchSchema(schema)
  if (!hits) {
    console.log(`skip ${form.id} (${form.form_code || form.name}): no "${OLD}" found`)
    continue
  }
  await pb.collection('hk_forms').update(form.id, { schema_json: schema })
  totalHits += hits
  console.log(`updated ${form.id} (${form.form_code || form.name}): ${hits} field(s)`)
}

if (!totalHits) {
  console.error(`Nothing updated — "${OLD}" not found in published schema`)
  process.exit(2)
}

console.log(`done: replaced "${OLD}" → "${NEW}" (${totalHits} hit(s))`)
