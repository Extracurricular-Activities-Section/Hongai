# Notification Architecture

弘愛築夢 — 站內通知與提醒（Phase 9）。

## Two Layers

```text
Business Event
  → emitNotificationEvent()
      → hk_notifications (in-app, primary)
      → hk_notification_deliveries (email queue, secondary)
```

Email 失敗**不得** rollback 核定／審核等業務交易。

## Collections

| Collection | 用途 |
| --- | --- |
| hk_notification_templates | 範本（code unique） |
| hk_notifications | 站內通知 |
| hk_notification_deliveries | Email 寄送紀錄 |
| hk_notification_preferences | 學生偏好 |
| hk_reminder_rules | 提醒 offset 規則 |
| hk_scheduled_notifications | 排程實例 + dedupe_key |

## Template Engine

僅安全 `{{variable}}` 替換（`hk_notification_render.js`）。  
禁止 eval / Function / 任意 script。

## Critical vs Preferences

Critical（補件／退回／不通過／核定等）：`system_critical_email` 不可關閉；站內永遠保留。  
一般課程／成果提醒可關閉。

## Idempotency

`idempotency_key` 於 notification／delivery（例如 `funding:{decisionId}:decided`）。

## Scheduler

內部端點（`X-HAD-Scheduler-Secret` = `HK_SCHEDULER_SECRET`）：

- `POST /api/hk/internal/notifications/schedule`
- `POST /api/hk/internal/notifications/process`
- `POST /api/hk/internal/notifications/process-reminders`

供 Cron／Cloudflare Cron 呼叫；勿用長期 setInterval。

## Reminder offsets

`scheduled_for = target_time + offset_minutes`（timezone-aware ISO；展示 Asia/Taipei）。

預設 seed：截止前 14／7／1／當日；逾期 +7 天；活動類似。

已完成／waived／已提交待審：skip deadline 催繳。

## Privacy

Subject／Body 不含完整身分證、證明內容、附件。  
Email 不附 PDF／證明；導向登入系統。
