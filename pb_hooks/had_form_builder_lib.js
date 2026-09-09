/**
 * Form Builder helpers (requireable; not auto-loaded as routes).
 * Schema load mirrors had_forms.pb.js loadSchemaBundle.
 */

var CODE_RE = /^[a-z][a-z0-9_]*$/

var ALLOWED_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'date_range',
  'select',
  'radio',
  'checkbox',
  'multiselect',
  'url',
  'email',
  'file',
  'repeat_group',
  'monthly_plan',
  'computed',
  'display',
]

var OPTION_FIELD_TYPES = {
  select: 1,
  radio: 1,
  multiselect: 1,
}

var SAFE_FILE_EXTENSIONS = {
  pdf: 1,
  jpg: 1,
  jpeg: 1,
  png: 1,
  docx: 1,
}

var DANGEROUS_FILE_EXTENSIONS = {
  exe: 1,
  bat: 1,
  cmd: 1,
  com: 1,
  msi: 1,
  scr: 1,
  pif: 1,
  vbs: 1,
  vbe: 1,
  js: 1,
  jse: 1,
  wsf: 1,
  wsh: 1,
  ps1: 1,
  sh: 1,
  bash: 1,
  dll: 1,
  sys: 1,
  jar: 1,
  html: 1,
  htm: 1,
  svg: 1,
  php: 1,
  asp: 1,
  aspx: 1,
  jsp: 1,
  py: 1,
  rb: 1,
  docm: 1,
  xlsm: 1,
  pptm: 1,
  lnk: 1,
  reg: 1,
}

var RULE_TYPES = { show_if: 1, hide_if: 1, require_if: 1 }

var RULE_OPERATORS = {
  equals: 1,
  not_equals: 1,
  contains: 1,
  not_contains: 1,
  is_true: 1,
  is_false: 1,
  is_empty: 1,
  is_not_empty: 1,
}

function parseJsonMaybe(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch (_) {
    return null
  }
}

function isValidCode(code) {
  return typeof code === 'string' && CODE_RE.test(code)
}

function normalizeExt(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
}

function versionToPlain(record) {
  return {
    id: record.id,
    form: record.getString('form'),
    version_number: record.getInt('version_number'),
    status: record.getString('status'),
    published_at: record.get('published_at') ? String(record.get('published_at')) : null,
    published_by: record.getString('published_by') || null,
    schema_hash: record.getString('schema_hash') || null,
    notes: record.getString('notes') || null,
    created: String(record.get('created') || ''),
    updated: String(record.get('updated') || ''),
  }
}

