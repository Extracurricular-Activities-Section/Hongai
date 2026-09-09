/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 5: Dynamic Form Engine collections + 9 form V1 seeds.
 * ONLY operates on hk_* collections.
 */

migrate(
  (app) => {
    const assertHadName = (name) => {
      if (typeof name !== 'string' || !name.startsWith('hk_')) {
        throw new Error(`[hk] Refusing non-hk_ collection name: ${name}`)
      }
    }

    const exists = (name) => {
      assertHadName(name)
      try {
        app.findCollectionByNameOrId(name)
        return true
      } catch {
        return false
      }
    }

    const createIfAbsent = (name, factory) => {
      assertHadName(name)
      if (exists(name)) {
        console.log(`[hk] CONFLICT: "${name}" exists — skipped`)
        return null
      }
      const collection = factory()
      app.save(collection)
      return collection
    }

    if (
      !exists('hk_students') ||
      !exists('hk_application_categories') ||
      !exists('hk_application_periods') ||
      !exists('hk_student_category_entries') ||
      !exists('hk_staff_users')
    ) {
      throw new Error('[hk] Phase 5 requires Phase 3/4 collections')
    }

    const students = app.findCollectionByNameOrId('hk_students')
    const categories = app.findCollectionByNameOrId('hk_application_categories')
    const periods = app.findCollectionByNameOrId('hk_application_periods')
    const entries = app.findCollectionByNameOrId('hk_student_category_entries')
    const staff = app.findCollectionByNameOrId('hk_staff_users')

    const fieldTypes = [
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
      'repeat_group',
      'monthly_plan',
      'computed',
      'display',
      'url',
      'email',
      'file',
    ]

    createIfAbsent('hk_forms', () => {
      return new Collection({
        type: 'base',
        name: 'hk_forms',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'category',
            type: 'relation',
            required: true,
            collectionId: categories.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          { name: 'active', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_forms_category ON hk_forms (category)',
        ],
      })
    })

    const forms = app.findCollectionByNameOrId('hk_forms')

    createIfAbsent('hk_form_versions', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_versions',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'form',
            type: 'relation',
            required: true,
            collectionId: forms.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'version_number', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['draft', 'published', 'retired'],
          },
          { name: 'published_at', type: 'date', required: false },
          {
            name: 'published_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'schema_hash', type: 'text', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_form_versions_unique ON hk_form_versions (form, version_number)',
        ],
      })
    })

    const versions = app.findCollectionByNameOrId('hk_form_versions')

    // Add current_published_version to hk_forms if missing
    {
      let field = null
      try {
        field = forms.fields.getByName('current_published_version')
      } catch (_) {
        field = null
      }
      if (!field) {
        forms.fields.add(
          new Field({
            type: 'relation',
            name: 'current_published_version',
            required: false,
            collectionId: versions.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
        app.save(forms)
      }
    }

    createIfAbsent('hk_form_sections', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_sections',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'form_version',
            type: 'relation',
            required: true,
            collectionId: versions.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'code', type: 'text', required: true },
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'visible', type: 'bool', required: false },
          { name: 'pdf_visible', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_form_sections_code ON hk_form_sections (form_version, code)',
        ],
      })
    })

    const sections = app.findCollectionByNameOrId('hk_form_sections')

    createIfAbsent('hk_form_fields', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_fields',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'section',
            type: 'relation',
            required: true,
            collectionId: sections.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'code', type: 'text', required: true },
          { name: 'label', type: 'text', required: true },
          {
            name: 'field_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: fieldTypes,
          },
          { name: 'help_text', type: 'text', required: false },
          { name: 'placeholder', type: 'text', required: false },
          { name: 'required', type: 'bool', required: false },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'default_value', type: 'json', required: false },
          { name: 'validation', type: 'json', required: false },
          { name: 'config', type: 'json', required: false },
          { name: 'pdf_visible', type: 'bool', required: false },
          { name: 'copy_previous', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
        ],
      })
    })

    const fields = app.findCollectionByNameOrId('hk_form_fields')

    createIfAbsent('hk_form_field_options', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_field_options',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'field',
            type: 'relation',
            required: true,
            collectionId: fields.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'value', type: 'text', required: true },
          { name: 'label', type: 'text', required: true },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'active', type: 'bool', required: false },
        ],
      })
    })

    createIfAbsent('hk_form_rules', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_rules',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'form_version',
            type: 'relation',
            required: true,
            collectionId: versions.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'field',
            type: 'relation',
            required: true,
            collectionId: fields.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'rule_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['show_if', 'hide_if', 'require_if'],
          },
          { name: 'source_field_code', type: 'text', required: true },
          {
            name: 'operator',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'equals',
              'not_equals',
              'contains',
              'not_contains',
              'is_true',
              'is_false',
              'is_empty',
              'is_not_empty',
            ],
          },
          { name: 'value', type: 'json', required: false },
          { name: 'config', type: 'json', required: false },
          { name: 'sort_order', type: 'number', required: false },
        ],
      })
    })

    createIfAbsent('hk_form_submissions', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_submissions',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'period',
            type: 'relation',
            required: true,
            collectionId: periods.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'category',
            type: 'relation',
            required: true,
            collectionId: categories.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'category_entry',
            type: 'relation',
            required: true,
            collectionId: entries.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'form',
            type: 'relation',
            required: true,
            collectionId: forms.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'form_version',
            type: 'relation',
            required: true,
            collectionId: versions.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['draft', 'completed'],
          },
          { name: 'current_version_number', type: 'number', required: false },
          { name: 'last_saved_at', type: 'date', required: false },
          { name: 'completed_at', type: 'date', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_form_submissions_unique ON hk_form_submissions (student, period, category)',
        ],
      })
    })

    const submissions = app.findCollectionByNameOrId('hk_form_submissions')

    // self relation copied_from_submission
    {
      let field = null
      try {
        field = submissions.fields.getByName('copied_from_submission')
      } catch (_) {
        field = null
      }
      if (!field) {
        submissions.fields.add(
          new Field({
            type: 'relation',
            name: 'copied_from_submission',
            required: false,
            collectionId: submissions.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
        app.save(submissions)
      }
    }

    createIfAbsent('hk_form_submission_versions', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_submission_versions',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'submission',
            type: 'relation',
            required: true,
            collectionId: submissions.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'version_number', type: 'number', required: true },
          { name: 'snapshot', type: 'json', required: true },
          {
            name: 'reason',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'autosave_snapshot',
              'manual_save',
              'completed',
              'copied',
              'other',
            ],
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_form_submission_versions_unique ON hk_form_submission_versions (submission, version_number)',
        ],
      })
    })

    createIfAbsent('hk_form_answers', () => {
      return new Collection({
        type: 'base',
        name: 'hk_form_answers',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'submission',
            type: 'relation',
            required: true,
            collectionId: submissions.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'field',
            type: 'relation',
            required: true,
            collectionId: fields.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'field_code', type: 'text', required: true },
          { name: 'value', type: 'json', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_form_answers_unique ON hk_form_answers (submission, field_code)',
        ],
      })
    })

    // Seed 9 forms V1
    const seed = require(`${__hooks}/hk_form_seed.js`)
    seed.ensureFormSeeds(app)
  },
  (app) => {
    const names = [
      'hk_form_answers',
      'hk_form_submission_versions',
      'hk_form_submissions',
      'hk_form_rules',
      'hk_form_field_options',
      'hk_form_fields',
      'hk_form_sections',
      'hk_form_versions',
      'hk_forms',
    ]
    for (const name of names) {
      if (!name.startsWith('hk_')) continue
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // absent
      }
    }
  },
)
