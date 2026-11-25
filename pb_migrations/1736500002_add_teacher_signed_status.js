/// <reference path="../pb_data/types.d.ts" />
/**
 * Wave B: allow the `teacher_signed` application status (老師已簽核).
 *
 * Only touches the hk_applications `status` select values.
 * Idempotent: skips when the value is already present.
 * Review the change in a controlled PocketBase environment before applying;
 * do not apply blindly to production.
 */

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('hk_applications')
    const field = collection.fields.getByName('status')
    if (!field) {
      throw new Error('[hk] hk_applications.status field not found')
    }

    const values = Array.isArray(field.values) ? field.values : []
    if (values.includes('teacher_signed')) {
      console.log('[hk] hk_applications.status already allows teacher_signed - skipped.')
      return
    }

    const next = []
    for (const value of values) {
      next.push(value)
      if (value === 'submitted') next.push('teacher_signed')
    }
    if (!next.includes('teacher_signed')) next.push('teacher_signed')

    field.values = next
    app.save(collection)
    console.log('[hk] hk_applications.status: added teacher_signed.')
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('hk_applications')
    const field = collection.fields.getByName('status')
    if (!field || !Array.isArray(field.values)) return

    field.values = field.values.filter((value) => value !== 'teacher_signed')
    app.save(collection)
  },
)
