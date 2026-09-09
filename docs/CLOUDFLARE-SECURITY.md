# Cloudflare Security Notes

Phase 10 建議設定。以下為 **建議／待配置**，除非維運已實際啟用，否則標為 **NOT CONFIGURED**。

## TLS

- Cloudflare Pages：預設 HTTPS；強制 Always Use HTTPS。
- PocketBase 來源主機：同樣終止 TLS（Origin cert 或上游反向代理）。
- 禁止 Mixed Content（前端 HTTPS 呼叫 HTTP PB）。

## CORS（PocketBase）

- 僅允許正式前端 origin（例：`https://<pages-project>.pages.dev` 與自訂網域）。
- 開發 origin 勿留在 production。
- Credentials／Auth header 依 PocketBase 設定；前端使用官方 SDK + session token。

## CSP（Content-Security-Policy）— 建議

於 Pages 或上游逐步導入（先 Report-Only）：

- `default-src 'self'`
- `connect-src 'self' https://<pocketbase-host>`
- `img-src 'self' data: blob:`
- `style-src 'self' 'unsafe-inline'`（若框架需要；之後再收緊）
- `script-src 'self'`（避免任意 inline；視建置結果調整 nonce／hash）
- `frame-ancestors 'none'`
- `base-uri 'self'`
- `form-action 'self'`

**注意**：過嚴 CSP 可能打斷 PDF 預覽／字型；先在 staging 驗證。

## Rate limiting — 建議

| Surface | Suggestion |
| --- | --- |
| `/api/had/auth/login` | 依 IP／學號維度限流（Cloudflare Rate Limit 或 WAF） |
| `/api/had/auth/register` | 較嚴限流 + 監控異常註冊 |
| `/api/had/identity-reset` | 嚴格限流（anti-enumeration 已在 hooks，仍需邊緣防護） |
| 公開 `/api/` 其他 | 通用 bot／flood 規則 |
| Scheduler 內部路徑 | **不**對公網開放；或限制來源 IP + secret |

Account lockout（5 次／15 分）已在應用層；**Production IP Rate Limit = Cloudflare TODO（NOT CONFIGURED）**。

## WAF / Bot

- 啟用 Managed WAF 規則組（依方案）。
- Bot Fight Mode／Super Bot Fight：觀察誤殺後再開。
- 封鎖常見掃描路徑；勿阻擋 `/api/had/*` 合法流量。
- 管理用 PocketBase Admin UI：**強烈建議**限制來源 IP 或 VPN。

## Secrets on Cloudflare

- Pages：只配置 `VITE_*` 公開變數。
- **不要**在 Pages／Workers 放 `HAD_SCHEDULER_SECRET`、`HAD_PDF_SERVICE_SECRET`、SMTP／API keys、PB Superuser。
- PocketBase **不要**部署在 Workers。

## Headers checklist（建議）

- [ ] `Strict-Transport-Security`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` 收斂相機／麥克風等
- [ ] CSP（見上）

## Status

| Control | Status |
| --- | --- |
| TLS on Pages | 平台預設可用；正式網域 **NOT VERIFIED** 直至手動確認 |
| Origin TLS (PB) | **NOT VERIFIED** |
| CORS lockdown | **NOT CONFIGURED**（待 production origin） |
| WAF / Rate limit | **NOT CONFIGURED** |
| CSP | **NOT CONFIGURED** |
