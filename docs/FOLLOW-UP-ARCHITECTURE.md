# Follow-up Architecture

弘愛築夢 — 後續任務／成果繳交（Phase 8）。

## Model

| Collection | 用途 |
| --- | --- |
| had_follow_up_task_templates | Admin 可重用模板 |
| had_category_follow_up_templates | Category → 模板 |
| had_follow_up_tasks | 學生實際任務 |
| had_follow_up_submissions | 提交版本（不覆蓋） |
| had_follow_up_reviews | 審核紀錄（追加制） |

## Lifecycle

1. Application `funding_decided` → `ensureFollowUpTasksForApplication`（idempotent：`follow_up_tasks_seeded` + application+template）
2. Staff 可手動新增個案任務
3. Student 提交 text／attachments
4. `requires_review=false` → 直接 `approved`
5. `requires_review=true` → `under_review` → Staff approve／supplement／reject
6. Overdue：`is_overdue` derived（不永久蓋掉 status）
7. 逾期仍可繳
8. Waive：必填理由；不再阻擋結案
9. Close：所有 required tasks `approved|waived` 後 Staff 確認結案（非全自動）

## Task types

`file_upload`｜`text`｜`file_and_text`｜`event_attendance`｜`confirmation`｜`other`

Event 欄位：`event_start_at`／`event_end_at`／`event_location`／`event_note`（Email 提醒 Phase 9）。

## Security

- Student 不可刪 Task
- Staff scope = parent Application scope
- internal_note 學生不可見；student_message 可見
- 已有 submission 不可 Hard Delete（改 waive）

## Supplement vs Follow-up

- Supplement：補行政文件／說明，不改原 Form answers
- Follow-up：核定後成果／證明／課程

## Email

本段（Phase 8）不寄信；Phase 9 已建立 Notification Event／Queue／Reminder。  
Task／Event 欄位供排程使用。
