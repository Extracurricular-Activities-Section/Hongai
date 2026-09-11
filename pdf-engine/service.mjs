/**
 * Trusted PDF render service (Node sidecar / Cloudflare Container).
 *
 * POST /render
 * Header: X-HK-PDF-SECRET (or legacy X-HAD-PDF-SECRET)
 * Body: { snapshot, schema, documentNumber, documentVersion, verificationUrl }
 * Response: application/pdf bytes + X-HK-SHA256 / X-HAD-SHA256 headers
 *
 * GET /health → { ok: true }
 */
import { createServer } from 'node:http'

import { generateHadApplicationPdf } from './generate.js'

const port = Number(process.env.PDF_SERVICE_PORT || 8080)
const host = process.env.PDF_SERVICE_HOST || '0.0.0.0'
const secret =
  process.env.PDF_SERVICE_SECRET ||
  process.env.HK_PDF_SERVICE_SECRET ||
  // Local `npm run pdf:service` fallback only — Container must set a real secret.
  'hk-dev-pdf-secret'

function authorized(req) {
  if (!secret) return false
  const header =
    req.headers['x-hk-pdf-secret'] || req.headers['x-had-pdf-secret'] || ''
  return header === secret
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: true,
        service: 'hk-pdf-engine',
        fontConfigured: Boolean(process.env.PDF_FONT_PATH),
      }),
    )
    return
  }

  if (req.method !== 'POST' || req.url !== '/render') {
    res.writeHead(404)
    res.end('not found')
    return
  }

  if (!authorized(req)) {
    res.writeHead(401)
    res.end('unauthorized')
    return
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    res.writeHead(400)
    res.end('invalid json')
    return
  }

  try {
    const result = await generateHadApplicationPdf(body)
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'X-HK-SHA256': result.sha256,
      'X-HAD-SHA256': result.sha256,
      'X-HK-PAGE-COUNT': String(result.pageCount),
      'X-HAD-PAGE-COUNT': String(result.pageCount),
    })
    res.end(result.bytes)
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        message: error instanceof Error ? error.message : 'render failed',
      }),
    )
  }
})

server.listen(port, host, () => {
  console.log(`[hk-pdf-engine] listening on http://${host}:${port}`)
})