function loadSchemaBundle(app, h, versionId) {
  var engine = require(`${__hooks}/had_form_engine.js`)
  var version = app.findRecordById(h.COLLECTIONS.formVersions, versionId)
  var form = app.findRecordById(h.COLLECTIONS.forms, version.getString('form'))
  var category = app.findRecordById(h.COLLECTIONS.applicationCategories, form.getString('category'))

  var sections = app.findRecordsByFilter(
    h.COLLECTIONS.formSections,
    'form_version = {:vid}',
    'sort_order',
    200,
    0,
    { vid: versionId },
  )

  var sectionItems = []
  var flatFields = []
  for (var s = 0; s < sections.length; s++) {
    var section = sections[s]
    var fields = app.findRecordsByFilter(
      h.COLLECTIONS.formFields,
      'section = {:sid}',
      'sort_order',
      300,
      0,
      { sid: section.id },
    )
    var fieldItems = []
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f]
      var options = app.findRecordsByFilter(
        h.COLLECTIONS.formFieldOptions,
        'field = {:fid}',
        'sort_order',
        200,
        0,
        { fid: field.id },
      )
      var optionItems = []
      for (var o = 0; o < options.length; o++) {
        optionItems.push({
          id: options[o].id,
          value: options[o].getString('value'),
          label: options[o].getString('label'),
          sort_order: options[o].getInt('sort_order') || 0,
          active: options[o].getBool('active'),
        })
      }
      var fieldPlain = {
        id: field.id,
        code: field.getString('code'),
        label: field.getString('label'),
        field_type: field.getString('field_type'),
        help_text: field.getString('help_text') || null,
        placeholder: field.getString('placeholder') || null,
        required: field.getBool('required'),
        sort_order: field.getInt('sort_order') || 0,
        default_value: parseJsonMaybe(field.get('default_value')),
        validation: parseJsonMaybe(field.get('validation')),
        config: parseJsonMaybe(field.get('config')),
        pdf_visible: field.getBool('pdf_visible'),
        copy_previous: field.getBool('copy_previous'),
        active: field.getBool('active'),
        options: optionItems,
      }
      fieldItems.push(fieldPlain)
      flatFields.push(fieldPlain)
    }
    sectionItems.push({
      id: section.id,
      code: section.getString('code'),
      title: section.getString('title'),
      description: section.getString('description') || null,
      sort_order: section.getInt('sort_order') || 0,
      visible: section.getBool('visible'),
      pdf_visible: section.getBool('pdf_visible'),
      fields: fieldItems,
    })
  }

  var rules = app.findRecordsByFilter(
    h.COLLECTIONS.formRules,
    'form_version = {:vid}',
    'sort_order',
    300,
    0,
    { vid: versionId },
  )
  var ruleItems = []
  for (var r = 0; r < rules.length; r++) {
    var rule = rules[r]
    var fieldCode = ''
    try {
      var fr = app.findRecordById(h.COLLECTIONS.formFields, rule.getString('field'))
      fieldCode = fr.getString('code')
    } catch (_) {}
    ruleItems.push({
      id: rule.id,
      field_id: rule.getString('field'),
      field_code: fieldCode,
      rule_type: rule.getString('rule_type'),
      source_field_code: rule.getString('source_field_code'),
      operator: rule.getString('operator'),
      value: parseJsonMaybe(rule.get('value')),
      config: parseJsonMaybe(rule.get('config')),
      sort_order: rule.getInt('sort_order') || 0,
    })
  }

  return {
    engine: engine,
    form: form,
    version: version,
    category: category,
    fields: flatFields,
    rules: ruleItems,
    schema: {
      form: {
        id: form.id,
        name: form.getString('name'),
        description: form.getString('description') || null,
        category_id: category.id,
        category_code: category.getString('code'),
        category_name: category.getString('name'),
      },
      version: {
        id: version.id,
        version_number: version.getInt('version_number'),
        status: version.getString('status'),
      },
      sections: sectionItems,
      rules: ruleItems,
    },
  }
}

function schemaSummaryFromBundle(bundle) {
  return {
    version: versionToPlain(bundle.version),
    section_count: (bundle.schema.sections || []).length,
    field_count: (bundle.fields || []).length,
    rule_count: (bundle.rules || []).length,
  }
}

function formMetaPlain(app, h, form) {
  var category = null
  try {
    category = app.findRecordById(h.COLLECTIONS.applicationCategories, form.getString('category'))
  } catch (_) {}
  return {
    id: form.id,
    name: form.getString('name'),
    description: form.getString('description') || null,
    active: form.getBool('active'),
    category_id: form.getString('category'),
    category_code: category ? category.getString('code') : null,
    category_name: category ? category.getString('name') : null,
    current_published_version_id: form.getString('current_published_version') || null,
  }
}

function listVersionsForForm(app, h, formId) {
  return app.findRecordsByFilter(
    h.COLLECTIONS.formVersions,
    'form = {:fid}',
    '-version_number',
    100,
    0,
    { fid: formId },
  )
}

function findDraftVersion(app, h, formId) {
  try {
    return app.findFirstRecordByFilter(
      h.COLLECTIONS.formVersions,
      'form = {:fid} && status = "draft"',
      { fid: formId },
    )
  } catch (_) {
    return null
  }
}

