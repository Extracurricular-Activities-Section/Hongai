# Deployment

弘愛築夢 — Production 部署架構（Phase 10 文件準備）。

> **Status：NOT LIVE**  
> 程式與文件就緒 ≠ 已部署。正式套用 migration 前狀態為 **READY_FOR_MANUAL_MIGRATION**（需人工備份閘門）。

## Target architecture

```text
┌─────────────────┐     HTTPS      ┌──────────────────────────┐
│  Browser (SPA)  │ ──────────────►│  Cloudflare Pages        │
│  React + Vite   │                │  static assets + SPA     │
└────────┬────────┘                │  fallback (_redirects)   │
         │                         └──────────────────────────┘
         │ API (HTTPS)
         ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│  PocketBase (separate)   │──────►│  PDF Sidecar             │
│  + pb_hooks / migrations │ HTTPS │  pdf-engine service      │
│  + pb_data + file store  │       │  (NOT on CF Workers PB)  │
└────────────┬─────────────┘       └──────────────────────────┘
             │
             │ Cron (X-HAD-Scheduler-Secret)
             ▼
┌──────────────────────────┐
│  Scheduler (external)    │
│  Cloudflare Cron /       │
│  system cron / worker    │
│  → /api/had/internal/    │
│    notifications/*       │
└──────────────────────────┘
```

## Component roles

| Component | Hosting | Responsibility |
| --- | --- | --- |
| Frontend SPA | **Cloudflare Pages** | 靜態建置產物；`VITE_*` 公開變數 |
| PocketBase | **獨立主機／VM／容器**（非 Workers） | Auth、API Rules、hooks、`had_*` data、檔案 |
| PDF sidecar | 獨立 Node 服務（或相容 runtime） | `pdf-lib` 繪製；hooks 以 `HAD_PDF_SERVICE_*` 呼叫 |
| Scheduler | Cron／Worker 僅當 client | 帶 secret 呼叫內部排程端點 |

## Hard rules

1. **不要**把 PocketBase 跑在 Cloudflare Workers／Pages Functions。
2. **不要**在 Pages 放 server secrets（mail／scheduler／PDF secret／PB superuser）。
3. Frontend 只連公開 `VITE_POCKETBASE_URL`；授權邊界在 PocketBase hooks + API Rules。
4. PDF 引擎需可被 PocketBase 主機出站連線；本機開發用 `npm run pdf:service`。

## SPA fallback（Cloudflare Pages）

Repo 已含 `public/_redirects`：

```text
/*    /index.html   200
```

確保 React Router deep link（如 `/admin/forms/:id/builder`、`/verify/:token`）不會 404。

建置：

```bash
npm ci
npm run typecheck && npm run lint && npm run build
# 將 dist/ 部署至 Cloudflare Pages（或連 Git 自動建置）
```

`wrangler.jsonc` 指向 `pages_build_output_dir: "dist"`。公開 `VITE_*` 在 Cloudflare dashboard 設定，**禁止**寫入 secrets。

## PocketBase separate host

建議 checklist（人工執行，本文件不假裝已做）：

- [ ] 安裝／升級相容 PocketBase 版本
- [ ] 部署 `pb_hooks/` 與確認僅 `had_*` migrations
- [ ] **先備份** `pb_data`（含 storage files）
- [ ] 手動套用 migrations（見 `POCKETBASE-MIGRATION-RUNBOOK.md`）
- [ ] 設定 server env（見 `ENVIRONMENT-VARIABLES.md`／`PRODUCTION-ENV.md`）
- [ ] CORS 允許前端 origin
- [ ] TLS 終止（反向代理或平台憑證）

## PDF sidecar

- Hooks → `HAD_PDF_SERVICE_URL` + `HAD_PDF_SERVICE_SECRET`
- 引擎為純 JS（`pdf-lib`），避免 Chromium／Puppeteer（Workers 不相容）
- Production：**NOT CONFIGURED** 直到 sidecar URL／secret／字型路徑就緒

## Scheduler cron

內部端點（需 header `X-HAD-Scheduler-Secret`，**禁止** query string）：

- `POST /api/had/internal/notifications/schedule`
- `POST /api/had/internal/notifications/process`
- `POST /api/had/internal/notifications/process-reminders`

建議間隔依負載調整（例如 process 每 1–5 分鐘）。  
Secret 未輪替／Cron 未掛上 → **NOT CONFIGURED**。

## Explicit non-goals

- PocketBase on Cloudflare Workers：**不支援、不建議**
- 宣稱「已上線」：僅在 `GO-LIVE-CHECKLIST.md` 全部 BLOCKER 清除且人工簽署後
