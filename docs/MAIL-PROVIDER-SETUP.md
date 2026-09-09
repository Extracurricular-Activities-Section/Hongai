# Mail Provider Setup

Production／Staging 郵件提供者設定清單。

> 預設誠實狀態：**NOT CONFIGURED** 或依 env 為 `disabled`／`development`。  
> 無憑證時操作／監控應標 **BLOCKED_BY_CONFIGURATION**，不可假裝已寄出。

## Provider modes

| `HAD_MAIL_PROVIDER` | Behavior | Production OK? |
| --- | --- | --- |
| （空）／`none` | `PROVIDER_NOT_CONFIGURED`；不假成功 | 僅表示未接好 |
| `disabled` | 站內通知正常；delivery → `skipped_provider_disabled` | Yes（明確停用 Email） |
| `development`／`console` | 模擬寄送 | **No**（禁止當正式） |
| `smtp`／外部 provider | 需完整憑證與外部 worker／實作 | 僅在就緒後 |

Secrets 僅 server env；**禁止** `VITE_*`。

## Checklist

### Decision

- [ ] 上線策略：正式寄信 **或** `disabled`（二擇一寫進 runbook）
- [ ] 若正式寄信：選定 provider（Workspace SMTP／Resend／Mailgun／其他）

### Credentials（正式寄信時）

- [ ] From 網域驗證（SPF／DKIM／DMARC）
- [ ] `HAD_MAIL_FROM_EMAIL`／`HAD_MAIL_FROM_NAME`
- [ ] SMTP 或 API key 存入 secret manager（非 Git）
- [ ] `HAD_APP_BASE_URL` 指向正式前端（通知連結）
- [ ] 支援信箱／電話（`HAD_SUPPORT_*`）

### Runtime verification（staging）

- [ ] 觸發一則會 enqueue 的業務事件
- [ ] `process` 後 delivery 狀態符合預期（sent／failed／skipped…）
- [ ] 失敗重試與 max attempts 行為符合 `EMAIL-ARCHITECTURE.md`
- [ ] Delivery／audit **無**密碼或 API key

### Disabled mode

- [ ] `HAD_MAIL_PROVIDER=disabled`
- [ ] 站內通知仍建立
- [ ] Email delivery 標記 `skipped_provider_disabled`（非假 `sent`）

## Status labels for operators

| Situation | Label |
| --- | --- |
| 無 provider 憑證且未設 disabled | **BLOCKED_BY_CONFIGURATION** |
| 已設 `disabled` 並驗證 skip | CONFIGURED（disabled）— Email 通道關閉 |
| 僅 development 模擬 | NOT CONFIGURED for production |
| 正式 provider 驗證通過 | CONFIGURED（仍須監控 bounce） |

## Related

- `docs/EMAIL-ARCHITECTURE.md`
- `docs/ENVIRONMENT-VARIABLES.md`
- `docs/PRODUCTION-ENV.md`
- `.env.example`
