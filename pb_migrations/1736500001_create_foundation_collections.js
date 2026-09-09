/// <reference path="../pb_data/types.d.ts" />
/**
 * HAD foundation collections (Hong Ai Dream).
 *
 * ALL collections use the `had_` prefix to isolate from other systems
 * sharing the same PocketBase instance (e.g. production `students`).
 *
 * This migration MUST ONLY create/alter/delete `had_*` collections.
 * Never touch: students, users, teachers, or any non-had_ collection.
 *
 * Security defaults remain deny-by-default except minimal ownership rules
 * documented in docs/DATABASE-SCHEMA.md (Phase 3).
 */

migrate(
  (app) => {
    const created = []
    const conflicts = []

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
        conflicts.push(name)
        console.log(
          `[hong-ai-dream] CONFLICT: "${name}" already exists — skipped (no overwrite).`,
        )
        return null
      }
      const collection = factory()
      app.save(collection)
      created.push(name)
      return collection
    }

    // 1) had_staff_users (auth)
    createIfAbsent('had_staff_users', () => {
      return new Collection({
        type: 'auth',
        name: 'had_staff_users',
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

    // 2) had_departments
    createIfAbsent('had_departments', () => {
      return new Collection({
        type: 'base',
        name: 'had_departments',
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
        indexes: ['CREATE UNIQUE INDEX idx_had_departments_code ON had_departments (code)'],
      })
    })

    // 3) had_staff_departments
    createIfAbsent('had_staff_departments', () => {
      if (!exists('had_staff_users') || !exists('had_departments')) {
        throw new Error('[hong-ai-dream] had_staff_departments requires had_staff_users + had_departments')
      }
      const staffUsers = app.findCollectionByNameOrId('had_staff_users')
      const departments = app.findCollectionByNameOrId('had_departments')
      return new Collection({
        type: 'base',
        name: 'had_staff_departments',
        listRule: '@request.auth.collectionName = "had_staff_users"',
        viewRule: '@request.auth.collectionName = "had_staff_users"',
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
          'CREATE UNIQUE INDEX idx_had_staff_departments_unique ON had_staff_departments (staff, department)',
        ],
      })
    })

    // 4) had_students (AUTH) — identity_number lives on profile, not here
    createIfAbsent('had_students', () => {
      return new Collection({
        type: 'auth',
        name: 'had_students',
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
        indexes: ['CREATE UNIQUE INDEX idx_had_students_student_no ON had_students (student_no)'],
      })
    })

    // 5) had_student_profiles
    createIfAbsent('had_student_profiles', () => {
      if (!exists('had_students')) {
        throw new Error('[hong-ai-dream] had_student_profiles requires had_students')
      }
      const students = app.findCollectionByNameOrId('had_students')
      return new Collection({
        type: 'base',
        name: 'had_student_profiles',
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
          'CREATE UNIQUE INDEX idx_had_student_profiles_student ON had_student_profiles (student)',
        ],
      })
    })

    // 6) had_application_periods — still locked (Phase 4)
    createIfAbsent('had_application_periods', () => {
      return new Collection({
        type: 'base',
        name: 'had_application_periods',
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

    // 7) had_identity_reset_requests
    createIfAbsent('had_identity_reset_requests', () => {
      const staffUsers = app.findCollectionByNameOrId('had_staff_users')
      const students = app.findCollectionByNameOrId('had_students')
      return new Collection({
        type: 'base',
        name: 'had_identity_reset_requests',
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

    // 8) had_audit_logs
    createIfAbsent('had_audit_logs', () => {
      const staffUsers = app.findCollectionByNameOrId('had_staff_users')
      const students = app.findCollectionByNameOrId('had_students')
      return new Collection({
        type: 'base',
        name: 'had_audit_logs',
        listRule: '@request.auth.collectionName = "had_staff_users" && @request.auth.is_admin = true',
        viewRule: '@request.auth.collectionName = "had_staff_users" && @request.auth.is_admin = true',
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
      console.log(`[hong-ai-dream] Conflicts (skipped): ${conflicts.join(', ')}`)
    }
    console.log(`[hong-ai-dream] Created: ${created.join(', ') || '(none)'}`)
  },
  (app) => {
    const names = [
      'had_audit_logs',
      'had_identity_reset_requests',
      'had_application_periods',
      'had_student_profiles',
      'had_students',
      'had_staff_departments',
      'had_departments',
      'had_staff_users',
    ]

    for (const name of names) {
      if (!name.startsWith('had_')) {
        throw new Error(`[hong-ai-dream] Rollback refused non-had_ name: ${name}`)
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
