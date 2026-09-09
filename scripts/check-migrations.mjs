/**
 * Migration syntax + HAD namespace safety check.
 * Does not connect to PocketBase or mutate any database.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(rootDir, '../pb_migrations')

const FORBIDDEN_BARE_COLLECTIONS = [
  'students',
  'users',
  'teachers',
  'staff_users',
  'departments',
  'staff_departments',
  'student_profiles',
  'application_periods',
  'identity_reset_requests',
  'period_student_profiles',
  'application_categories',
  'student_category_entries',
  'forms',
  'form_versions',
  'form_sections',
  'form_fields',
  'form_field_options',
  'form_rules',
  'form_submissions',
  'form_submission_versions',
  'form_answers',
  'pdf_documents',
  'applications',
  'application_status_history',
  'application_reviews',
  'application_staff_assignments',
  'category_department_assignments',
  'supplement_requests',
  'funding_decisions',
  'funding_decision_items',
  'funding_rules',
  'attachments',
  'signed_documents',
  'supplement_submissions',
  'follow_up_task_templates',
  'category_follow_up_templates',
  'follow_up_tasks',
  'follow_up_submissions',
  'follow_up_reviews',
  'notification_templates',
  'notifications',
  'notification_deliveries',
  'notification_preferences',
  'reminder_rules',
  'scheduled_notifications',
]

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.js'))
  .sort()

if (files.length === 0) {
  console.error('No migration .js files found in pb_migrations/')
  process.exit(1)
}

let failed = false

for (const file of files) {
  const fullPath = path.join(migrationsDir, file)
  const source = readFileSync(fullPath, 'utf8')

  try {
    vm.runInNewContext(
      `${source}`,
      {
        console,
        migrate: () => undefined,
        Collection: class Collection {
          constructor(definition) {
            this.definition = definition
          }
        },
      },
      { filename: fullPath },
    )

    for (const bare of FORBIDDEN_BARE_COLLECTIONS) {
      // Only flag quoted string literals (not markdown/backtick comments).
      const hadPattern = new RegExp(`['"]had_${bare}['"]`, 'g')
      const stripped = source.replace(hadPattern, '""')
      if (new RegExp(`['"]${bare}['"]`).test(stripped)) {
        throw new Error(
          `Forbidden non-had_ collection reference "${bare}" found in ${file}. HAD migrations must only operate on had_* collections.`,
        )
      }
    }

    // Also forbid delete/alter of known external names in comments-free code via explicit API calls
    if (/findCollectionByNameOrId\(\s*['"]students['"]\s*\)/.test(source)) {
      throw new Error(`${file} references external collection "students"`)
    }

    console.log(`OK  ${file}`)
  } catch (error) {
    failed = true
    console.error(`FAIL ${file}`)
    console.error(error)
  }
}

if (failed) {
  process.exit(1)
}

console.log(`Checked ${files.length} migration file(s). No PocketBase connection was made.`)
