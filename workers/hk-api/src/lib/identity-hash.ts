import { isWeakSecret } from './weak-secrets'

function requireIdentityPepper(pepper: string | undefined | null): string {
  const keyMaterial = String(pepper || '').trim()
  if (isWeakSecret(keyMaterial) || keyMaterial.length < 16) {
    throw new Error('HK_IDENTITY_PEPPER missing or too weak')
  }
  return keyMaterial
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Server-only identity fingerprint for hk_students.identity_hash.
 * HMAC-SHA256 with HK_IDENTITY_PEPPER — not bare SHA-256.
 * Testing-only DBs may be wiped; no dual-read of legacy hashes.
 */
export async function hashIdentityNumber(
  identityNumber: string,
  pepper: string | undefined | null,
): Promise<string> {
  const keyMaterial = requireIdentityPepper(pepper)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial),
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

/**
 * AES-GCM ciphertext for hk_students.identity_encrypted.
 * Format: `v1.` + base64(iv[12] || ciphertext+tag). Key = SHA-256(pepper).
 */
export async function encryptIdentityNumber(
  identityNumber: string,
  pepper: string | undefined | null,
): Promise<string> {
  const keyMaterial = requireIdentityPepper(pepper)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyMaterial))
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(identityNumber),
  )
  const packed = new Uint8Array(iv.length + cipherBuf.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipherBuf), iv.length)
  return `v1.${bytesToBase64(packed)}`
}
