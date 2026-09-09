# Application Workflow

弘愛築夢申請管理系統 — 正式案件流程（Phase 7）。

## Submission vs Application

| 概念 | Collection | 用途 |
| --- | --- | --- |
| Submission | `had_form_submissions` + versions / answers | 學生填答與 snapshot |
| Application | `had_applications` | 送交承辦後的行政案件 |

PDF 來自 submission snapshot；審核／核定狀態不塞回 submission。

## State Machine

允許轉換（server `had_application_workflow.js`）：

```text
submitted → eligibility_review
eligibility_review → under_review | supplement_required | rejected
under_review → approved | supplement_required | returned_for_edit | rejected
supplement_required → under_review | returned_for_edit | rejected
returned_for_edit → submitted   （學生重新送件，同一 Application）
approved → funding_pending
funding_pending → funding_decided
funding_decided → closed | funding_pending（重新核定前）
```

Client 傳 `action`，不直接寫 `status`。

## 送件前提

1. `submission.status = completed`
2. 已有 `valid` PDF
3. Period profile 已 confirmed
4. 可送件期間（open period）或 `returned_for_edit` + `edit_override_until`
5. `signature_upload_mode != required`（required 時第 8 段才開放上傳後送件）

`requested_amount` 由 server 依 snapshot + `had_funding_config.js` 計算。

## Eligibility

資料來源：`had_period_student_profiles`（非表單文字）。

`eligibility_status`：`pending` | `qualified` | `supplement_required` | `disqualified`

資格不符 → 通常 `rejected`，必填 reason；不刪案件。

## Supplement vs Return for Edit

| | supplement_required | returned_for_edit |
| --- | --- | --- |
| 表單內容 | 通常不改 | 必須修改 |
| 用途 | 補證明／紙本／說明 | 退回改答案 |
| 附件 | 第 8 段 | — |

補件：`had_supplement_requests`（本段僅文字／狀態）。

## Edit Override

`application.edit_override_until`：截止後個別延長修改（非全局改 Period）。

表單／PDF generate 經 `had_application_guards.js` 判定。

## Staff Scope

`canStaffAccessApplication`：

- Admin：全部
- Staff：direct assignment **或** 所屬 department assignment／`current_department`

搜尋僅在 scope 內；不可用學號繞過。

列表遮罩身分證；Detail 顯示完整（有權限時）。

Staff **不可**修改學生 answers／snapshot。

## Funding

- `had_funding_decisions` + `had_funding_decision_items`
- 申請明細自 snapshot 抽出；`approved_amount <= requested_amount`
- `approved_total` = items SUM（server）
- 修正核定：新版本 `final`，舊版 `superseded`；必填 `change_reason`
- `had_funding_rules`：年度／類別上限 capability（預設不 seed 假上限；`warning_only`）

## Internal vs Student Visible

Review / Funding：`internal_note` vs `student_message`。  
學生 endpoint 不回 internal notes。

## Audit（節錄）

`APPLICATION_SUBMITTED` / `RESUBMITTED` / `ASSIGNED`  
`ELIGIBILITY_QUALIFIED` / `DISQUALIFIED`  
`SUPPLEMENT_REQUESTED`  
`APPLICATION_RETURNED_FOR_EDIT` / `APPROVED` / `REJECTED` / `CLOSED`  
`FUNDING_DECISION_CREATED` / `REVISED`  
`STAFF_USER_*` / `DEPARTMENT_ASSIGNMENT_UPDATED`

Metadata 禁止完整身分證、答案全文、credential。

## Security

- Collections deny-by-default
- Trusted `/api/had/*` only
- Mass assignment：status / amounts / numbers server-owned
- 截止後仍可審核與核定；僅限制學生新填（含 override 例外）

## Out of scope（Phase 10）

Form Builder；GitHub／Cloudflare Production Deployment。

## Notifications（Phase 9）

業務事件 → 站內通知優先 → Email queue 次要。  
提醒：`had_reminder_rules` + `had_scheduled_notifications`。  
詳見 `NOTIFICATION-ARCHITECTURE.md`。
