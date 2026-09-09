/**
 * Static smoke tests for notification template rendering.
 * Does not connect to PocketBase. Mirrors pb_hooks/had_notification_render.js
 * (CommonJS) with inline ESM copies of the pure functions.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'tmp', 'notification-render-smoke')
mkdirSync(outDir, { recursive: true })

function extractVariables(template) {
  const text = template == null ? '' : String(template)
  const seen = {}
  const out = []
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    const key = m[1]
    if (!seen[key]) {
      seen[key] = true
      out.push(key)
    }
  }
  return out
}

function normalizeVarValue(value) {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isNaN(value)) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const s = String(value)
  if (s === 'undefined' || s === 'null') return ''
  return s
}

function renderTemplate(template, vars) {
  const text = template == null ? '' : String(template)
  const map = vars && typeof vars === 'object' ? vars : {}
  const missing = []
  const missingSeen = {}

  let rendered = text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key) => {
    if (!Object.prototype.hasOwnProperty.call(map, key) || map[key] == null || map[key] === '') {
      if (!missingSeen[key]) {
        missingSeen[key] = true
        missing.push(key)
      }
      return ''
    }
    const v = normalizeVarValue(map[key])
    if (v === '') {
      if (!missingSeen[key]) {
        missingSeen[key] = true
        missing.push(key)
      }
      return ''
    }
    return v
  })

  rendered = rendered.replace(/\bundefined\b/g, '')

  return {
    ok: missing.length === 0,
    text: rendered,
    missing,
  }
}

function escapeHtml(value) {
  const s = value == null ? '' : String(value)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToSafeHtml(text) {
  let s = text == null ? '' : String(text)
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta|style)[^>]*\/?\s*>/gi, '')
  s = s.replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
  s = s.replace(/javascript\s*:/gi, '')
  const escaped = escapeHtml(s)
  return escaped.replace(/\r\n|\r|\n/g, '<br>\n')
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// --- cases ---
const vars = extractVariables('Hello {{student_name}} / {{category_name}} / {{x}}')
assert(vars.includes('student_name'), 'extract student_name')
assert(vars.includes('category_name'), 'extract category_name')
assert(vars.length === 3, 'extract count')

const ok = renderTemplate('親愛的 {{student_name}}，金額 {{approved_amount}}', {
  student_name: '王小明',
  approved_amount: 5000,
})
assert(ok.ok === true, 'render ok')
assert(ok.text.includes('王小明'), 'render name')
assert(ok.text.includes('5000'), 'render amount')
assert(!ok.text.includes('undefined'), 'no undefined literal')

const miss = renderTemplate('您好 {{student_name}}，案件 {{application_number}}', {
  student_name: '李同學',
})
assert(miss.ok === false, 'missing marks not ok')
assert(miss.missing.includes('application_number'), 'lists missing')
assert(miss.text === '您好 李同學，案件 ', 'missing → empty string')
assert(!miss.text.includes('undefined'), 'missing never undefined')

const bad = renderTemplate('值={{maybe}}', { maybe: undefined })
assert(bad.text === '值=', 'undefined value → empty')
assert(!bad.text.includes('undefined'), 'no undefined from undefined value')

// Must not evaluate expressions / code
const noEval = renderTemplate('{{foo}}', { foo: 'safe', bar: 'evil' })
assert(noEval.text === 'safe', 'only mustache replace')
assert(
  renderTemplate('{{constructor}}', {}).text === '',
  'unknown keys empty',
)

const html = textToSafeHtml('第一行\n<script>alert(1)</script>\n第二行')
assert(html.includes('<br>'), 'nl2br')
assert(!html.toLowerCase().includes('<script'), 'script stripped/escaped')
assert(escapeHtml('<b>') === '&lt;b&gt;', 'escapeHtml')

writeFileSync(path.join(outDir, 'ok.txt'), 'notification render smoke ok\n')
console.log(
  JSON.stringify(
    {
      ok: true,
      outDir,
      cases: ['extract', 'render', 'missing', 'no-undefined', 'no-eval', 'safe-html'],
    },
    null,
    2,
  ),
)
