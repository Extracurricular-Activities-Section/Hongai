import { json } from '../lib/http'
import type { WorkerEnv } from '../lib/http'

/** Liveness + config presence (never echoes secrets). */
export function health(_request: Request, env: WorkerEnv): Response {
  return json({
    ok: true,
    service: 'hk-api',
    namespace: 'hk',
    pocketbase_url_configured: Boolean(env.HK_POCKETBASE_URL),
    service_account_configured: Boolean(env.HK_PB_SERVICE_EMAIL && env.HK_PB_SERVICE_PASSWORD),
    student_app: env.HK_STUDENT_APP_URL || null,
    manage_app: env.HK_MANAGE_APP_URL || null,
  })
}
