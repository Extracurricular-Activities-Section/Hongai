/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 7: Application workflow, reviews, funding, assignments.
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

    const required = [
      'hk_students',
      'hk_application_periods',
      'hk_application_categories',
      'hk_form_submissions',
      'hk_form_submission_versions',
      'hk_pdf_documents',
      'hk_staff_users',
      'hk_departments',
    ]
    for (var i = 0; i < required.length; i++) {
      if (!exists(required[i])) {
        throw new Error('[hk] Phase 7 requires prior collections: ' + required[i])
      }
    }

    const students = app.findCollectionByNameOrId('hk_students')
    const periods = app.findCollectionByNameOrId('hk_application_periods')
    const categories = app.findCollectionByNameOrId('hk_application_categories')
    const submissions = app.findCollectionByNameOrId('hk_form_submissions')
    const submissionVersions = app.findCollectionByNameOrId('hk_form_submission_versions')
    const pdfDocuments = app.findCollectionByNameOrId('hk_pdf_documents')
    const staff = app.findCollectionByNameOrId('hk_staff_users')
    const departments = app.findCollectionByNameOrId('hk_departments')

    const APPLICATION_STATUSES = [
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
    ]

    const appsCol = createIfAbsent('hk_applications', () => {
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
            name: 'submission',
            type: 'relation',
            required: true,
            collectionId: submissions.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'submission_version',
            type: 'relation',
            required: true,
            collectionId: submissionVersions.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'pdf_document',
            type: 'relation',
            required: true,
            collectionId: pdfDocuments.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'application_number', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: APPLICATION_STATUSES,
          },
          { name: 'submitted_at', type: 'date', required: true },
          {
            name: 'current_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'current_department',
            type: 'relation',
            required: false,
            collectionId: departments.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'eligibility_status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pending', 'qualified', 'supplement_required', 'disqualified'],
          },
          { name: 'requested_amount', type: 'number', required: false },
          { name: 'approved_amount', type: 'number', required: false },
          { name: 'latest_reviewed_at', type: 'date', required: false },
          { name: 'closed_at', type: 'date', required: false },
          { name: 'edit_override_until', type: 'date', required: false },
          { name: 'supplement_message', type: 'text', required: false },
          { name: 'supplement_due_at', type: 'date', required: false },
          { name: 'return_reason', type: 'text', required: false },
          { name: 'reject_reason', type: 'text', required: false },
          { name: 'notification_pending', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_applications_number ON hk_applications (application_number)',
          'CREATE UNIQUE INDEX idx_hk_applications_student_period_category ON hk_applications (student, period, category)',
        ],
      })
    })

    const applications =
      appsCol || app.findCollectionByNameOrId('hk_applications')

    createIfAbsent('hk_application_status_history', () => {
      return new Collection({
        type: 'base',
        name: 'hk_application_status_history',
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
            collectionId: applications.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'from_status', type: 'text', required: false },
          { name: 'to_status', type: 'text', required: true },
          {
            name: 'changed_by_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['student', 'staff', 'admin', 'system'],
          },
          {
            name: 'changed_by_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'changed_by_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'reason', type: 'text', required: false },
          { name: 'metadata', type: 'json', required: false },
        ],
      })
    })

    createIfAbsent('hk_application_reviews', () => {
      return new Collection({
        type: 'base',
        name: 'hk_application_reviews',
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
            collectionId: applications.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'reviewer',
            type: 'relation',
            required: true,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'review_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['eligibility', 'content', 'final'],
          },
          {
            name: 'decision',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'approved',
              'supplement_required',
              'returned_for_edit',
              'rejected',
              'note_only',
              'qualified',
              'disqualified',
            ],
          },
          { name: 'comment', type: 'text', required: false },
          { name: 'internal_note', type: 'text', required: false },
          { name: 'student_message', type: 'text', required: false },
        ],
      })
    })

    createIfAbsent('hk_application_staff_assignments', () => {
      return new Collection({
        type: 'base',
        name: 'hk_application_staff_assignments',
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
            collectionId: applications.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'department',
            type: 'relation',
            required: false,
            collectionId: departments.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'assignment_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['primary', 'collaborator', 'viewer'],
          },
          { name: 'active', type: 'bool', required: false },
          {
            name: 'assigned_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
      })
    })

    createIfAbsent('hk_category_department_assignments', () => {
      return new Collection({
        type: 'base',
        name: 'hk_category_department_assignments',
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
          {
            name: 'department',
            type: 'relation',
            required: true,
            collectionId: departments.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'assignment_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['primary', 'collaborator'],
          },
          { name: 'active', type: 'bool', required: false },
        ],
      })
    })

    createIfAbsent('hk_supplement_requests', () => {
      return new Collection({
        type: 'base',
        name: 'hk_supplement_requests',
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
            collectionId: applications.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'requested_by',
            type: 'relation',
            required: true,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'message', type: 'text', required: true },
          { name: 'due_at', type: 'date', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pending', 'submitted', 'accepted', 'cancelled'],
          },
          { name: 'submitted_at', type: 'date', required: false },
          { name: 'resolved_at', type: 'date', required: false },
          { name: 'student_reply', type: 'text', required: false },
        ],
      })
    })

    const fundingDecisions = createIfAbsent('hk_funding_decisions', () => {
      return new Collection({
        type: 'base',
        name: 'hk_funding_decisions',
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
            collectionId: applications.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'decision_version', type: 'number', required: true },
          { name: 'requested_total', type: 'number', required: true },
          { name: 'approved_total', type: 'number', required: true },
          { name: 'decision_note', type: 'text', required: false },
          { name: 'internal_note', type: 'text', required: false },
          { name: 'student_message', type: 'text', required: false },
          { name: 'change_reason', type: 'text', required: false },
          {
            name: 'decided_by',
            type: 'relation',
            required: true,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'decided_at', type: 'date', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['draft', 'final', 'superseded', 'revoked'],
          },
        ],
      })
    })

    if (exists('hk_funding_decisions')) {
      const fundingDocs = app.findCollectionByNameOrId('hk_funding_decisions')
      var supersededField = null
      try {
        supersededField = fundingDocs.fields.getByName('superseded_by')
      } catch (_) {
        supersededField = null
      }
      if (!supersededField) {
        fundingDocs.fields.add(
          new Field({
            type: 'relation',
            name: 'superseded_by',
            required: false,
            collectionId: fundingDocs.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
        app.save(fundingDocs)
      }
    }

    const fundingCol = app.findCollectionByNameOrId('hk_funding_decisions')
    createIfAbsent('hk_funding_decision_items', () => {
      return new Collection({
        type: 'base',
        name: 'hk_funding_decision_items',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'funding_decision',
            type: 'relation',
            required: true,
            collectionId: fundingCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'item_code', type: 'text', required: true },
          { name: 'item_label', type: 'text', required: true },
          { name: 'requested_amount', type: 'number', required: true },
          { name: 'approved_amount', type: 'number', required: true },
          { name: 'note', type: 'text', required: false },
          { name: 'sort_order', type: 'number', required: false },
        ],
      })
    })

    createIfAbsent('hk_funding_rules', () => {
      return new Collection({
        type: 'base',
        name: 'hk_funding_rules',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'period',
            type: 'relation',
            required: false,
            collectionId: periods.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'academic_year', type: 'number', required: false },
          {
            name: 'rule_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['annual_total_limit', 'category_limit'],
          },
          {
            name: 'category',
            type: 'relation',
            required: false,
            collectionId: categories.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'limit_amount', type: 'number', required: false },
          { name: 'warning_only', type: 'bool', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'note', type: 'text', required: false },
        ],
      })
    })
  },
  (app) => {
    const names = [
      'hk_funding_rules',
      'hk_funding_decision_items',
      'hk_funding_decisions',
      'hk_supplement_requests',
      'hk_category_department_assignments',
      'hk_application_staff_assignments',
      'hk_application_reviews',
      'hk_application_status_history',
      'hk_applications',
    ]
    for (var i = 0; i < names.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(names[i])
        app.delete(col)
      } catch (_) {}
    }
  },
)
