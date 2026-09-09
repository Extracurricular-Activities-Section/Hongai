/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 10 adjustments: delivery status for mail disabled mode.
 * ONLY had_* collections.
 */

migrate(
  (app) => {
    const name = 'had_notification_deliveries'
    if (!name.startsWith('had_')) throw new Error('non-had_ refused')
    try {
      const col = app.findCollectionByNameOrId(name)
      const field = col.fields.getByName('status')
      if (field && field.values && field.values.indexOf('skipped_provider_disabled') < 0) {
        field.values = field.values.concat(['skipped_provider_disabled'])
        app.save(col)
      }
    } catch (err) {
      console.log('[hong-ai-dream] skip delivery status patch: ' + err)
    }
  },
  () => {},
)
