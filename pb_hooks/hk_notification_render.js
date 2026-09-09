/**
 * Safe mustache-like {{var}} rendering. No eval / Function / $eval.
 */

function extractVariables(template) {
  var text = template == null ? '' : String(template)
  var seen = {}
  var out = []
  var re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
  var m
  while ((m = re.exec(text)) !== null) {
    var key = m[1]
    if (!seen[key]) {
      seen[key] = true
      out.push(key)
    }
  }
  return out
}

function normalizeVarValue(value) {
  if (value == null) return ''
  if (typeof value === 'number' && isNaN(value)) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  var s = String(value)
  if (s === 'undefined' || s === 'null') return ''
  return s
}

/**
 * Replace {{var}} only. Missing vars → empty string and listed in missing[].
 * Never outputs the literal "undefined".
 * @returns {{ ok: boolean, text: string, missing: string[] }}
 */
function renderTemplate(template, vars) {
  var text = template == null ? '' : String(template)
  var map = vars && typeof vars === 'object' ? vars : {}
  var missing = []
  var missingSeen = {}

  var rendered = text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, function (_match, key) {
    if (!Object.prototype.hasOwnProperty.call(map, key) || map[key] == null || map[key] === '') {
      if (!missingSeen[key]) {
        missingSeen[key] = true
        missing.push(key)
      }
      return ''
    }
    var v = normalizeVarValue(map[key])
    if (v === '') {
      if (!missingSeen[key]) {
        missingSeen[key] = true
        missing.push(key)
      }
      return ''
    }
    return v
  })

  // Belt-and-suspenders: never leak "undefined"
  rendered = rendered.replace(/\bundefined\b/g, '')

  return {
    ok: missing.length === 0,
    text: rendered,
    missing: missing,
  }
}

function escapeHtml(value) {
  var s = value == null ? '' : String(value)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape text, strip dangerous tags, convert newlines to <br>.
 */
function textToSafeHtml(text) {
  var s = text == null ? '' : String(text)
  // Strip script/iframe blocks and tags before escape (defense in depth)
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  s = s.replace(/<\s*(script|iframe|object|embed|link|meta|style)[^>]*\/?\s*>/gi, '')
  s = s.replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
  s = s.replace(/javascript\s*:/gi, '')
  var escaped = escapeHtml(s)
  return escaped.replace(/\r\n|\r|\n/g, '<br>\n')
}

/**
 * Simple HTML email wrapper around safe body HTML.
 */
function wrapEmailHtml(title, bodyHtml) {
  var safeTitle = escapeHtml(title || '宏愛圓夢系統通知')
  var body = bodyHtml == null ? '' : String(bodyHtml)
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    safeTitle +
    '</title></head><body style="font-family:sans-serif;line-height:1.6;color:#222;">' +
    '<h2 style="font-size:18px;">' +
    safeTitle +
    '</h2><div>' +
    body +
    '</div><hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">' +
    '<p style="font-size:12px;color:#666;">此為系統自動寄送，請勿直接回覆。</p>' +
    '</body></html>'
  )
}

module.exports = {
  extractVariables: extractVariables,
  renderTemplate: renderTemplate,
  escapeHtml: escapeHtml,
  textToSafeHtml: textToSafeHtml,
  wrapEmailHtml: wrapEmailHtml,
}