function nextVersionNumber(app, h, formId) {
  var rows = app.findRecordsByFilter(
    h.COLLECTIONS.formVersions,
    'form = {:fid}',
    '-version_number',
    1,
    0,
    { fid: formId },
  )
  if (!rows.length) return 1
  return (rows[0].getInt('version_number') || 0) + 1
}

function assertFormVersionMatch(version, formId) {
  if (version.getString('form') !== formId) {
    throw new BadRequestError('版本與表單不符')
  }
}

function resolveVersionStatusForChild(app, h, collectionName, record) {
  try {
    if (collectionName === h.COLLECTIONS.formVersions) {
      return record.getString('status')
    }
    if (collectionName === h.COLLECTIONS.formSections) {
      var v1 = app.findRecordById(h.COLLECTIONS.formVersions, record.getString('form_version'))
      return v1.getString('status')
    }
    if (collectionName === h.COLLECTIONS.formRules) {
      var v2 = app.findRecordById(h.COLLECTIONS.formVersions, record.getString('form_version'))
      return v2.getString('status')
    }
    if (collectionName === h.COLLECTIONS.formFields) {
      var section = app.findRecordById(h.COLLECTIONS.formSections, record.getString('section'))
      var v3 = app.findRecordById(h.COLLECTIONS.formVersions, section.getString('form_version'))
      return v3.getString('status')
    }
    if (collectionName === h.COLLECTIONS.formFieldOptions) {
      var field = app.findRecordById(h.COLLECTIONS.formFields, record.getString('field'))
      var section2 = app.findRecordById(h.COLLECTIONS.formSections, field.getString('section'))
      var v4 = app.findRecordById(h.COLLECTIONS.formVersions, section2.getString('form_version'))
      return v4.getString('status')
    }
  } catch (_) {
    return null
  }
  return null
}

function assertParentVersionDraft(app, h, collectionName, record) {
  var status = resolveVersionStatusForChild(app, h, collectionName, record)
  if (status === 'published' || status === 'retired') {
    throw new BadRequestError('已發布或已封存的表單版本不可修改結構')
  }
}

function assertVersionUpdateAllowed(record) {
  var original = null
  try {
    original = record.original()
  } catch (_) {
    original = null
  }
  var oldStatus = original ? original.getString('status') : ''
  var newStatus = record.getString('status')

  if (oldStatus === 'retired') {
    throw new BadRequestError('已封存的版本不可修改')
  }
  if (oldStatus === 'published') {
    // Publish flow may retire a previous published version.
    if (newStatus !== 'retired') {
      throw new BadRequestError('已發布的版本不可修改（僅允許封存）')
    }
  }
}

function clearVersionSchema(app, h, versionId) {
  var rules = app.findRecordsByFilter(
    h.COLLECTIONS.formRules,
    'form_version = {:vid}',
    'id',
    500,
    0,
    { vid: versionId },
  )
  for (var r = 0; r < rules.length; r++) {
    app.delete(rules[r])
  }

  var sections = app.findRecordsByFilter(
    h.COLLECTIONS.formSections,
    'form_version = {:vid}',
    'id',
    200,
    0,
    { vid: versionId },
  )
  for (var s = 0; s < sections.length; s++) {
    // cascade deletes fields + options
    app.delete(sections[s])
  }
}

