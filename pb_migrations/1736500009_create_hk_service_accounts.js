/// <reference path="../pb_data/types.d.ts" />
/**
 * Service accounts for Cloudflare Workers (non-Superuser).
 * GREENFIELD: create only if absent. Never touch non-hk_ collections.
 */
migrate((app) => {
  const name = 'hk_service_accounts'
  try {
    app.findCollectionByNameOrId(name)
    console.log(`[hk] CONFLICT: "${name}" already exists — skipped`)
    return
  } catch (_) {}

  const collection = new Collection({
    type: 'auth',
    name,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    authRule: 'active = true',
    passwordAuth: {
      enabled: true,
      identityFields: ['email'],
    },
    fields: [
      { name: 'name', type: 'text', required: true },
      {
        name: 'service_role',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['api_runtime', 'scheduler', 'pdf_orchestrator'],
      },
      { name: 'active', type: 'bool', required: false },
      { name: 'notes', type: 'text', required: false },
    ],
  })
  app.save(collection)
  console.log(`[hk] created ${name}`)
}, (app) => {
  // Rollback intentionally empty — restore from backup if needed.
  void app
})
