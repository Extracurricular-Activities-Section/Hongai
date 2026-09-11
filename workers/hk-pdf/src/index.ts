/**
 * Cloudflare Worker fronting the hk-pdf-engine Container.
 *
 * Browser / hk-api should call:
 *   GET  /health
 *   POST /render  (+ X-HK-PDF-SECRET)
 *
 * The Durable Object Container proxies to Node listening on :8080.
 */
import { Container, getContainer } from '@cloudflare/containers'

export type Env = {
  PDF_ENGINE: DurableObjectNamespace<PdfEngineContainer>
  HK_PDF_SERVICE_SECRET: string
}

export class PdfEngineContainer extends Container<Env> {
  defaultPort = 8080
  /** Keep warm a bit longer — cold start + CJK font load is costly. */
  sleepAfter = '10m'

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx as DurableObjectState<Record<string, unknown>>, env)
    this.envVars = {
      PDF_SERVICE_HOST: '0.0.0.0',
      PDF_SERVICE_PORT: '8080',
      PDF_SERVICE_SECRET: env.HK_PDF_SERVICE_SECRET || '',
      // 容器內預設開源近似；有 /app/fonts/kaiu.ttf、times.ttf 時 entrypoint 會覆寫
      PDF_FONT_CJK_PATH: '/usr/share/fonts/truetype/arphic/bkai00mp.ttf',
      PDF_FONT_LATIN_PATH:
        '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
      PDF_FONT_LATIN_BOLD_PATH:
        '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    }
  }

  override onStart(): void {
    console.log('[hk-pdf] container started')
  }

  override onStop(): void {
    console.log('[hk-pdf] container stopped')
  }

  override onError(error: unknown): void {
    console.error('[hk-pdf] container error', error)
  }
}

function unauthorized(): Response {
  return new Response('unauthorized', { status: 401 })
}

function getSecret(request: Request): string {
  return (
    request.headers.get('X-HK-PDF-SECRET') ||
    request.headers.get('X-HAD-PDF-SECRET') ||
    ''
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (request.method === 'GET' && (path === '/' || path === '/health')) {
      return Response.json({
        ok: true,
        service: 'hk-pdf',
        mode: 'cloudflare-container',
        secretConfigured: Boolean(env.HK_PDF_SERVICE_SECRET),
      })
    }

    if (path === '/render' && request.method === 'POST') {
      if (!env.HK_PDF_SERVICE_SECRET || getSecret(request) !== env.HK_PDF_SERVICE_SECRET) {
        return unauthorized()
      }
      const container = getContainer(env.PDF_ENGINE, 'default')
      return container.fetch(request)
    }

    if (path === '/engine/health' && request.method === 'GET') {
      if (!env.HK_PDF_SERVICE_SECRET || getSecret(request) !== env.HK_PDF_SERVICE_SECRET) {
        return unauthorized()
      }
      const container = getContainer(env.PDF_ENGINE, 'default')
      return container.fetch(new Request('http://container/health', { method: 'GET' }))
    }

    return new Response('not found', { status: 404 })
  },
}
