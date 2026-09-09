# hk-api (Cloudflare Worker)

弘愛築夢業務 API 層。Browser → 本 Worker → PocketBase `hk_*`。

## Local

```bash
cd workers/hk-api
npm install
# optional secrets in .dev.vars (gitignored):
# HK_PB_SERVICE_EMAIL=...
# HK_PB_SERVICE_PASSWORD=...
npm run dev
```

Health: `GET http://127.0.0.1:8787/api/hk/health`

## Rules

- No PocketBase Superuser in runtime secrets.
- Data access only via `hk_*` (`assertHkCollection`).
- Production `wrangler deploy` is blocked in package scripts until explicitly ordered.