function writeSchemaIntoVersion(app, h, versionId, sections, rules) {
  var sectionsCol = app.findCollectionByNameOrId(h.COLLECTIONS.formSections)
  var fieldsCol = app.findCollectionByNameOrId(h.COLLECTIONS.formFields)
  var optionsCol = app.findCollectionByNameOrId(h.COLLECTIONS.formFieldOptions)
  var rulesCol = app.findCollectionByNameOrId(h.COLLECTIONS.formRules)

  var fieldByCode = {}
  var secList = Array.isArray(sections) ? sections : []
  for (var s = 0; s < secList.length; s++) {
    var secDef = secList[s] || {}
    var section = new Record(sectionsCol)
    section.set('form_version', versionId)
    section.set('code', String(secDef.code || ''))
    section.set('title', String(secDef.title || ''))
    section.set('description', secDef.description != null ? String(secDef.description) : '')
    section.set('sort_order', secDef.sort_order != null ? Number(secDef.sort_order) : s + 1)
    section.set('visible', secDef.visible !== false)
    section.set('pdf_visible', secDef.pdf_visible !== false)
    app.save(section)

    var fields = Array.isArray(secDef.fields) ? secDef.fields : []
    for (var fi = 0; fi < fields.length; fi++) {
      var fieldDef = fields[fi] || {}
      var field = new Record(fieldsCol)
      field.set('section', section.id)
      field.set('code', String(fieldDef.code || ''))
      field.set('label', String(fieldDef.label || ''))
      field.set('field_type', String(fieldDef.field_type || 'text'))
      field.set('help_text', fieldDef.help_text != null ? String(fieldDef.help_text) : '')
      field.set('placeholder', fieldDef.placeholder != null ? String(fieldDef.placeholder) : '')
      field.set('required', !!fieldDef.required)
      field.set('sort_order', fieldDef.sort_order != null ? Number(fieldDef.sort_order) : fi + 1)
      if (fieldDef.default_value !== undefined) field.set('default_value', fieldDef.default_value)
      if (fieldDef.validation !== undefined) field.set('validation', fieldDef.validation)
      if (fieldDef.config !== undefined) field.set('config', fieldDef.config)
      field.set('pdf_visible', fieldDef.pdf_visible !== false)
      field.set('copy_previous', fieldDef.copy_previous !== false)
      field.set('active', fieldDef.active !== false)
      app.save(field)
      fieldByCode[fieldDef.code] = field

      var options = Array.isArray(fieldDef.options) ? fieldDef.options : []
      for (var oi = 0; oi < options.length; oi++) {
        var opt = options[oi] || {}
        var option = new Record(optionsCol)
        option.set('field', field.id)
        option.set('value', String(opt.value != null ? opt.value : ''))
        option.set('label', String(opt.label != null ? opt.label : ''))
        option.set('sort_order', opt.sort_order != null ? Number(opt.sort_order) : oi + 1)
        option.set('active', opt.active !== false)
        app.save(option)
      }
    }
  }

  var ruleList = Array.isArray(rules) ? rules : []
  for (var r = 0; r < ruleList.length; r++) {
    var ruleDef = ruleList[r] || {}
    var target = fieldByCode[ruleDef.field_code]
    if (!target && ruleDef.field_id) {
      // fallback: match by previously known id is not available after recreate
      target = null
    }
    if (!target) continue
    var rule = new Record(rulesCol)
    rule.set('form_version', versionId)
    rule.set('field', target.id)
    rule.set('rule_type', String(ruleDef.rule_type || ''))
    rule.set('source_field_code', String(ruleDef.source_field_code || ''))
    rule.set('operator', String(ruleDef.operator || 'equals'))
    if (ruleDef.value !== undefined) rule.set('value', ruleDef.value)
    if (ruleDef.config !== undefined) rule.set('config', ruleDef.config)
    rule.set('sort_order', ruleDef.sort_order != null ? Number(ruleDef.sort_order) : r + 1)
    app.save(rule)
  }

  return fieldByCode
}

function replaceDraftSchema(app, h, versionId, sections, rules) {
  app.runInTransaction(function (txApp) {
    clearVersionSchema(txApp, h, versionId)
    writeSchemaIntoVersion(txApp, h, versionId, sections, rules)
  })
}

function cloneSchemaIntoVersion(app, h, sourceVersionId, targetVersionId) {
  var bundle = loadSchemaBundle(app, h, sourceVersionId)
  writeSchemaIntoVersion(app, h, targetVersionId, bundle.schema.sections, bundle.schema.rules)
}

