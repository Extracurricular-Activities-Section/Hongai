# 弘愛築夢申請／管理系統

學生端：**弘愛築夢申請系統** · 管理端：**弘愛築夢管理系統**

目前完成 **Phase / Prompt 10 of 10：Form Builder + Production 部署準備文件**（code + prep）。  
進行中：`hk` namespace + Cloudflare 業務層遷移（見 `docs/IMPLEMENTATION-PLAN-HK-CLOUDFLARE.md`）。

> Production：**NOT LIVE**  
> Migration：**READY_FOR_MANUAL_MIGRATION**（需備份閘門後人工套用）  
> Runtime matrix：見 [`docs/RUNTIME-VERIFICATION-MATRIX.md`](docs/RUNTIME-VERIFICATION-MATRIX.md)（多為 NOT VERIFIED／NOT CONFIGURED／NOT EXECUTED）  
> Production Mail Provider：**NOT CONFIGURED**（可用 `HK_MAIL_PROVIDER=disabled` 或 development 模擬；development ≠ 正式寄送）

## 本機

```bash
npm install
npm run typecheck && npm run lint && npm run build
npm run migrate:check && npm run security:secrets
npm run preflight
npm run notification:smoke
npm run attachment:smoke
npm run pdf:smoke
```

排程（需 `HK_SCHEDULER_SECRET`）：

- `POST /api/hk/internal/notifications/schedule`
- `POST /api/hk/internal/notifications/process`
- `POST /api/hk/internal/notifications/process-reminders`

## Phase 10 文件

| Doc | Purpose |
| --- | --- |
| [`docs/FORM-BUILDER-TEST-PLAN.md`](docs/FORM-BUILDER-TEST-PLAN.md) | Form Builder 案例 1–26 |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Pages + 獨立 PocketBase + PDF sidecar + cron |
| [`docs/ENVIRONMENT-VARIABLES.md`](docs/ENVIRONMENT-VARIABLES.md) | `VITE_*` vs server secrets |
| [`docs/GO-LIVE-CHECKLIST.md`](docs/GO-LIVE-CHECKLIST.md) | BLOCKER／REQUIRED／RECOMMENDED |
| [`docs/CLOUDFLARE-SECURITY.md`](docs/CLOUDFLARE-SECURITY.md) | CORS／CSP／rate limit／WAF |
| [`docs/BACKUP-RESTORE.md`](docs/BACKUP-RESTORE.md) | pb_data + files；還原演練 |
| [`docs/POCKETBASE-MIGRATION-RUNBOOK.md`](docs/POCKETBASE-MIGRATION-RUNBOOK.md) | 備份閘門／套用／rollback=restore |
| [`docs/PRODUCTION-ENV.md`](docs/PRODUCTION-ENV.md) | 占位符（無真實密鑰） |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 架構圖與使用者流程 |
| [`docs/DATA-INVENTORY.md`](docs/DATA-INVENTORY.md) | 技術資料盤點 |
| [`docs/E2E-TEST-PLAN.md`](docs/E2E-TEST-PLAN.md) | E2E；Playwright optional；不對 production 執行 |
| [`docs/RUNTIME-VERIFICATION-MATRIX.md`](docs/RUNTIME-VERIFICATION-MATRIX.md) | 驗證狀態矩陣 |
| [`docs/IDENTITY-AT-REST.md`](docs/IDENTITY-AT-REST.md) | 磁碟加密 vs AES-GCM |
| [`docs/MAIL-PROVIDER-SETUP.md`](docs/MAIL-PROVIDER-SETUP.md) | 郵件設定／disabled／BLOCKED_BY_CONFIGURATION |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 分支、PR、CI、禁止 secrets |

既有 Phase 1–9 文件仍適用（AUTH／FORM／PDF／APPLICATION／ATTACHMENT／FOLLOW-UP／NOTIFICATION 等）。

## 安全

- Mail／PDF／Scheduler secrets 僅 server env（禁止 `VITE_`）
- 站內通知優先；Email 失敗或 disabled 不 rollback 業務
- 詳見 [`SECURITY.md`](SECURITY.md)、[`docs/GITHUB-SECURITY.md`](docs/GITHUB-SECURITY.md)
