/**
 * Hongai Cloudflare API Worker.
 *
 * Six-collection data-layer architecture:
 * Browser -> this Worker -> PocketBase data/files only.
 * No PocketBase Superuser in runtime.
 */

import { json, withCors, type WorkerEnv } from './lib/http'
import { proxyToPocketBase } from './lib/proxy'
import { handleStudentAuth } from './routes/auth-student'
import { handleStaffAuth } from './routes/auth-staff'
import { health } from './routes/health'
import { handleAcademicYear } from './routes/academic-year'
import { handleFundingSummary } from './routes/funding-summary'
import { handleRulesCompute } from './routes/rules-compute'
import { handlePolicyAdmin } from './routes/policy-admin'
import { handleFaq } from './routes/faq'
import { handleInternalJobs, onScheduled } from './routes/internal-jobs'
import { handleStudentPeriods } from './routes/student-periods'

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return withCors(env, request, new Response(null, { status: 204 }))
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    try {
      if (path === '/api/hk/health' && request.method === 'GET') {
        return withCors(env, request, health(request, env))
      }

      const academic = await handleAcademicYear(request, env, path)
      if (academic) return withCors(env, request, academic)

      const funding = await handleFundingSummary(request, env, path)
      if (funding) return withCors(env, request, funding)

      const rules = await handleRulesCompute(request, env, path)
      if (rules) return withCors(env, request, rules)

      const policy = await handlePolicyAdmin(request, env, path)
      if (policy) return withCors(env, request, policy)

      const faq = await handleFaq(request, env, path)
      if (faq) return withCors(env, request, faq)

      const jobs = await handleInternalJobs(request, env, path)
      if (jobs) return withCors(env, request, jobs)

      const staffAuth = await handleStaffAuth(request, env, path)
      if (staffAuth) return withCors(env, request, staffAuth)

      const studentAuth = await handleStudentAuth(request, env, path)
      if (studentAuth) return withCors(env, request, studentAuth)

      const studentPeriods = await handleStudentPeriods(request, env, path)
      if (studentPeriods) return withCors(env, request, studentPeriods)

      if (
        path.startsWith('/api/collections/') ||
        path.startsWith('/api/files/') ||
        path === '/api/realtime'
      ) {
        return withCors(env, request, await proxyToPocketBase(request, env))
      }

      if (path.startsWith('/api/hk/')) {
        return withCors(
          env,
          request,
          json(
            {
              error: 'not_migrated',
              message:
                'This /api/hk route must be implemented in Cloudflare Worker; PocketBase pb_hooks are not deployed.',
              path,
            },
            { status: 501 },
          ),
        )
      }

      return withCors(
        env,
        request,
        json({ error: 'not_found', message: 'Unknown route', path }, { status: 404 }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return withCors(env, request, json({ error: 'internal', message }, { status: 500 }))
    }
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, _ctx: ExecutionContext) {
    await onScheduled(controller, env)
  },
} satisfies ExportedHandler<WorkerEnv>
