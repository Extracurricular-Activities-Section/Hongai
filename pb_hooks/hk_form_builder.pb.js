/// <reference path="../pb_data/types.d.ts" />

/**
 * Admin Form Builder APIs
 *
 * GET    /api/hk/admin/forms/{formId}/versions
 * GET    /api/hk/admin/forms/{formId}/draft
 * POST   /api/hk/admin/forms/{formId}/draft            body: { from_version_id? }
 * PUT    /api/hk/admin/forms/{formId}/versions/{versionId}/schema
 * POST   /api/hk/admin/forms/{formId}/versions/{versionId}/publish
 */

function parseJsonMaybe(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch (_) {
    return null
  }
}

function loadSchemaBundle(app, h, versionId) {
  const version = app.findRecordById(h.COLLECTIONS.formVersions, versionId)
  const form = app.findRecordById(h.COLLECTIONS.forms, version.getString('form'))
  const category = app.findRecordById(h.COLLECTIONS.applicationCategories, form.getString('category'))

  const sections = app.findRecordsByFilter(
    h.COLLECTIONS.formSections,
    'form_version = {:vid}',
    'sort_order',
    200,
    0,
    { vid: versionId },
  )

  const sectionItems = []
  const fieldByCode = {}
  for (var s = 0; s < sections.length; s++) {
    const section = sections[s]
    const fields = app.findRecordsByFilter(
      h.COLLECTIONS.formFields,
      'section = {:sid}',
      'sort_order',
      300,
      0,
      { sid: section.id },
    )
    const fieldItems = []
    for (var f = 0; f < fields.length; f++) {
      const field = fields[f]
      const options = app.findRecordsByFilter(
        h.COLLECTIONS.formFieldOptions,
        'field = {:fid}',
        'sort_order',
        100,
        0,
        { fid: field.id },
      )
      const optionItems = []
      for (var o = 0; o < options.length; o++) {
        optionItems.push({
          id: options[o].id,
          value: options[o].getString('value'),
          label: options[o].getString('label'),
          sort_order: options[o].getInt('sort_order') || 0,
          active: options[o].getBool('active'),
        })
      }
      const fieldPlain = {
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
      fieldByCode[fieldPlain.code] = fieldPlain
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

  const rules = app.findRecordsByFilter(
    h.COLLECTIONS.formRules,
    'form_version = {:vid}',
    'sort_order',
    300,
    0,
    { vid: versionId },
  )
  const ruleItems = []
  for (var r = 0; r < rules.length; r++) {
    const rule = rules[r]
    let fieldCode = ''
    try {
      const fr = app.findRecordById(h.COLLECTIONS.formFields, rule.getString('field'))
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
      sort_order: rule.getInt('sort_order') || 0,
    })
  }

  return {
    form: form,
    version: version,
    category: category,
    fieldByCode: fieldByCode,
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
  const versions = app.findRecordsByFilter(
    h.COLLECTIONS.formVersions,
    'form = {:fid}',
    '-version_number',
    1,
    0,
    { fid: formId },
  )
  if (!versions.length) return 1
  return (versions[0].getInt('version_number') || 0) + 1
}

function deleteVersionSchema(app, h, versionId) {
  const sections = app.findRecordsByFilter(
    h.COLLECTIONS.formSections,
    'form_version = {:vid}',
    '',
    500,
    0,
    { vid: versionId },
  )
  for (var i = 0; i < sections.length; i++) {
    app.delete(sections[i])
  }
  const rules = app.findRecordsByFilter(
    h.COLLECTIONS.formRules,
    'form_version = {:vid}',
    '',
    500,
    0,
    { vid: versionId },
  )
  for (var r = 0; r < rules.length; r++) {
    app.delete(rules[r])
  }
}

function cloneSchemaToVersion(app, h, sourceVersionId, targetVersionId) {
  const source = loadSchemaBundle(app, h, sourceVersionId)
  writeSchemaToVersion(app, h, targetVersionId, source.schema.sections, source.schema.rules)
}

function writeSchemaToVersion(app, h, versionId, sectionsInput, rulesInput) {
  const sectionsCol = app.findCollectionByNameOrId(h.COLLECTIONS.formSections)
  const fieldsCol = app.findCollectionByNameOrId(h.COLLECTIONS.formFields)
  const optionsCol = app.findCollectionByNameOrId(h.COLLECTIONS.formFieldOptions)
  const rulesCol = app.findCollectionByNameOrId(h.COLLECTIONS.formRules)

  deleteVersionSchema(app, h, versionId)

  const fieldIdByCode = {}
  const sections = Array.isArray(sectionsInput) ? sectionsInput : []
  for (var s = 0; s < sections.length; s++) {
    const secDef = sections[s] || {}
    const section = new Record(sectionsCol)
    section.set('form_version', versionId)
    section.set('code', String(secDef.code || 'section_' + (s + 1)))
    section.set('title', String(secDef.title || '區塊'))
    section.set('description', secDef.description == null ? '' : String(secDef.description))
    section.set('sort_order', Number(secDef.sort_order) || s + 1)
    section.set('visible', secDef.visible !== false)
    section.set('pdf_visible', secDef.pdf_visible !== false)
    app.save(section)

    const fields = Array.isArray(secDef.fields) ? secDef.fields : []
    for (var f = 0; f < fields.length; f++) {
      const fieldDef = fields[f] || {}
      const field = new Record(fieldsCol)
      field.set('section', section.id)
      field.set('code', String(fieldDef.code || 'field_' + (f + 1)))
      field.set('label', String(fieldDef.label || '欄位'))
      field.set('field_type', String(fieldDef.field_type || 'text'))
      field.set('help_text', fieldDef.help_text == null ? '' : String(fieldDef.help_text))
      field.set('placeholder', fieldDef.placeholder == null ? '' : String(fieldDef.placeholder))
      field.set('required', !!fieldDef.required)
      field.set('sort_order', Number(fieldDef.sort_order) || f + 1)
      field.set('default_value', fieldDef.default_value == null ? null : fieldDef.default_value)
      field.set('validation', fieldDef.validation == null ? null : fieldDef.validation)
      field.set('config', fieldDef.config == null ? null : fieldDef.config)
      field.set('pdf_visible', fieldDef.pdf_visible !== false)
      field.set('copy_previous', fieldDef.copy_previous !== false)
      field.set('active', fieldDef.active !== false)
      app.save(field)
      fieldIdByCode[field.getString('code')] = field.id

      const options = Array.isArray(fieldDef.options) ? fieldDef.options : []
      for (var o = 0; o < options.length; o++) {
        const optDef = options[o] || {}
        const option = new Record(optionsCol)
        option.set('field', field.id)
        option.set('value', String(optDef.value || 'option_' + (o + 1)))
        option.set('label', String(optDef.label || '選項'))
        option.set('sort_order', Number(optDef.sort_order) || o + 1)
        option.set('active', optDef.active !== false)
        app.save(option)
      }
    }
  }

  const rules = Array.isArray(rulesInput) ? rulesInput : []
  for (var r = 0; r < rules.length; r++) {
    const ruleDef = rules[r] || {}
    const fieldCode = String(ruleDef.field_code || '')
    const fieldId = fieldIdByCode[fieldCode]
    if (!fieldId) continue
    const rule = new Record(rulesCol)
    rule.set('form_version', versionId)
    rule.set('field', fieldId)
    rule.set('rule_type', String(ruleDef.rule_type || 'show_if'))
    rule.set('source_field_code', String(ruleDef.source_field_code || ''))
    rule.set('operator', String(ruleDef.operator || 'equals'))
    rule.set('value', ruleDef.value == null ? null : ruleDef.value)
    rule.set('sort_order', Number(ruleDef.sort_order) || r + 1)
    app.save(rule)
  }
}

function ensureForm(app, h, formId) {
  return app.findRecordById(h.COLLECTIONS.forms, formId)
}

routerAdd('GET', '/api/hk/admin/forms/{formId}/versions', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  h.requireAdminAuth(e)
  const formId = e.request.pathValue('formId')
  ensureForm(e.app, h, formId)
  const versions = e.app.findRecordsByFilter(
    h.COLLECTIONS.formVersions,
    'form = {:fid}',
    '-version_number',
    100,
    0,
    { fid: formId },
  )
  const items = []
  for (var i = 0; i < versions.length; i++) {
    const version = versions[i]
    items.push({
      id: version.id,
      version_number: version.getInt('version_number'),
      status: version.getString('status'),
      published_at: version.get('published_at') ? String(version.get('published_at')) : null,
      notes: version.getString('notes') || null,
      created: String(version.get('created') || ''),
      updated: String(version.get('updated') || ''),
    })
  }
  return e.json(200, { items: items })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('GET', '/api/hk/admin/forms/{formId}/draft', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  h.requireAdminAuth(e)
  const formId = e.request.pathValue('formId')
  ensureForm(e.app, h, formId)
  const draft = findDraftVersion(e.app, h, formId)
  if (!draft) throw new NotFoundError('尚無草稿')
  const bundle = loadSchemaBundle(e.app, h, draft.id)
  return e.json(200, { schema: bundle.schema })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('POST', '/api/hk/admin/forms/{formId}/draft', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const staff = h.requireAdminAuth(e)
  const formId = e.request.pathValue('formId')
  const form = ensureForm(e.app, h, formId)
  const body = e.requestInfo().body || {}
  const fromVersionId = h.trimStr(body.from_version_id)

  let sourceId = fromVersionId
  if (!sourceId) {
    sourceId = form.getString('current_published_version')
  }
  if (!sourceId) {
    // fallback: highest version
    const versions = e.app.findRecordsByFilter(
      h.COLLECTIONS.formVersions,
      'form = {:fid}',
      '-version_number',
      1,
      0,
      { fid: formId },
    )
    if (versions.length) sourceId = versions[0].id
  }
  if (!sourceId) throw new BadRequestError('沒有可複製的來源版本')

  const source = e.app.findRecordById(h.COLLECTIONS.formVersions, sourceId)
  if (source.getString('form') !== formId) throw new BadRequestError('來源版本與表單不符')

  let draft = findDraftVersion(e.app, h, formId)
  if (draft && !fromVersionId) {
    const bundle = loadSchemaBundle(e.app, h, draft.id)
    return e.json(200, { schema: bundle.schema })
  }

  if (draft && fromVersionId) {
    deleteVersionSchema(e.app, h, draft.id)
    cloneSchemaToVersion(e.app, h, sourceId, draft.id)
    draft.set('notes', 'Cloned from V' + source.getInt('version_number'))
    e.app.save(draft)
  } else {
    const versionsCol = e.app.findCollectionByNameOrId(h.COLLECTIONS.formVersions)
    draft = new Record(versionsCol)
    draft.set('form', formId)
    draft.set('version_number', nextVersionNumber(e.app, h, formId))
    draft.set('status', 'draft')
    draft.set('notes', 'Draft from V' + source.getInt('version_number'))
    e.app.save(draft)
    cloneSchemaToVersion(e.app, h, sourceId, draft.id)
  }

  h.writeAudit(e.app, {
    actor_type: 'staff',
    actor_staff: staff.id,
    action: 'form_draft_created',
    target_type: 'hk_form_versions',
    target_id: draft.id,
    metadata: { form_id: formId, from_version_id: sourceId },
    ...h.requestMeta(e),
  })

  const bundle = loadSchemaBundle(e.app, h, draft.id)
  return e.json(200, { schema: bundle.schema })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('PUT', '/api/hk/admin/forms/{formId}/versions/{versionId}/schema', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const staff = h.requireAdminAuth(e)
  const formId = e.request.pathValue('formId')
  const versionId = e.request.pathValue('versionId')
  ensureForm(e.app, h, formId)
  const version = e.app.findRecordById(h.COLLECTIONS.formVersions, versionId)
  if (version.getString('form') !== formId) throw new BadRequestError('版本與表單不符')
  if (version.getString('status') !== 'draft') throw new BadRequestError('僅草稿可儲存 schema')

  const body = e.requestInfo().body || {}
  writeSchemaToVersion(e.app, h, versionId, body.sections, body.rules)

  h.writeAudit(e.app, {
    actor_type: 'staff',
    actor_staff: staff.id,
    action: 'form_draft_saved',
    target_type: 'hk_form_versions',
    target_id: versionId,
    metadata: { form_id: formId },
    ...h.requestMeta(e),
  })

  const bundle = loadSchemaBundle(e.app, h, versionId)
  return e.json(200, { schema: bundle.schema, saved_at: new Date().toISOString() })
}, $apis.requireAuth('hk_staff_users'))

routerAdd('POST', '/api/hk/admin/forms/{formId}/versions/{versionId}/publish', (e) => {
  const h = require(`${__hooks}/hk_helpers.js`)
  const staff = h.requireAdminAuth(e)
  const formId = e.request.pathValue('formId')
  const versionId = e.request.pathValue('versionId')
  const form = ensureForm(e.app, h, formId)
  const version = e.app.findRecordById(h.COLLECTIONS.formVersions, versionId)
  if (version.getString('form') !== formId) throw new BadRequestError('版本與表單不符')
  if (version.getString('status') !== 'draft') throw new BadRequestError('僅草稿可發布')

  const bundle = loadSchemaBundle(e.app, h, versionId)
  if (!bundle.schema.sections.length) throw new BadRequestError('至少需要一個區塊')

  // retire previous published
  const previousId = form.getString('current_published_version')
  if (previousId && previousId !== versionId) {
    try {
      const previous = e.app.findRecordById(h.COLLECTIONS.formVersions, previousId)
      if (previous.getString('status') === 'published') {
        previous.set('status', 'retired')
        e.app.save(previous)
      }
    } catch (_) {}
  }

  version.set('status', 'published')
  version.set('published_at', new Date().toISOString())
  version.set('published_by', staff.id)
  e.app.save(version)

  form.set('current_published_version', version.id)
  e.app.save(form)

  h.writeAudit(e.app, {
    actor_type: 'staff',
    actor_staff: staff.id,
    action: 'form_version_published',
    target_type: 'hk_form_versions',
    target_id: versionId,
    metadata: { form_id: formId, version_number: version.getInt('version_number') },
    ...h.requestMeta(e),
  })

  const published = loadSchemaBundle(e.app, h, versionId)
  return e.json(200, { schema: published.schema })
}, $apis.requireAuth('hk_staff_users'))
