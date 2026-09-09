# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| main (development) | Yes |
| Production releases (future) | Yes for the currently deployed major version |

本專案目前完成 **Phase 10（Form Builder + 部署準備文件）**，程式與 runbook 就緒，但 **Production 尚未正式上線（NOT LIVE）**。

Migration 準備狀態：**READY_FOR_MANUAL_MIGRATION**（必須先完成 `pb_data` 備份閘門，再人工套用；見 `docs/POCKETBASE-MIGRATION-RUNBOOK.md`）。

已知限制／誠實狀態：

- Production malware scanning：**NOT CONFIGURED**
- Production Email Provider：**NOT CONFIGURED**（`development` 模擬 ≠ 外部寄送；可用 `disabled`）
- Scheduler cron／WAF／rate limit／CSP：**NOT CONFIGURED**（見 `docs/CLOUDFLARE-SECURITY.md`）
- Backup job／restore drill：**NOT CONFIGURED**／**NOT EXECUTED**
- Identity at-rest encryption：**NOT CONFIGURED**（見 `docs/IDENTITY-AT-REST.md`）
- 附件須經 trusted download
- 詳見 `docs/RUNTIME-VERIFICATION-MATRIX.md`、`docs/GO-LIVE-CHECKLIST.md`

## Reporting a Vulnerability

請勿在 Public Issue、公開討論區或社群貼文中揭露漏洞細節。

請透過私密管道回報，並提供：

- 影響範圍與重現步驟
- 潛在危害評估
- 你的聯絡方式（方便追蹤修復）

### Security Contact Placeholder

- Email：`security@example.edu`（請於正式上線前替換為實際資安聯絡信箱）
- Internal Contact：資安負責人 / 系統維運窗口（待填）

我們會確認收到回報，並在合理時間內評估與回覆。請勿在修復前公開細節。

## Scope Notes

本系統將處理敏感學生個資（含完整身分證字號）。任何可能造成未授權存取、資料外洩、權限提升或附件濫用的問題，皆屬於高優先級安全議題。
