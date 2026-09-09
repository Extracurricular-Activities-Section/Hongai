/// <reference path="../pb_data/types.d.ts" />
/**
 * Policy / finance / counselor / FAQ collections (GREENFIELD hk_*).
 * Deny-by-default API rules — runtime access via service account + trusted CF routes.
 */
migrate(
  (app) => {
    const assertHk = (name) => {
      if (typeof name !== 'string' || !name.startsWith('hk_')) {
        throw new Error(`[hk] Refusing non-hk_ collection name: ${name}`)
      }
    }
    const exists = (name) => {
      assertHk(name)
      try {
        app.findCollectionByNameOrId(name)
        return true
      } catch {
        return false
      }
    }
    const createIfAbsent = (name, factory) => {
      assertHk(name)
      if (exists(name)) {
        console.log(`[hk] CONFLICT: "${name}" exists — skipped`)
        return null
      }
      const collection = factory()
      app.save(collection)
      console.log(`[hk] created ${name}`)
      return collection
    }
    const addFieldIfAbsent = (collectionName, fieldName, fieldDef) => {
      assertHk(collectionName)
      const col = app.findCollectionByNameOrId(collectionName)
      const found = col.fields.getByName(fieldName)
      if (found) return
      col.fields.add(new Field(fieldDef))
      app.save(col)
      console.log(`[hk] field ${collectionName}.${fieldName}`)
    }

    // --- Department contact enrichment ---
    if (exists('hk_departments')) {
      addFieldIfAbsent('hk_departments', 'location', {
        type: 'text',
        name: 'location',
        required: false,
      })
      addFieldIfAbsent('hk_departments', 'contact_name', {
        type: 'text',
        name: 'contact_name',
        required: false,
      })
      addFieldIfAbsent('hk_departments', 'contact_extension', {
        type: 'text',
        name: 'contact_extension',
        required: false,
      })
      addFieldIfAbsent('hk_departments', 'contact_phone', {
        type: 'text',
        name: 'contact_phone',
        required: false,
      })
    }

    // --- Staff form permissions ---
    if (exists('hk_staff_users')) {
      addFieldIfAbsent('hk_staff_users', 'can_manage_forms', {
        type: 'bool',
        name: 'can_manage_forms',
        required: false,
      })
      addFieldIfAbsent('hk_staff_users', 'can_publish_forms', {
        type: 'bool',
        name: 'can_publish_forms',
        required: false,
      })
    }

    // --- Follow-up ↔ disbursement link ---
    if (exists('hk_follow_up_tasks')) {
      addFieldIfAbsent('hk_follow_up_tasks', 'blocks_disbursement', {
        type: 'bool',
        name: 'blocks_disbursement',
        required: false,
      })
      addFieldIfAbsent('hk_follow_up_tasks', 'disbursement_milestone', {
        type: 'number',
        name: 'disbursement_milestone',
        required: false,
      })
    }

    createIfAbsent('hk_category_rules', () => {
      const categories = app.findCollectionByNameOrId('hk_application_categories')
      return new Collection({
        type: 'base',
        name: 'hk_category_rules',
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
          { name: 'academic_year', type: 'text', required: false },
          { name: 'effective_from', type: 'date', required: false },
          { name: 'effective_to', type: 'date', required: false },
          { name: 'version', type: 'number', required: true },
          { name: 'eligibility_json', type: 'json', required: false },
          { name: 'execution_json', type: 'json', required: false },
          { name: 'funding_json', type: 'json', required: false },
          { name: 'disbursement_json', type: 'json', required: false },
          { name: 'follow_up_json', type: 'json', required: false },
          { name: 'reward_json', type: 'json', required: false },
          { name: 'signature_json', type: 'json', required: false },
          { name: 'evidence_json', type: 'json', required: false },
          { name: 'needs_policy_confirmation', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: [
          'CREATE INDEX idx_hk_category_rules_category ON hk_category_rules (category)',
        ],
      })
    })

    createIfAbsent('hk_living_allowance_rules', () => {
      return new Collection({
        type: 'base',
        name: 'hk_living_allowance_rules',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'code', type: 'text', required: true },
          { name: 'label', type: 'text', required: true },
          { name: 'amount', type: 'number', required: false },
          { name: 'academic_year', type: 'text', required: false },
          { name: 'effective_from', type: 'date', required: false },
          { name: 'effective_to', type: 'date', required: false },
          { name: 'needs_policy_confirmation', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_living_allowance_code_year ON hk_living_allowance_rules (code, academic_year)'],
      })
    })

    createIfAbsent('hk_reward_rules', () => {
      const categories = app.findCollectionByNameOrId('hk_application_categories')
      return new Collection({
        type: 'base',
        name: 'hk_reward_rules',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'category',
            type: 'relation',
            required: false,
            collectionId: categories.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'code', type: 'text', required: true },
          { name: 'label', type: 'text', required: true },
          { name: 'amount_min', type: 'number', required: false },
          { name: 'amount_max', type: 'number', required: false },
          { name: 'rule_json', type: 'json', required: false },
          { name: 'academic_year', type: 'text', required: false },
          { name: 'needs_policy_confirmation', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_reward_rules_code ON hk_reward_rules (code)'],
      })
    })

    createIfAbsent('hk_rewards', () => {
      const apps = app.findCollectionByNameOrId('hk_applications')
      const students = app.findCollectionByNameOrId('hk_students')
      const staff = app.findCollectionByNameOrId('hk_staff_users')
      return new Collection({
        type: 'base',
        name: 'hk_rewards',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'application',
            type: 'relation',
            required: true,
            collectionId: apps.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'reward_type', type: 'text', required: true },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: [
            'draft', 'pending', 'approved', 'rejected', 'paid', 'cancelled',
          ]},
          { name: 'amount', type: 'number', required: false },
          { name: 'reason', type: 'text', required: false },
          { name: 'evidence_json', type: 'json', required: false },
          {
            name: 'approved_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'approved_at', type: 'date', required: false },
          { name: 'academic_year', type: 'text', required: false },
        ],
      })
    })

    createIfAbsent('hk_disbursement_plans', () => {
      const apps = app.findCollectionByNameOrId('hk_applications')
      return new Collection({
        type: 'base',
        name: 'hk_disbursement_plans',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'application',
            type: 'relation',
            required: true,
            collectionId: apps.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'total_approved', type: 'number', required: true },
          { name: 'currency', type: 'text', required: false },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: [
            'draft', 'active', 'completed', 'cancelled',
          ]},
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_disbursement_plans_app ON hk_disbursement_plans (application)',
        ],
      })
    })

    createIfAbsent('hk_disbursement_milestones', () => {
      const plans = app.findCollectionByNameOrId('hk_disbursement_plans')
      return new Collection({
        type: 'base',
        name: 'hk_disbursement_milestones',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'plan',
            type: 'relation',
            required: true,
            collectionId: plans.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'sequence', type: 'number', required: true },
          { name: 'label', type: 'text', required: true },
          { name: 'amount', type: 'number', required: true },
          { name: 'requires_follow_up', type: 'bool', required: false },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: [
            'pending', 'eligible', 'ready', 'submitted_for_payment', 'paid', 'failed', 'waived',
          ]},
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_disbursement_milestones_seq ON hk_disbursement_milestones (plan, sequence)',
        ],
      })
    })

    createIfAbsent('hk_disbursements', () => {
      const milestones = app.findCollectionByNameOrId('hk_disbursement_milestones')
      const staff = app.findCollectionByNameOrId('hk_staff_users')
      return new Collection({
        type: 'base',
        name: 'hk_disbursements',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'milestone',
            type: 'relation',
            required: true,
            collectionId: milestones.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'amount', type: 'number', required: true },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: [
            'eligible', 'ready', 'submitted_for_payment', 'paid', 'failed', 'returned',
          ]},
          { name: 'paid_at', type: 'date', required: false },
          {
            name: 'recorded_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'reference_no', type: 'text', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
      })
    })

    createIfAbsent('hk_counselors', () => {
      return new Collection({
        type: 'base',
        name: 'hk_counselors',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'academic_department', type: 'text', required: true },
          { name: 'email', type: 'email', required: false },
          { name: 'extension', type: 'text', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'effective_from', type: 'date', required: false },
          { name: 'effective_to', type: 'date', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
      })
    })

    createIfAbsent('hk_department_counselors', () => {
      const counselors = app.findCollectionByNameOrId('hk_counselors')
      return new Collection({
        type: 'base',
        name: 'hk_department_counselors',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'academic_department', type: 'text', required: true },
          {
            name: 'counselor',
            type: 'relation',
            required: true,
            collectionId: counselors.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'active', type: 'bool', required: false },
          { name: 'effective_from', type: 'date', required: false },
          { name: 'effective_to', type: 'date', required: false },
        ],
        indexes: [
          'CREATE INDEX idx_hk_department_counselors_dept ON hk_department_counselors (academic_department)',
        ],
      })
    })

    createIfAbsent('hk_faq_articles', () => {
      return new Collection({
        type: 'base',
        name: 'hk_faq_articles',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'slug', type: 'text', required: true },
          { name: 'title', type: 'text', required: true },
          { name: 'body', type: 'editor', required: true },
          { name: 'audience', type: 'select', required: true, maxSelect: 1, values: [
            'student', 'staff', 'both',
          ]},
          { name: 'sort_order', type: 'number', required: false },
          { name: 'published', type: 'bool', required: false },
          { name: 'updated_note', type: 'text', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_faq_slug ON hk_faq_articles (slug)'],
      })
    })

    // Academic-year policy row (minimum 2 categories / annual 150000)
    createIfAbsent('hk_academic_year_policies', () => {
      return new Collection({
        type: 'base',
        name: 'hk_academic_year_policies',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'academic_year', type: 'text', required: true },
          { name: 'minimum_categories', type: 'number', required: true },
          { name: 'annual_total_limit', type: 'number', required: true },
          { name: 'active', type: 'bool', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_academic_year_policies_year ON hk_academic_year_policies (academic_year)',
        ],
      })
    })
  },
  (app) => {
    void app
  },
)
