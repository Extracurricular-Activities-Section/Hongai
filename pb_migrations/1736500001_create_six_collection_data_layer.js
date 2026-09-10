/// <reference path="../pb_data/types.d.ts" />
/**
 * Greenfield six-collection PocketBase data layer.
 *
 * Canonical runtime:
 * Browser -> Cloudflare Worker /api/hk/* -> PocketBase Data API
 *
 * PocketBase is only the persistence layer. Do not deploy pb_hooks for Hongai
 * business logic, and do not recreate the old 50+ collection normalized model.
 */

migrate(
  (app) => {
    const created = []
    const conflicts = []

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
        conflicts.push(name)
        console.log(`[hk] CONFLICT: "${name}" already exists - skipped.`)
        return null
      }
      const collection = factory()
      app.save(collection)
      created.push(name)
      return collection
    }

    const staffUsers = createIfAbsent('hk_staff_users', () => {
      return new Collection({
        type: 'auth',
        name: 'hk_staff_users',
        listRule: null,
        viewRule: 'id = @request.auth.id',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        authRule: 'active = true',
        passwordAuth: {
          enabled: true,
          identityFields: ['email'],
        },
        fields: [
          { name: 'name', type: 'text', required: true },
          {
            name: 'role',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['staff', 'admin', 'super_admin', 'service'],
          },
          { name: 'is_staff', type: 'bool', required: false },
          { name: 'is_admin', type: 'bool', required: false },
          { name: 'department_code', type: 'text', required: false },
          { name: 'department_name', type: 'text', required: false },
          { name: 'department_contact_json', type: 'json', required: false },
          { name: 'departments_json', type: 'json', required: false },
          { name: 'permissions_json', type: 'json', required: false },
          { name: 'can_manage_forms', type: 'bool', required: false },
          { name: 'can_publish_forms', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'phone', type: 'text', required: false },
          { name: 'job_title', type: 'text', required: false },
          { name: 'last_login_at', type: 'date', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
      })
    })

    const students = createIfAbsent('hk_students', () => {
      return new Collection({
        type: 'auth',
        name: 'hk_students',
        listRule: null,
        viewRule: 'id = @request.auth.id',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        authRule: 'active = true',
        passwordAuth: {
          enabled: true,
          identityFields: ['email'],
        },
        fields: [
          { name: 'student_no', type: 'text', required: true },
          { name: 'identity_last4', type: 'text', required: true, min: 4, max: 4 },
          { name: 'identity_hash', type: 'text', required: false },
          { name: 'identity_encrypted', type: 'text', required: false },
          { name: 'name', type: 'text', required: true },
          {
            name: 'gender',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['male', 'female', 'other'],
          },
          { name: 'department_name', type: 'text', required: false },
          { name: 'program_type', type: 'text', required: false },
          { name: 'division', type: 'text', required: false },
          { name: 'grade', type: 'text', required: false },
          { name: 'phone', type: 'text', required: false },
          { name: 'line_id', type: 'text', required: false },
          { name: 'bank_account_registered', type: 'bool', required: false },
          { name: 'bank_account_note', type: 'text', required: false },
          { name: 'profile_json', type: 'json', required: false },
          { name: 'notification_preferences_json', type: 'json', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'locked_until', type: 'date', required: false },
          { name: 'failed_login_count', type: 'number', required: false },
          { name: 'last_login_at', type: 'date', required: false },
          { name: 'registered_at', type: 'date', required: false },
          { name: 'updated_by_student_at', type: 'date', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_students_student_no ON hk_students (student_no)'],
      })
    })

    const staff =
      staffUsers || app.findCollectionByNameOrId('hk_staff_users')
    const studentCol = students || app.findCollectionByNameOrId('hk_students')

    const forms = createIfAbsent('hk_forms', () => {
      return new Collection({
        type: 'base',
        name: 'hk_forms',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'form_code', type: 'text', required: true },
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          { name: 'category_code', type: 'text', required: false },
          { name: 'category_name', type: 'text', required: false },
          { name: 'category_json', type: 'json', required: false },
          { name: 'version', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['draft', 'published', 'retired'],
          },
          { name: 'schema_json', type: 'json', required: true },
          { name: 'schema_hash', type: 'text', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'published_at', type: 'date', required: false },
          {
            name: 'published_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_forms_code_version ON hk_forms (form_code, version)',
          'CREATE INDEX idx_hk_forms_category ON hk_forms (category_code)',
        ],
      })
    })

    const formCol = forms || app.findCollectionByNameOrId('hk_forms')

    createIfAbsent('hk_applications', () => {
      return new Collection({
        type: 'base',
        name: 'hk_applications',
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
            collectionId: studentCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'form',
            type: 'relation',
            required: true,
            collectionId: formCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'application_number', type: 'text', required: true },
          { name: 'period_key', type: 'text', required: false },
          { name: 'period_json', type: 'json', required: false },
          { name: 'category_code', type: 'text', required: false },
          { name: 'category_name', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'draft',
              'submitted',
              'eligibility_review',
              'under_review',
              'supplement_required',
              'returned_for_edit',
              'approved',
              'rejected',
              'funding_pending',
              'funding_decided',
              'closed',
            ],
          },
          {
            name: 'eligibility_status',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['pending', 'qualified', 'supplement_required', 'disqualified'],
          },
          { name: 'answers_json', type: 'json', required: false },
          { name: 'submission_snapshot_json', type: 'json', required: false },
          { name: 'workflow_json', type: 'json', required: false },
          { name: 'tasks_json', type: 'json', required: false },
          { name: 'funding_json', type: 'json', required: false },
          { name: 'payments_json', type: 'json', required: false },
          { name: 'files_json', type: 'json', required: false },
          {
            name: 'files',
            type: 'file',
            required: false,
            maxSelect: 50,
            maxSize: 20971520,
            mimeTypes: [
              'application/pdf',
              'image/jpeg',
              'image/png',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
          },
          {
            name: 'current_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'current_department_json', type: 'json', required: false },
          { name: 'requested_amount', type: 'number', required: false },
          { name: 'approved_amount', type: 'number', required: false },
          { name: 'submitted_at', type: 'date', required: false },
          { name: 'latest_reviewed_at', type: 'date', required: false },
          { name: 'closed_at', type: 'date', required: false },
          { name: 'edit_override_until', type: 'date', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_applications_number ON hk_applications (application_number)',
          'CREATE INDEX idx_hk_applications_student ON hk_applications (student)',
          'CREATE INDEX idx_hk_applications_period_category ON hk_applications (period_key, category_code)',
        ],
      })
    })

    createIfAbsent('hk_settings', () => {
      return new Collection({
        type: 'base',
        name: 'hk_settings',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'key', type: 'text', required: true },
          {
            name: 'setting_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'period',
              'category',
              'policy',
              'notification_template',
              'system',
              'faq',
              'counselor',
            ],
          },
          { name: 'value_json', type: 'json', required: true },
          { name: 'version', type: 'number', required: false },
          {
            name: 'status',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['draft', 'active', 'archived'],
          },
          { name: 'active', type: 'bool', required: false },
          {
            name: 'updated_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'notes', type: 'text', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_settings_key ON hk_settings (key)'],
      })
    })

    createIfAbsent('hk_events', () => {
      return new Collection({
        type: 'base',
        name: 'hk_events',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'event_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'notification',
              'email_log',
              'audit',
              'system',
              'auth',
              'application',
              'scheduler',
            ],
          },
          { name: 'event_key', type: 'text', required: false },
          {
            name: 'actor_student',
            type: 'relation',
            required: false,
            collectionId: studentCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'actor_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'target_type', type: 'text', required: false },
          { name: 'target_id', type: 'text', required: false },
          { name: 'recipient_json', type: 'json', required: false },
          { name: 'payload_json', type: 'json', required: false },
          { name: 'status', type: 'text', required: false },
          { name: 'occurred_at', type: 'date', required: false },
          { name: 'ip', type: 'text', required: false },
          { name: 'user_agent', type: 'text', required: false },
        ],
        indexes: [
          'CREATE INDEX idx_hk_events_type_target ON hk_events (event_type, target_type, target_id)',
          'CREATE INDEX idx_hk_events_key ON hk_events (event_key)',
        ],
      })
    })

    if (conflicts.length > 0) {
      console.log(`[hk] Conflicts (skipped): ${conflicts.join(', ')}`)
    }
    console.log(`[hk] Created: ${created.join(', ') || '(none)'}`)
  },
  (app) => {
    const names = [
      'hk_events',
      'hk_settings',
      'hk_applications',
      'hk_forms',
      'hk_students',
      'hk_staff_users',
    ]

    for (const name of names) {
      if (!name.startsWith('hk_')) {
        throw new Error(`[hk] Rollback refused non-hk_ name: ${name}`)
      }
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // absent
      }
    }
  },
)
