import { requireStudent } from '../lib/auth-student'
import { json, type WorkerEnv } from '../lib/http'
import { createServicePb } from '../lib/pb'
import {
  isPeriodEditableNow,
  listVisiblePeriods,
  resolvePeriodUiState,
  studentPeriodProfiles,
} from '../lib/periods'

export async function handleStudentPeriods(
  request: Request,
  env: WorkerEnv,
  path: string,
): Promise<Response | null> {
  if (path !== '/api/hk/student/current-period' || request.method !== 'GET') return null

  const student = await requireStudent(request, env)
  if (student instanceof Response) return student

  let pb
  try {
    pb = await createServicePb(env)
  } catch (err) {
    return json(
      {
        error: 'service_account_required',
        message: err instanceof Error ? err.message : 'Service account required',
      },
      { status: 503 },
    )
  }

  try {
    const nowMs = Date.now()
    const periods = await listVisiblePeriods(pb)
    const latest = periods[0] ?? null
    const open = latest && isPeriodEditableNow(latest, nowMs) ? latest : null
    const previous = open ? (periods[1] ?? null) : null

    const profiles = studentPeriodProfiles(student)
    const periodProfile = open && profiles[open.id] ? { ...profiles[open.id], period: open.id } : null

    const applications = await pb.collection('hk_applications').getList(1, 1, {
      filter: pb.filter('student = {:sid}', { sid: student.id }),
      fields: 'id',
    })
    const historyCount = Object.keys(profiles).length

    return json({
      server_now: new Date(nowMs).toISOString(),
      ui_state: resolvePeriodUiState(latest, nowMs),
      latest_period: latest,
      current_open_period: open,
      period_profile: periodProfile,
      previous_period: previous,
      has_history: historyCount > 0 || applications.totalItems > 0,
      history_count: historyCount,
    })
  } catch (err) {
    return json(
      { error: 'pb_error', message: err instanceof Error ? err.message : '無法載入申請梯次資訊' },
      { status: 502 },
    )
  }
}