function collectSchemaIssuesForSave(sections, rules) {
  var issues = []
  var sectionCodes = {}
  var fieldCodes = {}
  var secList = Array.isArray(sections) ? sections : []

  if (!secList.length) {
    // save allows empty draft temporarily; publish will reject
  }

  for (var s = 0; s < secList.length; s++) {
    var sec = secList[s] || {}
    var scode = String(sec.code || '')
    if (!isValidCode(scode)) {
      issues.push({
        code: 'invalid_section_code',
        section_code: scode,
        message: '區塊代碼格式無效（須符合 /^[a-z][a-z0-9_]*$/）',
      })
    } else if (sectionCodes[scode]) {
      issues.push({
        code: 'duplicate_section_code',
        section_code: scode,
        message: '區塊代碼重複：' + scode,
      })
    } else {
      sectionCodes[scode] = 1
    }
    if (!String(sec.title || '').trim()) {
      issues.push({
        code: 'missing_section_title',
        section_code: scode,
        message: '區塊標題必填',
      })
    }

    var fields = Array.isArray(sec.fields) ? sec.fields : []
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f] || {}
      var fcode = String(field.code || '')
      var ftype = String(field.field_type || '')
      if (!isValidCode(fcode)) {
        issues.push({
          code: 'invalid_field_code',
          field_code: fcode,
          section_code: scode,
          message: '欄位代碼格式無效（須符合 /^[a-z][a-z0-9_]*$/）',
        })
      } else if (fieldCodes[fcode]) {
        issues.push({
          code: 'duplicate_field_code',
          field_code: fcode,
          message: '欄位代碼重複：' + fcode,
        })
      } else {
        fieldCodes[fcode] = ftype
      }

      if (ALLOWED_FIELD_TYPES.indexOf(ftype) < 0) {
        issues.push({
          code: 'invalid_field_type',
          field_code: fcode,
          message: '不支援的欄位類型：' + ftype,
        })
      }
      if (!String(field.label || '').trim()) {
        issues.push({
          code: 'missing_field_label',
          field_code: fcode,
          message: '欄位標籤必填',
        })
      }

      if (ftype === 'file') {
        var fileIssues = validateFileConfig(field)
        for (var fi = 0; fi < fileIssues.length; fi++) issues.push(fileIssues[fi])
      }
    }
  }

  var ruleList = Array.isArray(rules) ? rules : []
  for (var r = 0; r < ruleList.length; r++) {
    var rule = ruleList[r] || {}
    var rt = String(rule.rule_type || '')
    var op = String(rule.operator || '')
    var ruleField = String(rule.field_code || '')
    var ruleSource = String(rule.source_field_code || '')
    if (!RULE_TYPES[rt]) {
      issues.push({
        code: 'invalid_rule_type',
        field_code: ruleField,
        message: '規則類型無效',
      })
    }
    if (!RULE_OPERATORS[op]) {
      issues.push({
        code: 'invalid_rule_operator',
        field_code: ruleField,
        message: '規則運算子無效',
      })
    }
    if (ruleField && !fieldCodes[ruleField]) {
      issues.push({
        code: 'rule_field_missing',
        field_code: ruleField,
        message: '規則目標欄位不存在：' + ruleField,
      })
    }
    if (ruleSource && !fieldCodes[ruleSource]) {
      issues.push({
        code: 'rule_source_missing',
        field_code: ruleField,
        message: '規則來源欄位不存在：' + ruleSource,
      })
    }
  }

  return issues
}

