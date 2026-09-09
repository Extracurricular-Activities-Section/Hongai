# Architecture

弘愛築夢申請管理系統 — 邏輯架構與使用者流程（Phase 10）。

> Runtime production：**NOT LIVE**／準備狀態見 `RUNTIME-VERIFICATION-MATRIX.md`。

## ASCII architecture

```text
                         ┌──────────────────────────────────────┐
                         │         Cloudflare Pages (SPA)       │
                         │   Student UI │ Staff/Admin UI │ /verify│
                         └──────────────────┬───────────────────┘
                                            │ HTTPS + Auth token
                                            ▼
┌───────────────┐   cron+secret   ┌─────────────────────────────────┐
│ Scheduler     │────────────────►│     PocketBase (separate host)  │
│ (CF Cron / OS)│                 │  had_* collections + pb_hooks   │
└───────────────┘                 │  /api/had/* trusted routes      │
                                  └────────────┬────────────────────┘
                         ┌─────────────────────┼─────────────────────┐
                         ▼                     ▼                     ▼
                  ┌────────────┐       ┌──────────────┐       ┌────────────┐
                  │ pb_data DB │       │ file storage │       │ PDF sidecar│
                  │ + audits   │       │ attachments/ │       │ pdf-lib    │
                  └────────────┘       │ PDFs         │       └────────────┘
                                       └──────────────┘

Mail provider (optional): PocketBase hooks → provider abstraction
  disabled | development | (future production provider)
```

## Trust boundaries

1. Browser ↔ Cloudflare Pages（靜態；無 server secrets）
2. Browser ↔ PocketBase（真正授權：API Rules + hooks）
3. PocketBase ↔ PDF sidecar（shared secret）
4. Scheduler ↔ PocketBase internal routes（scheduler secret）
5. Superuser ≠ 應用 Admin（`had_staff_users.is_admin`）

## User flows（摘要）

### Student

```text
註冊/登入(學號+身分證後四碼)
  → 目前可填梯次 Period Profile
  → 9 大項目 Form（draft/complete，可 copy-previous）
  → 正式 PDF → 送件 Application
  → 補件/退回修改（若適用）→ 站內通知（+ Email 若已配置）
  → 歷史唯讀 / 後續任務 Follow-up
```

### Staff

```text
後台登入
  → 權限範圍內案件審核（資格/補件/退回/通過/核定）
  → 附件下載（trusted）
  → 通知與催收相關作業（依角色）
```

### Admin

```text
後台登入（is_admin）
  → 梯次 / 人員科系 / 表單主檔
  → Form Builder（draft → publish；published immutable）
  → 系統設定與稽核檢視（依實作範圍）
```

### Public

```text
/verify/:token → 僅非 PII 驗證狀態（不下載、無身分證）
```

## Related docs

- `DEPLOYMENT.md` — 部署拓樸
- `SECURITY-ARCHITECTURE.md` — 安全邊界
- `FORM-ENGINE.md` / Form Builder APIs — 動態表單
- `APPLICATION-WORKFLOW.md` — 案件狀態機
- `NOTIFICATION-ARCHITECTURE.md` / `EMAIL-ARCHITECTURE.md`
