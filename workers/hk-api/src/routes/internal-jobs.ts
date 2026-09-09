import { json, type WorkerEnv } from '../lib/http'

/**
 * Transitional notification / reminder entrypoints for CF Cron & Queue.
 * Full email pipeline still lives in pb_hooks until G12.
 *
 * POST /api/hk/internal/cron/reminders   (header X-HK-Scheduler-Secret)
 * POST /api/hk/internal/queue/email      (header X-HK-Scheduler-Secret)
 */
export async function handleInternalJobs(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (
    path !== '/api/hk/internal/cron/reminders' &&
    path !== '/api/hk/internal/queue/email'
  ) {
    return null
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 })
  }

  const secret = env.HK_SCHEDULER_SECRET
  const provided = request.headers.get('X-HK-Scheduler-Secret') || ''
  if (!secret || provided !== secret) {
    return json({ error: 'unauthorized', message: 'Invalid scheduler secret' }, { status: 401 })
  }

  // Transitional: acknowledge cron/queue tick; actual work still delegated to PB hooks
  // via proxy when collections exist. Do not send bulk email from this stub.
  if (path === '/api/hk/internal/cron/reminders') {
    return json({
      ok: true,
      job: 'reminders',
      status: 'accepted_stub',
      message: 'Cron stub — wire to PB notification internal endpoints when host is ready.',
    })
  }

  return json({
    ok: true,
    job: 'email_queue',
    status: 'accepted_stub',
    message: 'Queue consumer stub — emit after business success; mail fail must not rollback.',
  })
}

/** Wrangler scheduled handler companion (same secret-gated logic as HTTP cron). */
export async function onScheduled(
  _controller: ScheduledController,
  env: WorkerEnv,
): Promise<void> {
  // No-op until PB host + secrets are production-ready.
  // Intentionally does not call external mail providers.
  void env
}
