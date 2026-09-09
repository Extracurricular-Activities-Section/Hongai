/**
 * Category funding extraction config + helpers.
 * Used by PocketBase hooks (CommonJS).
 */

var FUNDING_FIELD_CONFIGS = {
  language_certification: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      { code: 'exam_registration_fee', label: '報名費用', source: 'field' },
      {
        code: 'requested_items',
        label: '希望補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  academic_learning: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      {
        code: 'requested_items',
        label: '希望補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  common_competency: {
    total_field: 'requested_total',
    items: [
      {
        code: 'requested_items',
        label: '希望補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  professional_certification: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      { code: 'exam_fee', label: '報名／考照費', source: 'field' },
      {
        code: 'requested_items',
        label: '希望補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  career_enhancement: {
    total_field: 'requested_amount',
    items: [{ code: 'requested_amount', label: '補助金額', source: 'field', as_base: true }],
  },
  external_competition: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      { code: 'competition_registration_fee', label: '競賽報名費', source: 'field' },
      { code: 'transportation_fee', label: '交通費', source: 'field' },
      {
        code: 'other_expenses',
        label: '其他費用',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  overseas_study: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      { code: 'tuition_fee', label: '學費／課程費', source: 'field' },
      { code: 'airfare', label: '機票費', source: 'field' },
      {
        code: 'other_requested_items',
        label: '其他補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  cross_domain_learning: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      {
        code: 'requested_items',
        label: '希望補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
  other: {
    total_field: 'requested_total',
    items: [
      { code: 'living_expense', label: '生活補助費用', source: 'field' },
      {
        code: 'requested_items',
        label: '希望補助項目',
        source: 'repeat_group',
        name_key: 'item_name',
        amount_key: 'amount',
      },
    ],
  },
}

var CATEGORY_SHORT_CODES = {
  academic_learning: 'ACAD',
  common_competency: 'COMM',
  language_certification: 'LANG',
  professional_certification: 'CERT',
  career_enhancement: 'CAREER',
  external_competition: 'COMP',
  overseas_study: 'OVERSEA',
  cross_domain_learning: 'CROSS',
  other: 'OTHER',
}

function toNumber(value) {
  if (value == null || value === '') return 0
  var n = Number(value)
  return isNaN(n) ? 0 : n
}

function getAnswers(snapshot) {
  var answers = (snapshot && snapshot.answers) || {}
  var computed = (snapshot && snapshot.computed) || {}
  var merged = {}
  for (var k in answers) {
    if (Object.prototype.hasOwnProperty.call(answers, k)) merged[k] = answers[k]
  }
  for (var c in computed) {
    if (Object.prototype.hasOwnProperty.call(computed, c)) merged[c] = computed[c]
  }
  return merged
}

function extractRequestedFunding(categoryCode, snapshot) {
  var cfg = FUNDING_FIELD_CONFIGS[categoryCode] || {
    total_field: 'requested_total',
    items: [{ code: 'requested_total', label: '補助金額', source: 'field', as_base: true }],
  }
  var values = getAnswers(snapshot)
  var items = []
  var sort = 1

  for (var i = 0; i < cfg.items.length; i++) {
    var itemCfg = cfg.items[i]
    if (itemCfg.source === 'field') {
      var amount = toNumber(values[itemCfg.code])
      if (itemCfg.as_base || amount > 0) {
        items.push({
          item_code: itemCfg.code,
          item_label: itemCfg.label,
          requested_amount: amount,
          sort_order: sort++,
        })
      }
    } else if (itemCfg.source === 'repeat_group') {
      var rows = values[itemCfg.code]
      if (!Array.isArray(rows)) rows = []
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r] || {}
        var rowAmount = toNumber(row[itemCfg.amount_key || 'amount'])
        var label =
          (row[itemCfg.name_key || 'item_name'] && String(row[itemCfg.name_key || 'item_name'])) ||
          itemCfg.label + ' #' + (r + 1)
        items.push({
          item_code: itemCfg.code + '_' + (r + 1),
          item_label: String(label),
          requested_amount: rowAmount,
          sort_order: sort++,
        })
      }
    }
  }

  if (items.length === 0) {
    var fallbackTotal = toNumber(values[cfg.total_field] || values.requested_amount || values.requested_total)
    items.push({
      item_code: 'base_grant',
      item_label: '補助金額',
      requested_amount: fallbackTotal,
      sort_order: 1,
    })
  }

  var requestedTotal = 0
  for (var t = 0; t < items.length; t++) requestedTotal += items[t].requested_amount

  var snapshotTotal = toNumber(values[cfg.total_field])
  if (snapshotTotal > 0) requestedTotal = snapshotTotal

  return {
    category_code: categoryCode,
    requested_total: requestedTotal,
    items: items,
  }
}

function getCategoryShortCode(code) {
  return CATEGORY_SHORT_CODES[code] || 'OTH'
}

/**
 * disabled | optional | required
 * Phase 8 UI: most categories optional so signed-upload flows can be exercised.
 */
var SIGNATURE_UPLOAD_MODES = {
  language_certification: 'optional',
  academic_learning: 'optional',
  common_competency: 'optional',
  professional_certification: 'optional',
  career_enhancement: 'optional',
  external_competition: 'optional',
  overseas_study: 'optional',
  cross_domain_learning: 'optional',
  other: 'optional',
}

function getPdfSignatureUploadMode(categoryCode) {
  return SIGNATURE_UPLOAD_MODES[categoryCode] || 'optional'
}

module.exports = {
  FUNDING_FIELD_CONFIGS: FUNDING_FIELD_CONFIGS,
  CATEGORY_SHORT_CODES: CATEGORY_SHORT_CODES,
  SIGNATURE_UPLOAD_MODES: SIGNATURE_UPLOAD_MODES,
  extractRequestedFunding: extractRequestedFunding,
  getCategoryShortCode: getCategoryShortCode,
  getPdfSignatureUploadMode: getPdfSignatureUploadMode,
  toNumber: toNumber,
}