function validateFileConfig(field) {
  var issues = []
  var config = field.config && typeof field.config === 'object' ? field.config : {}
  var exts = config.allowed_extensions
  if (exts == null) return issues
  if (!Array.isArray(exts)) {
    issues.push({
      code: 'invalid_file_extensions',
      field_code: String(field.code || ''),
      message: '檔案欄位 allowed_extensions 必須為陣列',
    })
    return issues
  }
  for (var i = 0; i < exts.length; i++) {
    var ext = normalizeExt(exts[i])
    if (!ext) continue
    if (DANGEROUS_FILE_EXTENSIONS[ext] || !SAFE_FILE_EXTENSIONS[ext]) {
      issues.push({
        code: 'unsafe_file_extension',
        field_code: String(field.code || ''),
        message: '檔案副檔名不允許：' + ext + '（僅允許 pdf,jpg,jpeg,png,docx）',
      })
    }
  }
  return issues
}

function rootFieldToken(token) {
  var t = String(token || '')
  var idx = t.indexOf('.')
  return idx >= 0 ? t.slice(0, idx) : t
}

function detectCircularRules(rules) {
  var graph = {}
  var ruleList = Array.isArray(rules) ? rules : []
  for (var i = 0; i < ruleList.length; i++) {
    var rule = ruleList[i] || {}
    var rt = String(rule.rule_type || '')
    if (!RULE_TYPES[rt]) continue
    var from = String(rule.field_code || '')
    var to = String(rule.source_field_code || '')
    if (!from || !to) continue
    if (!graph[from]) graph[from] = []
    graph[from].push(to)
  }

  var color = {} // 1 = visiting (gray), 2 = done (black)
  var stack = []
  var cyclePath = null

  function dfs(node) {
    color[node] = 1
    stack.push(node)
    var deps = graph[node] || []
    for (var d = 0; d < deps.length; d++) {
      var next = deps[d]
      if (color[next] === 1) {
        var start = stack.indexOf(next)
        cyclePath = stack.slice(start >= 0 ? start : 0).concat([next])
        return true
      }
      if (color[next] === 2) continue
      if (dfs(next)) return true
    }
    stack.pop()
    color[node] = 2
    return false
  }

  var nodes = Object.keys(graph)
  for (var n = 0; n < nodes.length; n++) {
    if (!color[nodes[n]] && dfs(nodes[n])) {
      return { cyclic: true, path: cyclePath || [] }
    }
  }
  return { cyclic: false, path: [] }
}

function indexFieldsByCode(sections) {
  var map = {}
  var secList = Array.isArray(sections) ? sections : []
  for (var s = 0; s < secList.length; s++) {
    var fields = Array.isArray(secList[s].fields) ? secList[s].fields : []
    for (var f = 0; f < fields.length; f++) {
      var code = String(fields[f].code || '')
      if (code) map[code] = fields[f]
    }
  }
  return map
}

