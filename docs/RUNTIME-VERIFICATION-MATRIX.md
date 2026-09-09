# Runtime Verification Matrix

誠實狀態表。標籤僅允許：

- **VERIFIED** — 已在約定環境實測並紀錄
- **NOT VERIFIED** — 程式存在但未完成約定環境實測
- **NOT CONFIGURED** — 相依設定／憑證／基礎設施未就緒
- **NOT EXECUTED** — 測試／演練尚未執行

> Production go-live：**NOT LIVE**。  
> Migration 準備：**READY_FOR_MANUAL_MIGRATION**（見 preflight／runbook）。

| Area | Status | Notes |
| --- | --- | --- |
| Phase 1–9 feature code in repo | VERIFIED（code present） | 以 Git 為準；≠ production runtime |
| Phase 10 Form Builder UI + APIs | NOT VERIFIED | 需套用 hooks 後依 `FORM-BUILDER-TEST-PLAN.md` |
| `hk_*` namespace rename in repo | VERIFIED（code present） | GREENFIELD；見 `MIGRATION-HAD-TO-HK.md` |
| CF Worker `hk-api` local health／rules | NOT VERIFIED | 需 `worker:dev` smoke |
| Dual entry apply/manage | VERIFIED（code present） | `apply.html` / `manage.html` |
| Policy / Funding / FAQ admin UI | VERIFIED（code present） | 需 service account + PB schema |
| Typecheck / lint / build（local CI-like） | VERIFIED（2026-09-10 local） | typecheck／build／worker:typecheck／security:secrets OK；lint warnings only |
| `migrate:check` / `security:secrets` / `preflight` | PARTIAL | migrate:check + security:secrets OK；preflight 仍依環境 |
| PocketBase production migrations applied | NOT EXECUTED | 人工 runbook；勿自動宣稱 APPLIED |
| Hooks deployed on production PB | NOT VERIFIED | |
| Cloudflare Pages deployment | NOT CONFIGURED | SPA fallback 檔案已在 repo |
| PocketBase separate hosting | NOT CONFIGURED | **Not** on Workers |
| CORS / TLS production | NOT CONFIGURED / NOT VERIFIED | 見 `CLOUDFLARE-SECURITY.md` |
| WAF / rate limit | NOT CONFIGURED | |
| PDF sidecar production | NOT CONFIGURED | 本機 `pdf:service` ≠ prod；見 `PDF-WORKER-EVAL.md` |
| Scheduler cron + `HK_SCHEDULER_SECRET` | NOT CONFIGURED | CF stub 已存在 |
| Production mail provider | NOT CONFIGURED | 可用 `disabled`；`development` ≠ prod |
| Mail `disabled` mode behavior | NOT VERIFIED | 預期 `skipped_provider_disabled` |
| Backup job | NOT CONFIGURED | |
| Restore drill | NOT EXECUTED | Go-live BLOCKER |
| Identity at-rest encryption | NOT CONFIGURED | 見 `IDENTITY-AT-REST.md` |
| Malware scanning (uploads) | NOT CONFIGURED | |
| E2E student/admin/security | NOT EXECUTED | 禁止對 production 亂跑 |
| pb_hooks retired | NOT EXECUTED | 見 `HOOKS-RETIREMENT-CHECKLIST.md` |
| Playwright suite | NOT CONFIGURED | Optional |
| Branch protection / secret scanning | NOT CONFIGURED | 見 `GITHUB-SECURITY.md` |
| Security contact real mailbox | NOT CONFIGURED | `SECURITY.md` placeholder |

## How to promote a row

1. 在 staging／受控環境執行並留下日期與執行人。
2. 更新本表狀態與 Notes。
3. Production 列需獨立證據；不得用 local smoke 升級為 production VERIFIED。
