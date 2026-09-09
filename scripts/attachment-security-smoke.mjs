/**
 * Static smoke tests for attachment magic-byte / extension rules.
 * Does not connect to PocketBase. No real student files.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'tmp', 'attachment-smoke')
mkdirSync(outDir, { recursive: true })

function sniff(bytes) {
  if (!bytes || bytes.length < 4) return null
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    return 'zip'
  }
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return 'exe'
  return null
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const pdf = Buffer.from('%PDF-1.4 fake')
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00])
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])

assert(sniff(pdf) === 'pdf', 'pdf magic')
assert(sniff(jpg) === 'jpg', 'jpg magic')
assert(sniff(png) === 'png', 'png magic')
assert(sniff(exe) === 'exe', 'exe magic should detect MZ')
assert(sniff(zip) === 'zip', 'zip/docx container')

// exe renamed as pdf must fail policy
assert(!(sniff(exe) === 'pdf'), 'exe must not look like pdf')

writeFileSync(path.join(outDir, 'ok.txt'), 'attachment smoke ok\n')
console.log(JSON.stringify({ ok: true, outDir }, null, 2))
