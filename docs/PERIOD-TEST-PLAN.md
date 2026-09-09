# Period / Category Test Plan

**狀態：NOT RUNTIME VERIFIED**（需本機 / staging PocketBase 套用 migration + hooks 後執行）

目標：驗證申請梯次判定、Period Profile、歷史唯讀、Category Entry、Admin 梯次管理。

## Current Period

| # | 案例 | 預期 |
| --- | --- | --- |
| 1 | period `draft` | 學生端不可見 |
| 2 | `scheduled` 且 start 未到 | 顯示尚未開放；不可開始填寫 |
| 3 | `scheduled` 開始前 | 不可 create period profile / category entry |
| 4 | `open` 且 server now 在區間內 | 可進入 `/student/current` |
| 5 | `open` 但尚未 start_at | 視為不可編輯（scheduled UI） |
| 6 | `open` 但已超過 end_at | 不可編輯，即使 status 仍 open |
| 7 | `closed` | 不可新增/修改 |
| 8 | `archived` | 完全歷史唯讀 |
| 9 | 兩個 overlapping open periods | Admin 建立/更新被拒絕 |

## Student Period Profile

| # | 案例 | 預期 |
| --- | --- | --- |
| 10 | 第一次進 open period | 導向確認流程 |
| 11 | 建立 Period Profile | student+period 唯一；snapshot 寫入 |
| 12 | Copy Previous | 新 record；舊期不變；`has_applied_before=true` |
| 13 | Confirm | 設定 `confirmed_at` 後才可進 9 大項目 |
| 14 | 未 confirm 進 category | 被擋 / 提示先確認 |
| 15 | 截止後修改 Profile | API 拒絕 |

## History

| # | 案例 | 預期 |
| --- | --- | --- |
| 16 | 自己歷史 | 可見 |
| 17 | 他人 history periodId | 403 / 無權 |
| 18 | 沒歷史 | 空狀態 |
| 19 | 只有 Period Profile | 列表可見 |
| 20 | 有 Category Entries | 顯示項目數與名稱 |

## Category

| # | 案例 | 預期 |
| --- | --- | --- |
| 21 | 開始新項目 | 建立 draft entry |
| 22 | 重複開始 | 不重複建立（unique） |
| 23 | inactive category | 不可開始 |
| 24 | 對歷史 period create | API 拒絕 |
| 25 | copy previous entry | 新 entry + `copied_from_entry`；不複製舊 relation |

## Admin

| # | 案例 | 預期 |
| --- | --- | --- |
| A1 | Staff-only 建梯次 | 拒絕 |
| A2 | Admin CRUD | 成功 |
| A3 | start_at >= end_at | 拒絕 |
| A4 | 不合理 academic_year | 拒絕 |
| A5 | 改 category code | 不可（UI/API 不允許） |
| A6 | 查看學生 Period Profiles | Admin 可；Staff 暫不可全校瀏覽 |

## 時間與安全

- UI 可用 client time 顯示；**權限判定必須用 server time**。
- 直接 POST 指定歷史 period id 必須失敗。
- Audit 應出現 PERIOD_* / CATEGORY_ENTRY_* 事件，metadata 不含完整身分證與敏感資格全文。
