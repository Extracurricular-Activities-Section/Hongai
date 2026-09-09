#!/usr/bin/env node
/**
 * Lightweight secret / credential pattern scan for tracked source.
 * Does not connect to remotes. Exit 1 if high-confidence leaks found.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'tmp',
  'test-output',
  'test-fixtures',
  '.git',
  'pb_data',
  'coverage',
])

const SKIP_FILES = new Set(['.env', '.env.local', '.env.production'])

const PATTERNS = [
  { name: 'openai_sk', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private_key_block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'github_pat', re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'generic_bearer', re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/ },
  {
    name: 'vite_secret',
    re: /\bVITE_(SMTP_PASSWORD|HK_SCHEDULER_SECRET|POCKETBASE_ADMIN|API_KEY)\b/,
  },
  {
    name: 'hardcoded_password_assign',
    re: /(SMTP_PASSWORD|HK_SCHEDULER_SECRET)\s*=\s*['"][^'"]{8,}['"]/,
  },
]

const ALLOW_PATH_SNIPPETS = [
  '.env.example',
  'docs/',
  'SECURITY.md',
  'scripts/security-secrets-scan.mjs',
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    if (SKIP_FILES.has(name)) continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(js|mjs|cjs|ts|tsx|json|yml|yaml|md|env\.example)$/i.test(name)) out.push(full)
  }
  return out
}

function isAllowed(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/')
  return ALLOW_PATH_SNIPPETS.some((s) => rel.includes(s))
}

const files = walk(root)
const findings = []

for (const file of files) {
  if (isAllowed(file)) continue
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      findings.push({ file: path.relative(root, file), pattern: p.name })
    }
  }
}

// gitignore presence checks
const gi = existsSync(path.join(root, '.gitignore'))
  ? readFileSync(path.join(root, '.gitignore'), 'utf8')
  : ''
const requiredIgnore = ['.env', 'node_modules/', 'dist/', 'tmp/', 'pb_data/', 'test-output/']
const missingIgnore = requiredIgnore.filter((x) => !gi.includes(x))

console.log(
  JSON.stringify(
    {
      ok: findings.length === 0 && missingIgnore.length === 0,
      scanned_files: files.length,
      findings,
      missing_gitignore: missingIgnore,
    },
    null,
    2,
  ),
)

if (findings.length || missingIgnore.length) process.exit(1)
