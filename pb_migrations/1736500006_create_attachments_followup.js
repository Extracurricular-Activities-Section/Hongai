/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 8: Attachments, signed documents, supplements, follow-up tasks.
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

    const addFieldIfAbsent = (collectionName, fieldName, fieldDef) => {
      const col = app.findCollectionByNameOrId(collectionName)
      var existing = null
      try {
        existing = col.fields.getByName(fieldName)
      } catch (_) {
        existing = null
      }
      if (existing) return
      col.fields.add(new Field(fieldDef))
      app.save(col)
    }

    const required = [
      'hk_students',
      'hk_applications',
      'hk_form_submissions',
      'hk_supplement_requests',
      'hk_pdf_documents',
      'hk_staff_users',
      'hk_application_categories',
    ]
    for (var i = 0; i < required.length; i++) {
      if (!exists(required[i])) {
        throw new Error('[hk] Phase 8 requires: ' + required[i])
      }
    }

    const students = app.findCollectionByNameOrId('hk_students')
    const applications = app.findCollectionByNameOrId('hk_applications')
    const submissions = app.findCollectionByNameOrId('hk_form_submissions')
    const supplementRequests = app.findCollectionByNameOrId('hk_supplement_requests')
    const pdfDocuments = app.findCollectionByNameOrId('hk_pdf_documents')
    const staff = app.findCollectionByNameOrId('hk_staff_users')
    const categories = app.findCollectionByNameOrId('hk_application_categories')

    createIfAbsent('hk_follow_up_task_templates', () => {
      return new Collection({
        type: 'base',
        name: 'hk_follow_up_task_templates',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'code', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          {
            name: 'task_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'file_upload',
              'text',
              'file_and_text',
              'event_attendance',
              'confirmation',
              'other',
            ],
          },
          { name: 'allowed_extensions', type: 'json', required: false },
          { name: 'max_files', type: 'number', required: false },
          { name: 'max_file_size_mb', type: 'number', required: false },
          { name: 'requires_review', type: 'bool', required: false },
          { name: 'required', type: 'bool', required: false },
          { name: 'default_due_offset_days', type: 'number', required: false },
          { name: 'active', type: 'bool', required: false },
          { name: 'student_instructions', type: 'text', required: false },
          { name: 'review_instructions', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_follow_up_task_templates_code ON hk_follow_up_task_templates (code)',
        ],
      })
    })

    const templates = app.findCollectionByNameOrId('hk_follow_up_task_templates')

    createIfAbsent('hk_category_follow_up_templates', () => {
      return new Collection({
        type: 'base',
        name: 'hk_category_follow_up_templates',
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
            name: 'task_template',
            type: 'relation',
            required: true,
            collectionId: templates.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'required', type: 'bool', required: false },
          { name: 'requires_review_override', type: 'bool', required: false },
          { name: 'due_rule', type: 'json', required: false },
          { name: 'sort_order', type: 'number', required: false },
          { name: 'active', type: 'bool', required: false },
        ],
      })
    })

    createIfAbsent('hk_follow_up_tasks', () => {
      return new Collection({
        type: 'base',
        name: 'hk_follow_up_tasks',
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
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'template',
            type: 'relation',
            required: false,
            collectionId: templates.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          {
            name: 'task_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'file_upload',
              'text',
              'file_and_text',
              'event_attendance',
              'confirmation',
              'other',
            ],
          },
          { name: 'description', type: 'text', required: false },
          { name: 'required', type: 'bool', required: false },
          { name: 'requires_review', type: 'bool', required: false },
          { name: 'due_at', type: 'date', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'pending',
              'submitted',
              'under_review',
              'supplement_required',
              'approved',
              'rejected',
              'waived',
            ],
          },
          { name: 'completed_at', type: 'date', required: false },
          {
            name: 'created_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'allowed_extensions', type: 'json', required: false },
          { name: 'max_files', type: 'number', required: false },
          { name: 'max_file_size_mb', type: 'number', required: false },
          { name: 'student_instructions', type: 'text', required: false },
          { name: 'event_start_at', type: 'date', required: false },
          { name: 'event_end_at', type: 'date', required: false },
          { name: 'event_location', type: 'text', required: false },
          { name: 'event_note', type: 'text', required: false },
          { name: 'allow_resubmit', type: 'bool', required: false },
          { name: 'waive_reason', type: 'text', required: false },
        ],
      })
    })

    const tasks = app.findCollectionByNameOrId('hk_follow_up_tasks')

    createIfAbsent('hk_attachments', () => {
      return new Collection({
        type: 'base',
        name: 'hk_attachments',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'owner_student',
            type: 'relation',
            required: true,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'application',
            type: 'relation',
            required: false,
            collectionId: applications.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'submission',
            type: 'relation',
            required: false,
            collectionId: submissions.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'supplement_request',
            type: 'relation',
            required: false,
            collectionId: supplementRequests.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'follow_up_task',
            type: 'relation',
            required: false,
            collectionId: tasks.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'attachment_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'application',
              'signed_document',
              'supplement',
              'follow_up',
              'certificate',
              'report',
              'evidence',
              'other',
            ],
          },
          { name: 'field_code', type: 'text', required: false },
          { name: 'original_filename', type: 'text', required: true },
          { name: 'stored_filename', type: 'text', required: true },
          {
            name: 'file',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 15728640,
            mimeTypes: [
              'application/pdf',
              'image/jpeg',
              'image/png',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
          },
          { name: 'mime_type', type: 'text', required: true },
          { name: 'extension', type: 'text', required: true },
          { name: 'size_bytes', type: 'number', required: true },
          { name: 'sha256', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['active', 'superseded', 'deleted', 'quarantined'],
          },
          {
            name: 'uploaded_by_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['student', 'staff', 'admin'],
          },
          {
            name: 'uploaded_by_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'uploaded_by_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'scan_status',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['not_configured', 'pending', 'clean', 'infected', 'error'],
          },
        ],
      })
    })

    const attachmentsCol = app.findCollectionByNameOrId('hk_attachments')

    createIfAbsent('hk_signed_documents', () => {
      return new Collection({
        type: 'base',
        name: 'hk_signed_documents',
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
            name: 'student',
            type: 'relation',
            required: true,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'source_pdf',
            type: 'relation',
            required: true,
            collectionId: pdfDocuments.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'attachment',
            type: 'relation',
            required: true,
            collectionId: attachmentsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'version_number', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['active', 'superseded', 'rejected'],
          },
          { name: 'uploaded_at', type: 'date', required: true },
          { name: 'student_note', type: 'text', required: false },
          { name: 'review_note', type: 'text', required: false },
          {
            name: 'reviewed_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'reviewed_at', type: 'date', required: false },
        ],
      })
    })

    const signedDocs = app.findCollectionByNameOrId('hk_signed_documents')

    addFieldIfAbsent('hk_applications', 'signed_document', {
      type: 'relation',
      name: 'signed_document',
      required: false,
      collectionId: signedDocs.id,
      cascadeDelete: false,
      maxSelect: 1,
    })

    addFieldIfAbsent('hk_applications', 'follow_up_tasks_seeded', {
      type: 'bool',
      name: 'follow_up_tasks_seeded',
      required: false,
    })

    createIfAbsent('hk_supplement_submissions', () => {
      return new Collection({
        type: 'base',
        name: 'hk_supplement_submissions',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'supplement_request',
            type: 'relation',
            required: true,
            collectionId: supplementRequests.id,
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
          { name: 'message', type: 'text', required: false },
          { name: 'submitted_at', type: 'date', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['submitted', 'accepted', 'needs_more'],
          },
          { name: 'is_overdue_at_submit', type: 'bool', required: false },
        ],
      })
    })

    createIfAbsent('hk_follow_up_submissions', () => {
      return new Collection({
        type: 'base',
        name: 'hk_follow_up_submissions',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'task',
            type: 'relation',
            required: true,
            collectionId: tasks.id,
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
          { name: 'submission_version', type: 'number', required: true },
          { name: 'text_content', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['submitted', 'superseded'],
          },
          { name: 'submitted_at', type: 'date', required: true },
          { name: 'is_overdue_at_submit', type: 'bool', required: false },
        ],
      })
    })

    const followSubs = app.findCollectionByNameOrId('hk_follow_up_submissions')

    createIfAbsent('hk_follow_up_reviews', () => {
      return new Collection({
        type: 'base',
        name: 'hk_follow_up_reviews',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'task',
            type: 'relation',
            required: true,
            collectionId: tasks.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'submission',
            type: 'relation',
            required: true,
            collectionId: followSubs.id,
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
            name: 'decision',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['approved', 'supplement_required', 'rejected'],
          },
          { name: 'internal_note', type: 'text', required: false },
          { name: 'student_message', type: 'text', required: false },
          { name: 'allow_resubmit', type: 'bool', required: false },
        ],
      })
    })
  },
  (app) => {
    const names = [
      'hk_follow_up_reviews',
      'hk_follow_up_submissions',
      'hk_supplement_submissions',
      'hk_signed_documents',
      'hk_attachments',
      'hk_follow_up_tasks',
      'hk_category_follow_up_templates',
      'hk_follow_up_task_templates',
    ]
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
  },
)
