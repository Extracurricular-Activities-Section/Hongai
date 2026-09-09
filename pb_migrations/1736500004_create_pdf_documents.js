/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 6: hk_pdf_documents for formal application PDFs.
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
      !exists('hk_application_periods') ||
      !exists('hk_application_categories') ||
      !exists('hk_form_submissions') ||
      !exists('hk_form_submission_versions') ||
      !exists('hk_staff_users')
    ) {
      throw new Error('[hk] Phase 6 requires Phase 3–5 collections')
    }

    const students = app.findCollectionByNameOrId('hk_students')
    const periods = app.findCollectionByNameOrId('hk_application_periods')
    const categories = app.findCollectionByNameOrId('hk_application_categories')
    const submissions = app.findCollectionByNameOrId('hk_form_submissions')
    const submissionVersions = app.findCollectionByNameOrId('hk_form_submission_versions')
    const staff = app.findCollectionByNameOrId('hk_staff_users')

    createIfAbsent('hk_pdf_documents', () => {
      return new Collection({
        type: 'base',
        name: 'hk_pdf_documents',
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
          { name: 'document_number', type: 'text', required: true },
          { name: 'document_version', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['valid', 'superseded', 'revoked'],
          },
          {
            name: 'file',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 20971520,
            mimeTypes: ['application/pdf'],
          },
          { name: 'file_sha256', type: 'text', required: true },
          { name: 'generated_at', type: 'date', required: true },
          {
            name: 'generated_by_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['student', 'staff', 'admin', 'system'],
          },
          {
            name: 'generated_by_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'generated_by_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'verification_token', type: 'text', required: true },
          { name: 'revoked_at', type: 'date', required: false },
          { name: 'revoke_reason', type: 'text', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_hk_pdf_documents_number ON hk_pdf_documents (document_number)',
          'CREATE UNIQUE INDEX idx_hk_pdf_documents_token ON hk_pdf_documents (verification_token)',
        ],
      })
    })

    // self relation superseded_by
    if (exists('hk_pdf_documents')) {
      const docs = app.findCollectionByNameOrId('hk_pdf_documents')
      let field = null
      try {
        field = docs.fields.getByName('superseded_by')
      } catch (_) {
        field = null
      }
      if (!field) {
        docs.fields.add(
          new Field({
            type: 'relation',
            name: 'superseded_by',
            required: false,
            collectionId: docs.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
        app.save(docs)
      }
    }
  },
  (app) => {
    const name = 'hk_pdf_documents'
    if (!name.startsWith('hk_')) return
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // absent
    }
  },
)
