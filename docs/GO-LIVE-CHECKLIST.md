# Go-Live Checklist

上線前人工簽署清單。  
**目前整體：NOT LIVE** — Phase 10 完成的是 code + prep，不是 production 營運宣告。

狀態提示：

- **BLOCKER**：未完成不可 go-live
- **REQUIRED**：上線當日必須完成
- **RECOMMENDED**：強烈建議，可排入上線後短窗

## BLOCKER

- [ ] PocketBase **完整 backup**（`pb_data` + files）已完成且可還原測試通過（見 `BACKUP-RESTORE.md`）
- [ ] Migrations 人工審閱 + **READY_FOR_MANUAL_MIGRATION** preflight 通過（`npm run preflight`）且已依 runbook 套用
- [ ] Hooks 已部署到 production PocketBase；僅 `hk_*` 受影響
- [ ] Frontend 已部署 Cloudflare Pages；SPA fallback 驗證 deep link
- [ ] CORS 僅允許正式前端 origin
- [ ] TLS 全站 HTTPS（Pages + PocketBase）
- [ ] Admin／Staff 帳號與權限已建立（非 PocketBase Superuser 混用日常）
- [ ] `HK_SCHEDULER_SECRET` 已設定且 **不** 出現在前端／Git
- [ ] Production mail 決策已定：正式 provider **或** 明確 `HK_MAIL_PROVIDER=disabled`（禁止誤用 `development` 假寄信當正式）
- [ ] PDF sidecar URL／secret／字型授權就緒（若上線需產正式 PDF）
- [ ] 確認未修改共用實例上非 `hk_*` collections（`students`／`users`／`teachers`）
- [ ] Security contact 與事故通報管道已替換 placeholder（`SECURITY.md`）

## REQUIRED

- [ ] `npm run typecheck && npm run lint && npm run build` 於 release commit 通過
- [ ] `npm run migrate:check`、`npm run security:secrets` 通過
- [ ] Smoke：`notification:smoke`／`attachment:smoke`／`pdf:smoke`（對 staging 或受控環境）
- [ ] Form Builder 關鍵案例（`FORM-BUILDER-TEST-PLAN.md` 至少 #1–3、#20–23、#25）
- [ ] 學生註冊／登入／lockout 抽樣
- [ ] 申請送件 → 審核 → 通知（站內）抽樣
- [ ] 公開 `/verify/:token` 不洩漏 PII
- [ ] Cron 已掛 schedule／process／process-reminders
- [ ] 還原演練紀錄（日期／執行人／結果）存檔
- [ ] Branch protection／secret scanning 依 `GITHUB-SECURITY.md` 啟用（若已有 remote）

## RECOMMENDED

- [ ] Cloudflare WAF／Bot Fight／rate limit 規則（見 `CLOUDFLARE-SECURITY.md`）
- [ ] CSP 標頭逐步收緊
- [ ] 監控與告警（PB 健康、disk、cron 失敗、mail failure rate）
- [ ] Mail provider 正式串接與 bounce 處理（若非 disabled）
- [ ] Malware scanning for uploads（目前 **NOT CONFIGURED**）
- [ ] Identity at-rest 方案決策（見 `IDENTITY-AT-REST.md`；**勿倉促上線無 KMS 自管金鑰**）
- [ ] Playwright E2E 於 staging（**禁止**對 production 亂打）
- [ ] 維運 Runbook 演練（migration rollback = restore）

## Sign-off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Engineering | | | |
| Security / 資安窗口 | | | |
| Product / 業務窗口 | | | |

未完成 BLOCKER 前，對外狀態應維持：**NOT LIVE**／**READY_FOR_MANUAL_MIGRATION**（視 migration 是否已套用）。
