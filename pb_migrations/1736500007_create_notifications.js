/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 9: Notifications, email queue, reminders, scheduler.
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

    if (!exists('had_students') || !exists('had_staff_users') || !exists('had_departments')) {
      throw new Error('[hong-ai-dream] Phase 9 requires foundation collections')
    }

    const students = app.findCollectionByNameOrId('had_students')
    const staff = app.findCollectionByNameOrId('had_staff_users')
    const applications = exists('had_applications')
      ? app.findCollectionByNameOrId('had_applications')
      : null
    const followUpTasks = exists('had_follow_up_tasks')
      ? app.findCollectionByNameOrId('had_follow_up_tasks')
      : null
    const supplementRequests = exists('had_supplement_requests')
      ? app.findCollectionByNameOrId('had_supplement_requests')
      : null
    const categories = exists('had_application_categories')
      ? app.findCollectionByNameOrId('had_application_categories')
      : null
    const taskTemplates = exists('had_follow_up_task_templates')
      ? app.findCollectionByNameOrId('had_follow_up_task_templates')
      : null

    // Department contact fields
    addFieldIfAbsent('had_departments', 'contact_email', {
      type: 'text',
      name: 'contact_email',
      required: false,
    })
    addFieldIfAbsent('had_departments', 'contact_phone', {
      type: 'text',
      name: 'contact_phone',
      required: false,
    })
    addFieldIfAbsent('had_departments', 'contact_extension', {
      type: 'text',
      name: 'contact_extension',
      required: false,
    })
    addFieldIfAbsent('had_departments', 'display_name', {
      type: 'text',
      name: 'display_name',
      required: false,
    })

    createIfAbsent('had_notification_templates', () => {
      return new Collection({
        type: 'base',
        name: 'had_notification_templates',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'code', type: 'text', required: true },
          { name: 'name', type: 'text', required: true },
          {
            name: 'channel',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['in_app', 'email', 'both'],
          },
          { name: 'subject_template', type: 'text', required: false },
          { name: 'body_template', type: 'text', required: true },
          { name: 'active', type: 'bool', required: false },
          {
            name: 'category',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['application', 'funding', 'supplement', 'follow_up', 'event', 'system'],
          },
          { name: 'version', type: 'number', required: false },
          { name: 'is_critical', type: 'bool', required: false },
          {
            name: 'created_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'updated_by',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_had_notification_templates_code ON had_notification_templates (code)',
        ],
      })
    })

    const templates = app.findCollectionByNameOrId('had_notification_templates')

    createIfAbsent('had_notifications', () => {
      return new Collection({
        type: 'base',
        name: 'had_notifications',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'recipient_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'recipient_staff',
            type: 'relation',
            required: false,
            collectionId: staff.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'notification_type', type: 'text', required: true },
          { name: 'title', type: 'text', required: true },
          { name: 'message', type: 'text', required: true },
          {
            name: 'application',
            type: 'relation',
            required: false,
            collectionId: applications ? applications.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'follow_up_task',
            type: 'relation',
            required: false,
            collectionId: followUpTasks ? followUpTasks.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'supplement_request',
            type: 'relation',
            required: false,
            collectionId: supplementRequests ? supplementRequests.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'action_url', type: 'text', required: false },
          { name: 'read_at', type: 'date', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['active', 'archived'],
          },
          { name: 'idempotency_key', type: 'text', required: false },
          {
            name: 'ui_category',
            type: 'select',
            required: false,
            maxSelect: 1,
            values: ['application', 'supplement', 'funding', 'follow_up', 'event', 'system'],
          },
        ],
        indexes: [
          'CREATE INDEX idx_had_notifications_student_read ON had_notifications (recipient_student, read_at)',
          'CREATE INDEX idx_had_notifications_idem ON had_notifications (idempotency_key)',
        ],
      })
    })

    // Fix optional relations if applications missing - they should exist from phase 7/8
    if (applications) {
      try {
        const notif = app.findCollectionByNameOrId('had_notifications')
        var af = notif.fields.getByName('application')
        if (af && af.collectionId !== applications.id) {
          af.collectionId = applications.id
          app.save(notif)
        }
      } catch (_) {}
    }

    const notifications = app.findCollectionByNameOrId('had_notifications')

    createIfAbsent('had_notification_deliveries', () => {
      return new Collection({
        type: 'base',
        name: 'had_notification_deliveries',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'notification',
            type: 'relation',
            required: false,
            collectionId: notifications.id,
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
          {
            name: 'channel',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['email'],
          },
          { name: 'recipient', type: 'text', required: true },
          { name: 'subject', type: 'text', required: true },
          { name: 'rendered_body', type: 'text', required: false },
          { name: 'provider', type: 'text', required: false },
          { name: 'provider_message_id', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'queued',
              'processing',
              'sent',
              'sent_simulated',
              'failed',
              'cancelled',
              'skipped_invalid_recipient',
              'bounced',
              'complained',
            ],
          },
          { name: 'attempt_count', type: 'number', required: false },
          { name: 'last_attempt_at', type: 'date', required: false },
          { name: 'sent_at', type: 'date', required: false },
          { name: 'next_retry_at', type: 'date', required: false },
          { name: 'error_code', type: 'text', required: false },
          { name: 'error_message', type: 'text', required: false },
          { name: 'processing_lease_until', type: 'date', required: false },
          { name: 'idempotency_key', type: 'text', required: false },
          {
            name: 'application',
            type: 'relation',
            required: false,
            collectionId: applications ? applications.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'recipient_student',
            type: 'relation',
            required: false,
            collectionId: students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
        indexes: [
          'CREATE INDEX idx_had_deliveries_status_retry ON had_notification_deliveries (status, next_retry_at)',
          'CREATE INDEX idx_had_deliveries_idem ON had_notification_deliveries (idempotency_key)',
        ],
      })
    })

    createIfAbsent('had_notification_preferences', () => {
      return new Collection({
        type: 'base',
        name: 'had_notification_preferences',
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
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'email_enabled', type: 'bool', required: false },
          { name: 'in_app_enabled', type: 'bool', required: false },
          { name: 'event_reminders', type: 'bool', required: false },
          { name: 'follow_up_reminders', type: 'bool', required: false },
          { name: 'system_critical_email', type: 'bool', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_had_notification_preferences_student ON had_notification_preferences (student)',
        ],
      })
    })

    createIfAbsent('had_reminder_rules', () => {
      return new Collection({
        type: 'base',
        name: 'had_reminder_rules',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          {
            name: 'target_type',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['follow_up_due', 'event_start', 'supplement_due', 'other'],
          },
          { name: 'offset_minutes', type: 'number', required: true },
          {
            name: 'channel',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['in_app', 'email', 'both'],
          },
          {
            name: 'template',
            type: 'relation',
            required: true,
            collectionId: templates.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'active', type: 'bool', required: false },
          {
            name: 'category',
            type: 'relation',
            required: false,
            collectionId: categories ? categories.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'task_template',
            type: 'relation',
            required: false,
            collectionId: taskTemplates ? taskTemplates.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        ],
      })
    })

    createIfAbsent('had_scheduled_notifications', () => {
      return new Collection({
        type: 'base',
        name: 'had_scheduled_notifications',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'rule',
            type: 'relation',
            required: true,
            collectionId: app.findCollectionByNameOrId('had_reminder_rules').id,
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
            name: 'application',
            type: 'relation',
            required: false,
            collectionId: applications ? applications.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'task',
            type: 'relation',
            required: false,
            collectionId: followUpTasks ? followUpTasks.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'supplement',
            type: 'relation',
            required: false,
            collectionId: supplementRequests ? supplementRequests.id : students.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'scheduled_for', type: 'date', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['pending', 'queued', 'sent', 'cancelled', 'skipped'],
          },
          { name: 'dedupe_key', type: 'text', required: true },
          { name: 'payload', type: 'json', required: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_had_scheduled_dedupe ON had_scheduled_notifications (dedupe_key)',
          'CREATE INDEX idx_had_scheduled_status_for ON had_scheduled_notifications (status, scheduled_for)',
        ],
      })
    })

    try {
      const seed = require(`${__hooks}/had_notification_templates_seed.js`)
      seed.ensureNotificationSeeds(app)
    } catch (e) {
      console.log(
        '[hong-ai-dream] notification seed skipped: ' + String((e && e.message) || e),
      )
    }
  },
  (app) => {
    const names = [
      'had_scheduled_notifications',
      'had_reminder_rules',
      'had_notification_preferences',
      'had_notification_deliveries',
      'had_notifications',
      'had_notification_templates',
    ]
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
  },
)
