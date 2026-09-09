/**
 * CommonJS mirror of pdf-engine/config.js for PocketBase hooks.
 */
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

function getCategoryShortCode(categoryCode) {
  return CATEGORY_SHORT_CODES[categoryCode] || 'OTH'
}

function buildDocumentNumber(academicYear, semester, categoryCode, serial) {
  var short = getCategoryShortCode(categoryCode)
  var seq = ('000000' + String(serial)).slice(-6)
  return 'HAD-' + String(academicYear) + String(semester) + '-' + short + '-' + seq
}

function nextDocumentSerial(app, academicYear, semester, categoryCode) {
  var short = getCategoryShortCode(categoryCode)
  var prefix = 'HAD-' + String(academicYear) + String(semester) + '-' + short + '-'
  var records = []
  try {
    records = app.findRecordsByFilter(
      'had_pdf_documents',
      'document_number ~ {:prefix}',
      '-created',
      500,
      0,
      { prefix: prefix },
    )
  } catch (_) {}
  var max = 0
  for (var i = 0; i < records.length; i++) {
    var num = records[i].getString('document_number')
    var part = num.slice(prefix.length)
    var n = parseInt(part, 10)
    if (!isNaN(n) && n > max) max = n
  }
  return max + 1
}

function createVerificationToken() {
  // 24 bytes -> base64url-ish via hex for Goja compatibility
  try {
    return $security.randomStringWithAlphabet(
      32,
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    )
  } catch (_) {
    return (
      String(Date.now()) +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    )
  }
}

module.exports = {
  CATEGORY_SHORT_CODES: CATEGORY_SHORT_CODES,
  getCategoryShortCode: getCategoryShortCode,
  buildDocumentNumber: buildDocumentNumber,
  nextDocumentSerial: nextDocumentSerial,
  createVerificationToken: createVerificationToken,
}
