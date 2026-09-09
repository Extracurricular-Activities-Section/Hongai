/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 4: period student profiles, application categories, category entries + seed.
 * ONLY operates on had_* collections.
 */

migrate(
  (app) => {
    const assertHadName = (name) => {
      if (typeof name !== 'string' || !name.startsWith('had_')) {
        throw new Error(`[hong-ai-dream] Refusing non-had_ collection name: ${name}`)
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
        console.log(`[hong-ai-dream] CONFLICT: "${name}" exists — skipped`)
        return null
      }
      const collection = factory()
      app.save(collection)
      return collection
    }

    if (!exists('had_students') || !exists('had_application_periods')) {
      throw new Error('[hong-ai-dream] Phase 4 requires had_students and had_application_periods')
    }

    const students = app.findCollectionByNameOrId('had_students')
    const periods = app.findCollectionByNameOrId('had_application_periods')

    createIfAbsent('had_period_student_profiles', () => {
      return new Collection({
        type: 'base',
        name: 'had_period_student_profiles',
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
          { name: 'grade', type: 'text', required: false },
          { name: 'application_identity_types', type: 'json', required: true },
          { name: 'disability_level', type: 'text', required: false },
          { name: 'weak_aid_level', type: 'text', required: false },
          { name: 'has_applied_before', type: 'bool', required: false },
          { name: 'bank_account_registered', type: 'bool', required: false },
          { name: 'bank_account_note', type: 'text', required: false },
          { name: 'qualification_note', type: 'text', required: false },
          { name: 'confirmed_at', type: 'date', required: false },
          {
            name: 'source_period',
            type: 'relation',
            required: false,
            collectionId: periods.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'copied_from_previous', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_had_period_student_profiles_unique ON had_period_student_profiles (student, period)',
        ],
      })
    })

    createIfAbsent('had_application_categories', () => {
      return new Collection({
        type: 'base',
        name: 'had_application_categories',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'code', type: 'text', required: true },
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'allow_copy_previous', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_had_application_categories_code ON had_application_categories (code)',
        ],
      })
    })

    createIfAbsent('had_student_category_entries', () => {
      if (!exists('had_application_categories')) {
        throw new Error('[hong-ai-dream] had_student_category_entries requires categories')
      }
      const categories = app.findCollectionByNameOrId('had_application_categories')
      return new Collection({
        type: 'base',
        name: 'had_student_category_entries',
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
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['not_started', 'draft'],
          },
          { name: 'last_opened_at', type: 'date', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_had_student_category_entries_unique ON had_student_category_entries (student, period, category)',
        ],
      })
    })

    // Self-relation added after collection exists
    if (exists('had_student_category_entries')) {
      const entries = app.findCollectionByNameOrId('had_student_category_entries')
      let field = null
      try {
        field = entries.fields.getByName('copied_from_entry')
      } catch (_) {
        field = null
      }
      if (!field) {
        entries.fields.add(
          new Field({
            type: 'relation',
            name: 'copied_from_entry',
            required: false,
            collectionId: entries.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
        app.save(entries)
      }
    }

    if (exists('had_application_categories')) {
      const seeds = [
        { code: 'academic_learning', name: '課業學習', sort_order: 1, description: '課業學習相關補助申請' },
        { code: 'common_competency', name: '共通職能', sort_order: 2, description: '共通職能相關補助申請' },
        { code: 'language_certification', name: '外語檢定', sort_order: 3, description: '外語檢定相關補助申請' },
        { code: 'professional_certification', name: '專業證照', sort_order: 4, description: '專業證照相關補助申請' },
        { code: 'career_enhancement', name: '就業增能', sort_order: 5, description: '就業增能相關補助申請' },
        { code: 'external_competition', name: '校外競賽', sort_order: 6, description: '校外競賽相關補助申請' },
        { code: 'overseas_study', name: '海外研修', sort_order: 7, description: '海外研修相關補助申請' },
        { code: 'cross_domain_learning', name: '跨域學習', sort_order: 8, description: '跨域學習相關補助申請' },
        { code: 'other', name: '其他', sort_order: 9, description: '其他補助申請' },
      ]
      const col = app.findCollectionByNameOrId('had_application_categories')
      for (const seed of seeds) {
        try {
          app.findFirstRecordByData('had_application_categories', 'code', seed.code)
        } catch {
          const record = new Record(col)
          record.set('code', seed.code)
          record.set('name', seed.name)
          record.set('description', seed.description)
          record.set('active', true)
          record.set('sort_order', seed.sort_order)
          record.set('allow_copy_previous', true)
          app.save(record)
        }
      }
    }
  },
  (app) => {
    const names = [
      'had_student_category_entries',
      'had_application_categories',
      'had_period_student_profiles',
    ]
    for (const name of names) {
      if (!name.startsWith('had_')) continue
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // absent
      }
    }
  },
)
