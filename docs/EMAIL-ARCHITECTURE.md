# Email Architecture

弘愛築夢 — Email 寄送（Phase 9）。

## Provider Abstraction

`hk_mail_provider.js`：

```text
sendMail({ to, subject, text, html }) → MailResult
getProviderStatus() → { configured, provider, from }  // no secrets
```

### Providers

| HK_MAIL_PROVIDER | 行為 |
| --- | --- |
| （空）／none | `PROVIDER_NOT_CONFIGURED` — 不假成功 |
| development | `sent_simulated` — **僅開發** |
| smtp | 預留；未完整實作時視為未配置或明確錯誤 |

Production **尚未**接正式外部 Provider（Resend／Mailgun／Workspace 等）。

## Secrets

僅 server env：`SMTP_PASSWORD` 等。  
禁止 `VITE_*` 任何 mail secret。  
Delivery 不存 password／API key。

## Queue

1. 業務成功 → in-app notification  
2. Delivery `queued`  
3. `processNotificationQueue`：lease → processing → send  
4. Retry backoff：約 0／5／30／120 分鐘，最多 5 次  
5. Permanent／max → `failed`；Admin 可手動 resend（新紀錄）

## Env

見 `.env.example`：`HK_MAIL_*`、`SMTP_*`、`HK_APP_BASE_URL`、`HK_SCHEDULER_SECRET`。

## Status Clarity

| 狀態 | 意義 |
| --- | --- |
| notification logic | 程式已實作 |
| development provider | 可本機模擬 |
| production mail provider | **NOT CONFIGURED** |
