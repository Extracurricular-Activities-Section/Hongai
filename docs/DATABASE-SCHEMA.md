# Database Schema

弘愛築夢申請管理系統 — PocketBase six-collection data layer.

PocketBase 只做資料庫、auth collection、file storage、relations、indexes。所有 `/api/hk/*` business API、表單驗證、審核流程、通知排程與 PDF orchestration 都由 Cloudflare Worker 承載。

## Active Collections

| Collection | Type | 用途 |
| --- | --- | --- |
| `hk_students` | auth | 學生登入帳號、登入鎖定、學生個資、銀行狀態、通知偏好 JSON |
| `hk_staff_users` | auth | 承辦、管理員、服務帳號與承辦單位資料 |
| `hk_forms` | base | 所有表單範本、版本、分類與 `schema_json`，不綁死九大表單 |
| `hk_applications` | base | 申請案、填答、審核/補件/任務/檔案/PDF/核定/核發 JSON |
| `hk_settings` | base | 申請期間、項目分類、政策規則、FAQ、通知模板、輔導老師、系統設定 |
| `hk_events` | base | 通知、email log、audit log、登入/系統/排程事件 |

## Removed From Active Schema

舊版過度拆分表不再由 active migration 建立，例如：

- `hk_student_profiles`, `hk_departments`, `hk_staff_departments`
- `hk_form_versions`, `hk_form_sections`, `hk_form_fields`, `hk_form_field_options`, `hk_form_rules`, `hk_form_answers`
- `hk_application_status_history`, `hk_application_reviews`, `hk_supplement_requests`
- `hk_follow_up_*`
- `hk_funding_rules`, `hk_funding_decision_items`, `hk_disbursement_*`, `hk_rewards`
- `hk_notification_templates`, `hk_notification_deliveries`, `hk_notification_preferences`, `hk_reminder_rules`
- `hk_service_accounts`, `hk_faq_articles`, `hk_counselors`

這些資料改存於六張 active collections 的 JSON 欄位或事件紀錄中。

## Runtime Rules

- Browser 不直接呼叫 PocketBase `/api/hk/*`；PocketBase 不提供 custom business routes。
- PocketBase 主機不部署 `pb_hooks/`。
- Worker 使用 `hk_staff_users` 中 `role = "service"` 的帳號作為 service account，不使用 `_superusers`。
- API rules 預設 deny-by-default；業務讀寫由 Worker 控制。

## Migration

Active migration:

```text
pb_migrations/1736500001_create_six_collection_data_layer.js
```

檢查：

```bash
npm run migrate:check
```

該檢查只做本地語法與 active collection allowlist 驗證，不連 PocketBase、不修改 production。
