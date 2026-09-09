/// <reference path="../pb_data/types.d.ts" />
/**
 * Phase 10 adjustments: delivery status for mail disabled mode.
 * ONLY hk_* collections.
 */

migrate(
  (app) => {
    const name = 'hk_notification_deliveries'
    if (!name.startsWith('hk_')) throw new Error('non-hk_ refused')
    try {
      const col = app.findCollectionByNameOrId(name)
      const field = col.fields.getByName('status')
      if (field && field.values && field.values.indexOf('skipped_provider_disabled') < 0) {
        field.values = field.values.concat(['skipped_provider_disabled'])
        app.save(col)
      }
    } catch (err) {
      console.log('[hk] skip delivery status patch: ' + err)
    }
  },
  () => {},
)
