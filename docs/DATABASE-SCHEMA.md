# Database Schema

弘愛築夢申請管理系統 — PocketBase Collection Schema（Phase 10）。

Migrations：`1736500001` … `1736500007_create_notifications.js`，以及 `1736500008_phase10_adjustments.js`（delivery status 等調整）。

## Namespace

全部 `had_*`。

## Phase 9 Collections

| Collection | 用途 |
| --- | --- |
| had_notification_templates | 通知範本 |
| had_notifications | 站內通知 |
| had_notification_deliveries | Email 寄送紀錄 |
| had_notification_preferences | 學生通知偏好 |
| had_reminder_rules | 提醒規則（offset） |
| had_scheduled_notifications | 排程實例（dedupe） |

Departments 新增：`contact_email`、`contact_phone`、`contact_extension`、`display_name`。

API Rules：deny-by-default；經 `/api/had/*`。

## Phase 10 notes

- Form Builder 使用既有 `had_forms*` schema；透過 admin draft／publish API 管理版本。
- Production mail provider／部署 hardening：見 Phase 10 文件；**NOT LIVE**／**READY_FOR_MANUAL_MIGRATION**。
