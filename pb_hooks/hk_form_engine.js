/**
 * Server-side form engine helpers (no eval / new Function).
 * Mirrors src/features/forms/engine for PocketBase hooks.
 */
function isEmpty(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'boolean') return false
  if (typeof value === 'number') return isNaN(value)
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    var keys = Object.keys(value)
    for (var i = 0; i < keys.length; i++) {
      var v = value[keys[i]]
      if (v != null && String(v).trim() !== '') return false
    }
    return true
  }
  return false
}

function asBool(value) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function matchRule(operator, source, expected) {
  if (operator === 'is_empty') return isEmpty(source)
  if (operator === 'is_not_empty') return !isEmpty(source)
  if (operator === 'is_true') return asBool(source) === true
  if (operator === 'is_false') return asBool(source) === false
  if (operator === 'equals') {
    if (typeof expected === 'boolean') return asBool(source) === expected
    return String(source == null ? '' : source) === String(expected == null ? '' : expected)
  }
  if (operator === 'not_equals') {
    if (typeof expected === 'boolean') return asBool(source) !== expected
    return String(source == null ? '' : source) !== String(expected == null ? '' : expected)
  }
  if (operator === 'contains') {
    if (Array.isArray(source)) return source.map(String).indexOf(String(expected)) >= 0
    return String(source == null ? '' : source).indexOf(String(expected == null ? '' : expected)) >= 0
  }
  if (operator === 'not_contains') {
    if (Array.isArray(source)) return source.map(String).indexOf(String(expected)) < 0
    return String(source == null ? '' : source).indexOf(String(expected == null ? '' : expected)) < 0
  }
  return false
}

function parseDateMs(value) {
  if (!value) return NaN
  return Date.parse(String(value))
}

function monthsBetween(startMs, endMs) {
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return 0
  var start = new Date(startMs)
  var end = new Date(endMs)
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 0 : -1)
  )
}

function resolveSumPart(values, token) {
  if (token.indexOf('.') >= 0) {
    var parts = token.split('.')
    var rows = values[parts[0]]
    if (!Array.isArray(rows)) return 0
    var sum = 0
    for (var i = 0; i < rows.length; i++) {
      var amount = Number(rows[i][parts[1]] || 0)
      if (!isNaN(amount)) sum += amount
    }
    return sum
  }
  var num = Number(values[token] || 0)
  return isNaN(num) ? 0 : num
}

function calculateComputed(fields, values) {
  var next = Object.assign({}, values)
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
    if (field.field_type !== 'computed') continue
    var config = field.config || {}
    if (config.operation === 'sum') {
      var tokens = config.fields || []
      var total = 0
      for (var t = 0; t < tokens.length; t++) total += resolveSumPart(next, tokens[t])
      next[field.code] = total
    } else if (config.operation === 'date_diff_days') {
      var s = parseDateMs(next[config.start])
      var e = parseDateMs(next[config.end])
      next[field.code] = isNaN(s) || isNaN(e) || e < s ? null : Math.floor((e - s) / 86400000) + 1
    } else if (config.operation === 'date_diff_months') {
      next[field.code] = monthsBetween(parseDateMs(next[config.start]), parseDateMs(next[config.end]))
    }
  }
  return next
}

function evaluateRules(fields, rules, values) {
  var state = {}
  for (var i = 0; i < fields.length; i++) {
    state[fields[i].code] = { visible: true, required: !!fields[i].required }
  }
  var sorted = (rules || []).slice().sort(function (a, b) {
    return (a.sort_order || 0) - (b.sort_order || 0)
  })
  for (var r = 0; r < sorted.length; r++) {
    var rule = sorted[r]
    if (!state[rule.field_code]) continue
    var matched = matchRule(rule.operator, values[rule.source_field_code], rule.value)
    if (rule.rule_type === 'show_if') {
      state[rule.field_code].visible = matched
      if (!matched) state[rule.field_code].required = false
    } else if (rule.rule_type === 'hide_if') {
      state[rule.field_code].visible = !matched
      if (matched) state[rule.field_code].required = false
    } else if (rule.rule_type === 'require_if' && matched && state[rule.field_code].visible) {
      state[rule.field_code].required = true
    }
  }
  return state
}

function validateValues(fields, rules, values, mode) {
  var computed = calculateComputed(fields, values)
  var state = evaluateRules(fields, rules, computed)
  var issues = []

  var pairs = [
    ['training_start', 'training_end'],
    ['execution_start', 'execution_end'],
    ['departure_date', 'return_date'],
    ['term_start', 'term_end'],
  ]
  for (var p = 0; p < pairs.length; p++) {
    if (!(pairs[p][0] in computed) || !(pairs[p][1] in computed)) continue
    var ps = parseDateMs(computed[pairs[p][0]])
    var pe = parseDateMs(computed[pairs[p][1]])
    if (!isNaN(ps) && !isNaN(pe) && ps > pe) {
      issues.push({
        code: 'date_range',
        field_code: pairs[p][1],
        severity: 'error',
        message: '結束日期不可早於開始日期',
      })
    }
  }

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
    if (!field.active) continue
    var st = state[field.code]
    if (!st || !st.visible) continue
    var value = computed[field.code]
    if (field.field_type === 'url' && !isEmpty(value)) {
      if (!/^https?:\/\//i.test(String(value))) {
        issues.push({
          code: 'invalid_url',
          field_code: field.code,
          severity: 'error',
          message: field.label + ' 網址格式無效',
        })
      }
    }
    if (mode === 'complete' && st.required && isEmpty(value)) {
      // file fields: value must be a non-empty array of attachment ids
      issues.push({
        code: 'required',
        field_code: field.code,
        severity: 'error',
        message:
          field.field_type === 'file'
            ? '請上傳「' + field.label + '」'
            : '請填寫「' + field.label + '」',
      })
    }
    if (
      mode === 'complete' &&
      field.field_type === 'file' &&
      !isEmpty(value) &&
      !Array.isArray(value)
    ) {
      issues.push({
        code: 'invalid_file',
        field_code: field.code,
        severity: 'error',
        message: '「' + field.label + '」格式無效（應為附件 ID 陣列）',
      })
    }
  }
  return { issues: issues, values: computed, state: state }
}

function canCopyType(from, to) {
  if (from === to) return true
  var textLike = { text: 1, textarea: 1, email: 1, url: 1, select: 1, radio: 1 }
  if (textLike[from] && textLike[to]) return true
  if ((from === 'number' || from === 'currency') && (to === 'number' || to === 'currency')) return true
  return false
}

function copyAnswers(sourceFields, sourceAnswers, targetFields) {
  var sourceMap = {}
  for (var i = 0; i < sourceFields.length; i++) sourceMap[sourceFields[i].code] = sourceFields[i]
  var result = {}
  for (var t = 0; t < targetFields.length; t++) {
    var field = targetFields[t]
    if (!field.copy_previous) continue
    if (field.field_type === 'computed' || field.field_type === 'file' || field.field_type === 'display') {
      continue
    }
    var src = sourceMap[field.code]
    if (!src) continue
    if (!canCopyType(src.field_type, field.field_type)) continue
    if (!(field.code in sourceAnswers)) continue
    result[field.code] = sourceAnswers[field.code]
  }
  return calculateComputed(targetFields, result)
}

module.exports = {
  isEmpty: isEmpty,
  calculateComputed: calculateComputed,
  evaluateRules: evaluateRules,
  validateValues: validateValues,
  copyAnswers: copyAnswers,
}
