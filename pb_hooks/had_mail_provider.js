/**
 * Mail provider abstraction for HAD notifications.
 * NEVER logs passwords or SMTP secrets.
 */

function env(name, fallback) {
  var v = ''
  try {
    v = $os.getenv(name) || ''
  } catch (_) {
    v = ''
  }
  v = String(v).trim()
  return v || (fallback == null ? '' : String(fallback))
}

function getMailConfig() {
  var provider = env('HAD_MAIL_PROVIDER', '').toLowerCase()
  return {
    provider: provider,
    fromEmail: env('HAD_MAIL_FROM_EMAIL', env('SMTP_FROM', '')),
    fromName: env('HAD_MAIL_FROM_NAME', '弘愛築夢系統'),
    smtpHost: env('SMTP_HOST', ''),
    smtpPort: env('SMTP_PORT', '587'),
    smtpUser: env('SMTP_USER', ''),
    // password intentionally read only when needed; never returned in status
    smtpPassConfigured: !!env('SMTP_PASS', env('SMTP_PASSWORD', '')),
    appBaseUrl: env('HAD_APP_BASE_URL', ''),
    supportEmail: env('HAD_SUPPORT_EMAIL', env('VITE_SUPPORT_EMAIL', '')),
    supportPhone: env('HAD_SUPPORT_PHONE', env('VITE_SUPPORT_PHONE', '')),
  }
}

/**
 * Admin-safe status — no secrets.
 */
function getProviderStatus() {
  var cfg = getMailConfig()
  var provider = cfg.provider || 'none'
  var configured = false
  if (provider === 'development' || provider === 'console') {
    configured = true
  } else if (provider === 'disabled' || provider === 'off') {
    configured = false
  } else if (provider === 'smtp') {
    // SMTP send is not fully implemented in Goja; treat as not production-ready
    configured = false
  } else if (provider && provider !== 'none' && provider !== '') {
    configured = false
  }
  return {
    configured: configured,
    provider: provider || 'none',
    from: cfg.fromEmail || '',
    from_name: cfg.fromName || '',
    app_base_url: cfg.appBaseUrl || '',
    support_email: cfg.supportEmail || '',
    support_phone: cfg.supportPhone || '',
    smtp_host_set: !!cfg.smtpHost,
    disabled: provider === 'disabled' || provider === 'off',
    notes:
      provider === 'disabled' || provider === 'off'
        ? '郵件已停用：僅建立站內通知，不進入寄送信件佇列。'
        : provider === 'smtp'
        ? 'SMTP 於 PocketBase JSVM 尚未完整實作；請使用 development 或外部 worker。'
        : provider === 'development' || provider === 'console'
          ? '開發模式：郵件僅模擬發送，不會真正寄出。'
          : '尚未設定 HAD_MAIL_PROVIDER。',
  }
}

function isValidEmail(address) {
  var s = String(address || '').trim()
  if (!s || s.length > 254) return false
  // Basic RFC-ish check; reject internal synthetic student emails if they slip through
  if (s.indexOf('@students.had.internal') >= 0) return false
  var at = s.indexOf('@')
  if (at < 1) return false
  if (s.lastIndexOf('.') <= at + 1) return false
  if (/\s/.test(s)) return false
  return true
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 * @returns {{ ok: boolean, permanent?: boolean, temporary?: boolean, simulated?: boolean, code?: string, message?: string, messageId?: string }}
 */
function sendMail(opts) {
  opts = opts || {}
  var to = String(opts.to || '').trim()
  var subject = String(opts.subject || '')
  var text = String(opts.text || '')
  var html = opts.html != null ? String(opts.html) : ''

  if (!to || !isValidEmail(to)) {
    return {
      ok: false,
      permanent: true,
      code: 'INVALID_RECIPIENT',
      message: '收件人 Email 無效',
    }
  }

  var cfg = getMailConfig()
  var provider = (cfg.provider || '').toLowerCase()

  if (!provider || provider === 'none') {
    return {
      ok: false,
      permanent: true,
      code: 'PROVIDER_NOT_CONFIGURED',
      message: '郵件提供者未設定（HAD_MAIL_PROVIDER）',
    }
  }

  if (provider === 'disabled' || provider === 'off') {
    return {
      ok: false,
      permanent: true,
      skipped: true,
      code: 'PROVIDER_DISABLED',
      message: '郵件功能已停用（HAD_MAIL_PROVIDER=disabled）',
    }
  }

  if (provider === 'development' || provider === 'console') {
    var messageId =
      'dev-' +
      String(Date.now()) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    try {
      console.log(
        '[had-mail] simulated send to=' +
          to +
          ' subject=' +
          subject.slice(0, 80) +
          ' id=' +
          messageId,
      )
    } catch (_) {}
    return {
      ok: true,
      simulated: true,
      messageId: messageId,
      code: 'SENT_SIMULATED',
      message: '開發模式模擬寄送成功',
    }
  }

  if (provider === 'smtp') {
    // Full SMTP client is not available in PocketBase Goja JSVM.
    // Do NOT pretend success. Prefer external worker / future $http bridge.
    return {
      ok: false,
      permanent: true,
      code: 'PROVIDER_NOT_CONFIGURED',
      message:
        'SMTP 尚未於 hooks 內實作。請改用 HAD_MAIL_PROVIDER=development，或串接外部寄信 worker。',
    }
  }

  return {
    ok: false,
    permanent: true,
    code: 'PROVIDER_NOT_CONFIGURED',
    message: '不支援的郵件提供者：' + provider,
  }
}

module.exports = {
  getMailConfig: getMailConfig,
  getProviderStatus: getProviderStatus,
  sendMail: sendMail,
  isValidEmail: isValidEmail,
}
