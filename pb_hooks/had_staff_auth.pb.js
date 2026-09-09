/// <reference path="../pb_data/types.d.ts" />

/**
 * Harden staff auth: reject inactive / no-role accounts even if password matches.
 * Admin UI must never become PocketBase Superuser.
 */
onRecordAuthRequest((e) => {
  const h = require(`${__hooks}/had_helpers.js`)
  if (e.record.collection().name !== h.COLLECTIONS.staffUsers) {
    return e.next()
  }

  if (!e.record.getBool('active')) {
    throw new ForbiddenError('帳號未啟用')
  }
  if (!e.record.getBool('is_staff') && !e.record.getBool('is_admin')) {
    throw new ForbiddenError('無權限進入後台')
  }

  e.record.set('last_login_at', h.nowIso())
  // Persist last_login_at without blocking auth response
  try {
    e.app.save(e.record)
  } catch (_) {}

  try {
    const meta = {
      ip: e.realIP ? e.realIP() : '',
      user_agent: '',
    }
    h.writeAudit(e.app, {
      actor_type: e.record.getBool('is_admin') ? 'admin' : 'staff',
      actor_staff: e.record.id,
      action: 'STAFF_LOGIN_SUCCESS',
      target_type: 'had_staff_users',
      target_id: e.record.id,
      ip: meta.ip,
      user_agent: meta.user_agent,
    })
  } catch (_) {}

  return e.next()
}, 'had_staff_users')