function validateSchemaForPublish(sections, rules) {
  var issues = collectSchemaIssuesForSave(sections, rules)
  var secList = Array.isArray(sections) ? sections : []
  if (secList.length < 1) {
    issues.push({ code: 'no_sections', message: '發布前至少需要一個區塊' })
  }

  var fieldCodes = indexFieldsByCode(secList)

  for (var code in fieldCodes) {
    if (!Object.prototype.hasOwnProperty.call(fieldCodes, code)) continue
    var field = fieldCodes[code]
    var ftype = String(field.field_type || '')

    if (OPTION_FIELD_TYPES[ftype]) {
      var opts = Array.isArray(field.options) ? field.options : []
      var activeOpts = 0
      for (var o = 0; o < opts.length; o++) {
        if (
          opts[o] &&
          opts[o].active !== false &&
          String(opts[o].value != null ? opts[o].value : '') !== ''
        ) {
          activeOpts++
        }
      }
      if (activeOpts < 1) {
        issues.push({
          code: 'missing_options',
          field_code: code,
          message: '選項型欄位至少需要一個選項：' + code,
        })
      }
    }

    if (ftype === 'computed') {
      var config = field.config && typeof field.config === 'object' ? field.config : {}
      var op = String(config.operation || '')
      if (op === 'sum') {
        var tokens = Array.isArray(config.fields) ? config.fields : []
        if (!tokens.length) {
          issues.push({
            code: 'computed_missing_sources',
            field_code: code,
            message: '計算欄位缺少加總來源：' + code,
          })
        }
        for (var t = 0; t < tokens.length; t++) {
          var root = rootFieldToken(tokens[t])
          if (!fieldCodes[root]) {
            issues.push({
              code: 'computed_source_missing',
              field_code: code,
              message: '計算欄位來源不存在：' + root,
            })
          }
        }
      } else if (op === 'date_diff_days' || op === 'date_diff_months') {
        var start = String(config.start || '')
        var end = String(config.end || '')
        if (!start || !end) {
          issues.push({
            code: 'computed_missing_dates',
            field_code: code,
            message: '日期計算欄位需指定 start / end：' + code,
          })
        } else {
          if (!fieldCodes[start]) {
            issues.push({
              code: 'computed_source_missing',
              field_code: code,
              message: '計算欄位來源不存在：' + start,
            })
          }
          if (!fieldCodes[end]) {
            issues.push({
              code: 'computed_source_missing',
              field_code: code,
              message: '計算欄位來源不存在：' + end,
            })
          }
        }
      } else {
        issues.push({
          code: 'computed_invalid_operation',
          field_code: code,
          message: '計算欄位 operation 無效：' + code,
        })
      }
    }
  }

  var ruleList = Array.isArray(rules) ? rules : []
  for (var r = 0; r < ruleList.length; r++) {
    var rule = ruleList[r] || {}
    var fieldCode = String(rule.field_code || '')
    var source = String(rule.source_field_code || '')
    if (!fieldCodes[fieldCode]) {
      issues.push({
        code: 'rule_field_missing',
        field_code: fieldCode,
        message: '規則目標欄位不存在：' + fieldCode,
      })
    }
    if (!source || !fieldCodes[source]) {
      issues.push({
        code: 'rule_source_missing',
        field_code: fieldCode,
        message: '規則來源欄位不存在：' + source,
      })
    }
  }

  var cycle = detectCircularRules(ruleList)
  if (cycle.cyclic) {
    issues.push({
      code: 'circular_rules',
      message: '條件規則存在循環依賴：' + (cycle.path || []).join(' → '),
    })
  }

  return { ok: issues.length === 0, issues: issues }
}

function validateStoredVersionForPublish(app, h, versionId) {
  var bundle = loadSchemaBundle(app, h, versionId)
  return validateSchemaForPublish(bundle.schema.sections, bundle.schema.rules)
}

module.exports = {
  CODE_RE: CODE_RE,
  ALLOWED_FIELD_TYPES: ALLOWED_FIELD_TYPES,
  SAFE_FILE_EXTENSIONS: SAFE_FILE_EXTENSIONS,
  parseJsonMaybe: parseJsonMaybe,
  isValidCode: isValidCode,
  versionToPlain: versionToPlain,
  loadSchemaBundle: loadSchemaBundle,
  schemaSummaryFromBundle: schemaSummaryFromBundle,
  formMetaPlain: formMetaPlain,
  listVersionsForForm: listVersionsForForm,
  findDraftVersion: findDraftVersion,
  nextVersionNumber: nextVersionNumber,
  assertFormVersionMatch: assertFormVersionMatch,
  resolveVersionStatusForChild: resolveVersionStatusForChild,
  assertParentVersionDraft: assertParentVersionDraft,
  assertVersionUpdateAllowed: assertVersionUpdateAllowed,
  clearVersionSchema: clearVersionSchema,
  writeSchemaIntoVersion: writeSchemaIntoVersion,
  replaceDraftSchema: replaceDraftSchema,
  cloneSchemaIntoVersion: cloneSchemaIntoVersion,
  collectSchemaIssuesForSave: collectSchemaIssuesForSave,
  validateFileConfig: validateFileConfig,
  detectCircularRules: detectCircularRules,
  validateSchemaForPublish: validateSchemaForPublish,
  validateStoredVersionForPublish: validateStoredVersionForPublish,
}
