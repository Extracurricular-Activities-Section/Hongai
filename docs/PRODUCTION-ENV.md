# Production Environment Placeholders

**Placeholders only — no real secrets.**  
複製到主機密文存放處填寫；**禁止** commit 真實值或把密鑰寫進 `VITE_*`。

> Status：**NOT CONFIGURED** until operators fill and deploy outside Git.

## Frontend（Cloudflare Pages）

```bash
VITE_POCKETBASE_URL=https://pb.example.invalid
VITE_SUPPORT_EMAIL=support@example.invalid
VITE_SUPPORT_PHONE=
# VITE_MAINTENANCE_MODE=false
# VITE_APP_BASE_URL=https://app.example.invalid
```

## PocketBase host

```bash
HK_APP_BASE_URL=https://app.example.invalid
HK_VERIFY_BASE_URL=https://app.example.invalid
HK_MAX_UPLOAD_SIZE_MB=10

HK_PDF_SERVICE_URL=https://pdf-sidecar.example.invalid
HK_PDF_SERVICE_SECRET=replace-me-pdf-secret
# PDF_FONT_PATH=/var/fonts/NotoSansCJKtc-Regular.otf

HK_MAIL_PROVIDER=disabled
HK_MAIL_FROM_EMAIL=noreply@example.invalid
HK_MAIL_FROM_NAME=弘愛築夢系統
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=replace-me-smtp-or-api-key

HK_SUPPORT_EMAIL=support@example.invalid
HK_SUPPORT_PHONE=

HK_SCHEDULER_SECRET=replace-me-scheduler-secret
```

## Mail decision

| Value | Production meaning |
| --- | --- |
| `disabled` | 站內通知可用；Email → `skipped_provider_disabled`（誠實停用） |
| `development` | **禁止**當 production 正式寄信 |
| 空／`none` | **NOT CONFIGURED**／`BLOCKED_BY_CONFIGURATION` |
| 正式 provider | 僅在憑證與 SPF／DKIM 就緒後 |

詳見 `MAIL-PROVIDER-SETUP.md`。

## Checklist before enabling traffic

- [ ] 所有 `replace-me-*` 已換成強隨機值並存入 secret manager
- [ ] Pages 與 PB CORS origin 一致
- [ ] Scheduler cron header 使用同一 `HK_SCHEDULER_SECRET`
- [ ] 確認 Git 無 `.env` 真實檔被追蹤
