/**
 * Idempotent seed for 9 forms + published V1 schemas.
 * Loaded from migration via require(__hooks + '/had_form_seed.js')
 * or relative path for tooling.
 */
function loadDefinitions() {
  // PocketBase hooks / migrations
  try {
    return require(`${__hooks}/../pb_migrations/seeds/form_v1_definitions.js`)
  } catch (_) {}
  try {
    return require('../pb_migrations/seeds/form_v1_definitions.js')
  } catch (_) {}
  try {
    return require('./seeds/form_v1_definitions.js')
  } catch (_) {}
  throw new Error('[hong-ai-dream] Unable to load form_v1_definitions.js')
}

function ensureFormSeeds(app) {
  const defsModule = loadDefinitions()
  const definitions = defsModule.getFormDefinitions()
  const categories = app.findCollectionByNameOrId('had_application_categories')
  const formsCol = app.findCollectionByNameOrId('had_forms')
  const versionsCol = app.findCollectionByNameOrId('had_form_versions')
  const sectionsCol = app.findCollectionByNameOrId('had_form_sections')
  const fieldsCol = app.findCollectionByNameOrId('had_form_fields')
  const optionsCol = app.findCollectionByNameOrId('had_form_field_options')
  const rulesCol = app.findCollectionByNameOrId('had_form_rules')

  for (var i = 0; i < definitions.length; i++) {
    const def = definitions[i]
    var category = null
    try {
      category = app.findFirstRecordByData('had_application_categories', 'code', def.category_code)
    } catch (_) {
      console.log('[hong-ai-dream] skip form seed, missing category: ' + def.category_code)
      continue
    }

    var form = null
    try {
      form = app.findFirstRecordByFilter('had_forms', 'category = {:cid}', { cid: category.id })
    } catch (_) {
      form = new Record(formsCol)
      form.set('category', category.id)
      form.set('name', def.name)
      form.set('description', def.description || '')
      form.set('active', true)
      app.save(form)
    }

    var version = null
    try {
      version = app.findFirstRecordByFilter(
        'had_form_versions',
        'form = {:fid} && version_number = 1',
        { fid: form.id },
      )
    } catch (_) {
      version = new Record(versionsCol)
      version.set('form', form.id)
      version.set('version_number', 1)
      version.set('status', 'published')
      version.set('published_at', new Date().toISOString())
      version.set('notes', 'Initial V1 seed')
      app.save(version)

      form.set('current_published_version', version.id)
      form.set('name', def.name)
      form.set('description', def.description || '')
      app.save(form)

      seedVersionSchema(app, version, def, {
        sectionsCol: sectionsCol,
        fieldsCol: fieldsCol,
        optionsCol: optionsCol,
        rulesCol: rulesCol,
      })
    }
  }
}

function seedVersionSchema(app, version, def, cols) {
  var fieldByCode = {}
  var sections = def.sections || []
  for (var s = 0; s < sections.length; s++) {
    var secDef = sections[s]
    var section = new Record(cols.sectionsCol)
    section.set('form_version', version.id)
    section.set('code', secDef.code)
    section.set('title', secDef.title)
    section.set('description', secDef.description || '')
    section.set('sort_order', secDef.sort_order || s + 1)
    section.set('visible', true)
    section.set('pdf_visible', true)
    app.save(section)

    var fields = secDef.fields || []
    for (var fi = 0; fi < fields.length; fi++) {
      var fieldDef = fields[fi]
      var field = new Record(cols.fieldsCol)
      field.set('section', section.id)
      field.set('code', fieldDef.code)
      field.set('label', fieldDef.label)
      field.set('field_type', fieldDef.field_type)
      field.set('help_text', fieldDef.help_text || '')
      field.set('placeholder', fieldDef.placeholder || '')
      field.set('required', !!fieldDef.required)
      field.set('sort_order', fieldDef.sort_order || fi + 1)
      field.set('default_value', fieldDef.default_value)
      field.set('validation', fieldDef.validation)
      field.set('config', fieldDef.config)
      field.set('pdf_visible', fieldDef.pdf_visible !== false)
      field.set('copy_previous', fieldDef.copy_previous !== false)
      field.set('active', fieldDef.active !== false)
      app.save(field)
      fieldByCode[fieldDef.code] = field

      var options = fieldDef.options || []
      for (var oi = 0; oi < options.length; oi++) {
        var opt = options[oi]
        var option = new Record(cols.optionsCol)
        option.set('field', field.id)
        option.set('value', String(opt.value))
        option.set('label', opt.label)
        option.set('sort_order', opt.sort_order || oi + 1)
        option.set('active', true)
        app.save(option)
      }
    }
  }

  var rules = def.rules || []
  for (var r = 0; r < rules.length; r++) {
    var ruleDef = rules[r]
    var target = fieldByCode[ruleDef.field_code]
    if (!target) continue
    var rule = new Record(cols.rulesCol)
    rule.set('form_version', version.id)
    rule.set('field', target.id)
    rule.set('rule_type', ruleDef.rule_type)
    rule.set('source_field_code', ruleDef.source_field_code)
    rule.set('operator', ruleDef.operator)
    rule.set('value', ruleDef.value)
    rule.set('config', ruleDef.config)
    rule.set('sort_order', ruleDef.sort_order || r + 1)
    app.save(rule)
  }
}

module.exports = {
  ensureFormSeeds: ensureFormSeeds,
  loadDefinitions: loadDefinitions,
}
