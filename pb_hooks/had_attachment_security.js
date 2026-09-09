/**
 * Attachment upload validation helpers (CommonJS).
 * Deny-by-default; never pretends malware scanning works.
 */

var ALLOWED_EXTENSIONS = {
  application: ['pdf', 'jpg', 'jpeg', 'png', 'docx'],
  follow_up: ['pdf', 'jpg', 'jpeg', 'png', 'docx'],
  signed_document: ['pdf', 'jpg', 'jpeg', 'png'],
  supplement: ['pdf', 'jpg', 'jpeg', 'png'],
}

var FORBIDDEN_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'pif',
  'vbs',
  'vbe',
  'js',
  'jse',
  'wsf',
  'wsh',
  'ps1',
  'sh',
  'bash',
  'dll',
  'sys',
  'drv',
  'cpl',
  'jar',
  'war',
  'apk',
  'dmg',
  'iso',
  'img',
  'html',
  'htm',
  'svg',
  'php',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'pl',
  'py',
  'rb',
  'hta',
  'lnk',
  'reg',
  'inf',
  'docm',
  'xlsm',
  'pptm',
  'rtf',
]

var MIME_BY_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function getMaxUploadSizeMb() {
  var raw = ''
  try {
    raw = $os.getenv('HAD_MAX_UPLOAD_SIZE_MB') || ''
  } catch (_) {}
  var n = parseInt(String(raw), 10)
  if (isNaN(n) || n <= 0) return 10
  return n
}

