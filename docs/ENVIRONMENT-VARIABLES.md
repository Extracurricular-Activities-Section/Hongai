# Environment Variables

前端公開變數（`VITE_*`）與伺服器密鑰分離。  
**禁止**把任何 secret 做成 `VITE_*`（會打進瀏覽器 bundle）。

> Production secrets：**NOT CONFIGURED**（除非維運已於主機設定；本 repo 不含真實密鑰）。

## Frontend（Vite / Cloudflare Pages）

| Variable | Required | Secret? | Purpose |
| --- | --- | --- | --- |
| `VITE_POCKETBASE_URL` | Yes | No | PocketBase 公開 API base URL |
| `VITE_SUPPORT_EMAIL` | Optional | No | 前端顯示聯絡信箱 |
| `VITE_SUPPORT_PHONE` | Optional | No | 前端顯示聯絡電話 |
| `VITE_MAINTENANCE_MODE` | Optional | No | 維護橫幅（**不**替代後端授權） |
| `VITE_APP_BASE_URL` | Optional | No | 前端公開 URL（若使用） |

## Server（PocketBase host / PDF sidecar）

| Variable | Required for prod | Secret? | Purpose |
| --- | --- | --- | --- |
| `HAD_PDF_SERVICE_URL` | Yes（若啟用 PDF） | No（URL） | PDF sidecar endpoint |
| `HAD_PDF_SERVICE_SECRET` | Yes（若啟用 PDF） | **Yes** | Hooks ↔ PDF 服務 mutual secret |
| `HAD_VERIFY_BASE_URL` | Recommended | No | 公開驗證頁 base（QR） |
| `PDF_FONT_PATH` | Recommended | No | 授權中文字型路徑 |
| `HAD_MAX_UPLOAD_SIZE_MB` | Recommended | No | 附件大小上限 |
| `HAD_APP_BASE_URL` | Recommended | No | Email／通知 action link base |
| `HAD_MAIL_PROVIDER` | Yes | No | `disabled`／`development`／正式 provider 名稱 |
| `HAD_MAIL_FROM_EMAIL` | If mailing | No | From address |
| `HAD_MAIL_FROM_NAME` | Optional | No | From display name |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` | If SMTP bridge | Mixed | 僅外部 worker 橋接時 |
| `SMTP_PASS`（或 provider API key） | If mailing | **Yes** | **永不** `VITE_` |
| `HAD_SUPPORT_EMAIL` / `HAD_SUPPORT_PHONE` | Optional | No | 信件內容聯絡資訊 |
| `HAD_SCHEDULER_SECRET` | Yes（若啟用 cron） | **Yes** | `X-HAD-Scheduler-Secret` |
| `HAD_PREFLIGHT_PB_URL` | Optional | No | `npm run preflight` 探測用 |

## Rules

1. Cloudflare Pages / `wrangler.jsonc` 只放公開 vars 或 dashboard 的非 secret 設定。
2. Mail／PDF／Scheduler／PocketBase Superuser 憑證只存在 PocketBase 主機（或 secret manager）。
3. Delivery／audit metadata **不得**寫入 password、API key、完整身分證。
4. 範例見 repo 根目錄 `.env.example`；正式值用 `docs/PRODUCTION-ENV.md` 占位符填寫流程，**不要 commit 真實值**。

## Status labels

| Area | Typical status until manually configured |
| --- | --- |
| Frontend `VITE_*` | 可於 Pages 設定；仍須對應真實 PB URL |
| Mail provider | **NOT CONFIGURED** 或 `disabled`／`development` |
| Scheduler secret + cron | **NOT CONFIGURED** |
| PDF sidecar | **NOT CONFIGURED**（本機可 development） |
| At-rest identity encryption key | **NOT CONFIGURED**（見 `IDENTITY-AT-REST.md`） |
