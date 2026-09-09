/// <reference path="../pb_data/types.d.ts" />
/**
 * HAD foundation collections (Hong Ai Dream).
 *
 * ALL collections use the `hk_` prefix to isolate from other systems
 * sharing the same PocketBase instance (e.g. production `students`).
 *
 * This migration MUST ONLY create/alter/delete `hk_*` collections.
 * Never touch: students, users, teachers, or any non-hk_ collection.
 *
 * Security defaults remain deny-by-default except minimal ownership rules
 * documented in docs/DATABASE-SCHEMA.md (Phase 3).
 */

migrate(
  (app) => {
    const created = []
    const conflicts = []

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
        conflicts.push(name)
        console.log(
          `[hk] CONFLICT: "${name}" already exists — skipped (no overwrite).`,
        )
        return null
      }
      const collection = factory()
      app.save(collection)
      created.push(name)
      return collection
    }

    // 1) hk_staff_users (auth)
    createIfAbsent('hk_staff_users', () => {
      return new Collection({
        type: 'auth',
        name: 'hk_staff_users',
        listRule: null,
        viewRule: 'id = @request.auth.id',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        authRule: 'active = true && (is_staff = true || is_admin = true)',
        passwordAuth: {
          enabled: true,
          identityFields: ['email'],
        },
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'is_staff', type: 'bool', required: false },
          { name: 'is_admin', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'phone', type: 'text', required: false },
          { name: 'job_title', type: 'text', required: false },
          { name: 'last_login_at', type: 'date', required: false },
          { name: 'notes', type: 'text', required: false },
        ],
      })
    })

    // 2) hk_departments
    createIfAbsent('hk_departments', () => {
      return new Collection({
        type: 'base',
        name: 'hk_departments',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'code', type: 'text', required: true },
          { name: 'active', type: 'bool', required: false },
          { name: 'description', type: 'text', required: false },
          { name: 'sort_order', type: 'number', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_departments_code ON hk_departments (code)'],
      })
    })

    // 3) hk_staff_departments
    createIfAbsent('hk_staff_departments', () => {
      if (!exists('hk_staff_users') || !exists('hk_departments')) {
        throw new Error('[hk] hk_staff_departments requires hk_staff_users + hk_departments')
      }
      const staffUsers = app.findCollectionByNameOrId('hk_staff_users')
      const departments = app.findCollectionByNameOrId('hk_departments')
      return new Collection({
        type: 'base',
        name: 'hk_staff_departments',
        listRule: '@request.auth.collectionName = "hk_staff_users"',
        viewRule: '@request.auth.collectionName = "hk_staff_users"',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'staff',
            type: 'relation',
            required: true,
            collectionId: staffUsers.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'department',
            type: 'relation',
            required: true,
            collectionId: departments.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'is_primary', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_staff_departments_unique ON hk_staff_departments (staff, department)',
        ],
      })
    })

    // 4) hk_students (AUTH) — identity_number lives on profile, not here
    createIfAbsent('hk_students', () => {
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
          { name: 'active', type: 'bool', required: false },
          { name: 'locked_until', type: 'date', required: false },
          { name: 'failed_login_count', type: 'number', required: false },
          { name: 'last_login_at', type: 'date', required: false },
          { name: 'registered_at', type: 'date', required: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_hk_students_student_no ON hk_students (student_no)'],
      })
    })

    // 5) hk_student_profiles
    createIfAbsent('hk_student_profiles', () => {
      if (!exists('hk_students')) {
        throw new Error('[hk] hk_student_profiles requires hk_students')
      }
      const students = app.findCollectionByNameOrId('hk_students')
      return new Collection({
        type: 'base',
        name: 'hk_student_profiles',
        // No list for students (prevent enumeration). View own only.
        // Updates go through trusted custom route (field allowlist).
        listRule: null,
        viewRule: 'student = @request.auth.id',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: students.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'identity_number', type: 'text', required: true },
          {
            name: 'gender',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['male', 'female', 'other'],
          },
          { name: 'department_name', type: 'text', required: true },
          { name: 'program_type', type: 'text', required: false },
          { name: 'division', type: 'text', required: false },
          { name: 'grade', type: 'text', required: true },
          { name: 'phone', type: 'text', required: true },
          { name: 'line_id', type: 'text', required: false },
          { name: 'email', type: 'email', required: true },
          { name: 'bank_account_registered', type: 'bool', required: false },
          { name: 'bank_account_note', type: 'text', required: false },
          { name: 'updated_by_student_at', type: 'date', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_student_profiles_student ON hk_student_profiles (student)',
        ],
      })
    })

    // 6) hk_application_periods — still locked (Phase 4)
    createIfAbsent('hk_application_periods', () => {
      return new Collection({
        type: 'base',
        name: 'hk_application_periods',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'academic_year', type: 'number', required: true },
          {
            name: 'semester',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['1', '2'],
          },
          { name: 'start_at', type: 'date', required: true },
          { name: 'end_at', type: 'date', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['draft', 'scheduled', 'open', 'closed', 'archived'],
          },
          { name: 'active', type: 'bool', required: false },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'description', type: 'text', required: false },
          { name: 'min_application_count', type: 'number', required: false },
          {
            name: 'min_application_rule',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['warning_only', 'enforced'],
          },
        ],
      })
    })

    // 7) hk_identity_reset_requests
    createIfAbsent('hk_identity_reset_requests', () => {
      const staffUsers = app.findCollectionByNameOrId('hk_staff_users')
      const students = app.findCollectionByNameOrId('hk_students')
      return new Collection({
        type: 'base',
        name: 'hk_identity_reset_requests',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'student_no', type: 'text', required: true },
          { name: 'name', type: 'text', required: true },
          { name: 'email', type: 'email', required: true },
          { name: 'phone', type: 'text', required: true },
          { name: 'reason', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pending', 'processing', 'approved', 'rejected', 'closed'],
          },
          {
            name: 'resolved_by',
            type: 'relation',
            required: false,
            collectionId: staffUsers.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'resolved_at', type: 'date', required: false },
          { name: 'resolution_note', type: 'text', required: false },
          {
            name: 'created_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
      })
    })

    // 8) hk_audit_logs
    createIfAbsent('hk_audit_logs', () => {
      const staffUsers = app.findCollectionByNameOrId('hk_staff_users')
      const students = app.findCollectionByNameOrId('hk_students')
      return new Collection({
        type: 'base',
        name: 'hk_audit_logs',
        listRule: '@request.auth.collectionName = "hk_staff_users" && @request.auth.is_admin = true',
        viewRule: '@request.auth.collectionName = "hk_staff_users" && @request.auth.is_admin = true',
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'actor_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['student', 'staff', 'admin', 'system'],
          },
          {
            name: 'actor_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'actor_staff',
            type: 'relation',
            required: false,
            collectionId: staffUsers.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'action', type: 'text', required: true },
          { name: 'target_type', type: 'text', required: false },
          { name: 'target_id', type: 'text', required: false },
          { name: 'ip', type: 'text', required: false },
          { name: 'user_agent', type: 'text', required: false },
          { name: 'metadata', type: 'json', required: false },
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
      'hk_audit_logs',
      'hk_identity_reset_requests',
      'hk_application_periods',
      'hk_student_profiles',
      'hk_students',
      'hk_staff_departments',
      'hk_departments',
      'hk_staff_users',
    ]

    for (const name of names) {
      if (!name.startsWith('hk_')) {
        throw new Error(`[hk] Rollback refused non-hk_ name: ${name}`)
      }
      try {
        const collection = app.findCollectionByNameOrId(name)
        app.delete(collection)
      } catch {
        // absent
      }
    }
  },
)