function sanitizeOriginalFilename(name) {
  var value = name == null ? '' : String(name)
  value = value.replace(/\\/g, '/')
  var parts = value.split('/')
  value = parts[parts.length - 1] || ''
  // strip control chars + null
  value = value.replace(/[\u0000-\u001f\u007f]/g, '')
  value = value.replace(/[<>:"|?*]/g, '_')
  value = value.trim()
  if (!value) value = 'file'
  if (value.length > 180) {
    var ext = detectExtension(value)
    var base = value.slice(0, 160)
    value = ext ? base + '.' + ext : base
  }
  return value
}

function detectExtension(filename) {
  var name = sanitizeOriginalFilename(filename)
  var idx = name.lastIndexOf('.')
  if (idx < 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

function generateStoredFilename(ext) {
  var safeExt = String(ext || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!safeExt) safeExt = 'bin'
  var hex = ''
  try {
    if (typeof $security !== 'undefined' && $security.randomString) {
      hex = $security.randomString(24)
    }
  } catch (_) {}
  if (!hex) {
    hex = String(Date.now()) + String(Math.floor(Math.random() * 1e9))
  }
  hex = String(hex)
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '')
  if (hex.length < 16) hex = (hex + '0000000000000000').slice(0, 16)
  return 'had_' + hex + '.' + safeExt
}

function safeContentDispositionFilename(name) {
  var sanitized = sanitizeOriginalFilename(name)
  // ASCII fallback for ContDisposition filename=
  var ascii = sanitized.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  if (!ascii) ascii = 'download'
  // RFC 5987 filename*
  var encoded = encodeURIComponent(sanitized).replace(/['()]/g, escape)
  return {
    ascii: ascii,
    encoded: encoded,
    headerValue: function (disposition) {
      var d = disposition === 'inline' ? 'inline' : 'attachment'
      return (
        d +
        '; filename="' +
        ascii +
        '"; filename*=UTF-8\'\'' +
        encoded
      )
    },
  }
}

function byteAt(bytes, index) {
  if (bytes == null) return -1
  try {
    if (typeof bytes.charCodeAt === 'function') {
      return index < bytes.length ? bytes.charCodeAt(index) & 0xff : -1
    }
  } catch (_) {}
  try {
    if (typeof bytes[index] === 'number') return bytes[index] & 0xff
    if (bytes[index] != null) return Number(bytes[index]) & 0xff
  } catch (_) {}
  return -1
}

function bytesStartWith(bytes, seq) {
  for (var i = 0; i < seq.length; i++) {
    if (byteAt(bytes, i) !== seq[i]) return false
  }
  return true
}

/**
 * Sniff MIME from magic bytes.
 * DOCX limitation (Goja): full ZIP central-directory scan for "word/" is unreliable;
 * we require ZIP local file header PK\\x03\\x04 and reject .docx when magic is not ZIP.
 */
function sniffMimeFromBytes(bytesOrArray) {
  if (bytesOrArray == null) {
    return { mime: null, kind: null, note: 'empty' }
  }
  // PDF
  if (
    byteAt(bytesOrArray, 0) === 0x25 &&
    byteAt(bytesOrArray, 1) === 0x50 &&
    byteAt(bytesOrArray, 2) === 0x44 &&
    byteAt(bytesOrArray, 3) === 0x46
  ) {
    return { mime: 'application/pdf', kind: 'pdf' }
  }
  // JPEG
  if (
    byteAt(bytesOrArray, 0) === 0xff &&
    byteAt(bytesOrArray, 1) === 0xd8 &&
    byteAt(bytesOrArray, 2) === 0xff
  ) {
    return { mime: 'image/jpeg', kind: 'jpeg' }
  }
  // PNG
  if (
    byteAt(bytesOrArray, 0) === 0x89 &&
    byteAt(bytesOrArray, 1) === 0x50 &&
    byteAt(bytesOrArray, 2) === 0x4e &&
    byteAt(bytesOrArray, 3) === 0x47
  ) {
    return { mime: 'image/png', kind: 'png' }
  }
  // ZIP / DOCX container (PK\x03\x04)
  if (
    byteAt(bytesOrArray, 0) === 0x50 &&
    byteAt(bytesOrArray, 1) === 0x4b &&
    byteAt(bytesOrArray, 2) === 0x03 &&
    byteAt(bytesOrArray, 3) === 0x04
  ) {
    return {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      kind: 'zip',
      note:
        'DOCX 僅驗證 ZIP 魔術碼；未在 Goja 內完整掃描 ZIP central directory 的 word/ 路徑',
    }
  }
  return { mime: null, kind: null, note: 'unknown_magic' }
}

function computeSha256(bytes) {
  if (typeof $security === 'undefined' || typeof $security.sha256 !== 'function') {
    throw new Error('系統未提供 SHA-256（$security.sha256），無法完成附件校驗')
  }
  var input = bytes
  if (typeof bytes !== 'string') {
    try {
      input = toString(bytes)
    } catch (err) {
      throw new Error('無法將檔案內容轉為可雜湊格式：' + String(err))
    }
  }
  return $security.sha256(input)
}

/**
 * Never pretend AV works.
 */
function scanAttachment() {
  return { status: 'not_configured' }
}

function validateUpload(opts) {
  opts = opts || {}
  var originalFilename = sanitizeOriginalFilename(opts.originalFilename)
  var reportedMime = opts.reportedMime == null ? '' : String(opts.reportedMime).toLowerCase()
  var sizeBytes = Number(opts.sizeBytes)
  var headBytes = opts.headBytes
  var allowedExtensions = opts.allowedExtensions || []
  var maxSizeMb = opts.maxSizeMb != null ? Number(opts.maxSizeMb) : getMaxUploadSizeMb()
  if (isNaN(maxSizeMb) || maxSizeMb <= 0) maxSizeMb = getMaxUploadSizeMb()

  var errors = []
  var ext = detectExtension(originalFilename)
  if (!ext) {
    errors.push('檔名缺少副檔名')
  }
  if (ext && FORBIDDEN_EXTENSIONS.indexOf(ext) >= 0) {
    errors.push('不允許的檔案類型：' + ext)
  }
  var allowed = []
  for (var i = 0; i < allowedExtensions.length; i++) {
    allowed.push(String(allowedExtensions[i]).toLowerCase())
  }
  if (ext && allowed.length && allowed.indexOf(ext) < 0) {
    errors.push('此情境不支援 .' + ext + ' 檔案')
  }
  if (isNaN(sizeBytes) || sizeBytes <= 0) {
    errors.push('檔案大小無效')
  } else if (sizeBytes > maxSizeMb * 1024 * 1024) {
    errors.push('檔案超過大小上限（' + maxSizeMb + 'MB）')
  }

  var sniff = sniffMimeFromBytes(headBytes)
  if (ext === 'pdf' && sniff.kind && sniff.kind !== 'pdf') {
    errors.push('副檔名為 PDF，但檔案內容不符')
  }
  if ((ext === 'jpg' || ext === 'jpeg') && sniff.kind && sniff.kind !== 'jpeg') {
    errors.push('副檔名為 JPEG，但檔案內容不符')
  }
  if (ext === 'png' && sniff.kind && sniff.kind !== 'png') {
    errors.push('副檔名為 PNG，但檔案內容不符')
  }
  if (ext === 'docx') {
    if (!sniff.kind) {
      errors.push('DOCX 檔案無法辨識（需要 ZIP/OOXML 格式）')
    } else if (sniff.kind !== 'zip') {
      errors.push('副檔名為 DOCX，但檔案不是有效的 ZIP/OOXML')
    }
  }
  if (headBytes && !sniff.kind && errors.length === 0) {
    errors.push('無法辨識檔案內容類型')
  }

  var resolvedMime = MIME_BY_EXT[ext] || sniff.mime || reportedMime || 'application/octet-stream'
  if (sniff.mime) resolvedMime = sniff.mime
  if (ext === 'docx' && sniff.kind === 'zip') {
    resolvedMime = MIME_BY_EXT.docx
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    extension: ext,
    originalFilename: originalFilename,
    mimeType: resolvedMime,
    sniff: sniff,
    maxSizeMb: maxSizeMb,
    sizeBytes: sizeBytes,
  }
}

function allowedExtensionsForContext(context) {
  var key = String(context || '')
  return ALLOWED_EXTENSIONS[key] ? ALLOWED_EXTENSIONS[key].slice() : []
}

module.exports = {
  ALLOWED_EXTENSIONS: ALLOWED_EXTENSIONS,
  FORBIDDEN_EXTENSIONS: FORBIDDEN_EXTENSIONS,
  MIME_BY_EXT: MIME_BY_EXT,
  getMaxUploadSizeMb: getMaxUploadSizeMb,
  sanitizeOriginalFilename: sanitizeOriginalFilename,
  generateStoredFilename: generateStoredFilename,
  safeContentDispositionFilename: safeContentDispositionFilename,
  detectExtension: detectExtension,
  sniffMimeFromBytes: sniffMimeFromBytes,
  validateUpload: validateUpload,
  scanAttachment: scanAttachment,
  computeSha256: computeSha256,
  allowedExtensionsForContext: allowedExtensionsForContext,
}
