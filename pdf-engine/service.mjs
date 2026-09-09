/**
 * Local trusted PDF render service for PocketBase hooks.
 * Production: replace with Cloudflare Worker using the same pdf-engine.
 *
 * POST /render
 * Header: X-HAD-PDF-SECRET
 * Body: { snapshot, schema, documentNumber, documentVersion, verificationUrl }
 * Response: application/pdf bytes + X-HAD-SHA256 header
 */
import { createServer } from 'node:http'

import { generateHadApplicationPdf } from './generate.js'

const port = Number(process.env.PDF_SERVICE_PORT || 8788)
const secret = process.env.PDF_SERVICE_SECRET || 'had-dev-pdf-secret'

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method !== 'POST' || req.url !== '/render') {
    res.writeHead(404)
    res.end('not found')
    return
  }

  if (req.headers['x-had-pdf-secret'] !== secret) {
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
      'X-HAD-SHA256': result.sha256,
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

server.listen(port, '127.0.0.1', () => {
  console.log(`[had-pdf-service] listening on http://127.0.0.1:${port}`)
})
