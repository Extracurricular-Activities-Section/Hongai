# Contributing

感謝參與弘愛築夢申請管理系統開發。

## Branch & PR

1. 自最新 `main`（或約定開發分支）開 feature／fix 分支。
2. 小步提交；PR 聚焦單一主題。
3. 合併前：
   - [ ] `npm run typecheck`
   - [ ] `npm run lint`
   - [ ] `npm run build`
   - [ ] 相關 smoke（若改動 PDF／附件／通知）
   - [ ] 更新受影響 `docs/*`
4. 需要審查通過後再合併（見 `docs/GITHUB-SECURITY.md` branch protection）。

## CI expectations

- PR 應通過 typecheck／lint／build（當 CI 已設定時為 required checks）。
- `npm run security:secrets` 應用於防止意外提交密鑰。
- `npm run preflight` **不會**對 production 寫入；勿把 preflight 成功當成已遷移。

## Secrets — do not commit

- `.env`、PocketBase Superuser、`HK_*_SECRET`、SMTP／API keys
- 真實 production URL 憑證、備份檔、`pb_data`
- 僅提交 `.env.example` 與 `docs/PRODUCTION-ENV.md` 占位符

前端只允許公開 `VITE_*`。Mail／scheduler／PDF secrets **禁止** `VITE_` 前綴。

## Scope rules

- 只建立／修改 `hk_*` collections。
- 不改共用實例上的 `students`／`users`／`teachers`。
- Admin ≠ PocketBase Superuser。
- Cloudflare Runtime 不得使用 PocketBase Superuser；使用 `hk_service_accounts`（見架構計畫）。

## Docs honesty

- 不宣稱 production **LIVE**、backup **CONFIGURED**、或測試 **VERIFIED**，除非有證據並更新 `docs/RUNTIME-VERIFICATION-MATRIX.md`。
- Migration 狀態使用 **READY_FOR_MANUAL_MIGRATION**／人工簽署流程。

## Security reports

請依根目錄 `SECURITY.md` 私密回報，勿在公開 PR／Issue 貼漏洞利用細節。
