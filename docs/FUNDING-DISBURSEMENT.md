# Funding & Disbursement

## Grant（補助）

- 案件核定金額寫入申請／核發計畫（`hk_disbursement_plans` + milestones）。
- 年度合計以 `computeAnnualFundingSummary` 計算；超限標記 `exceeds_limit`。

## Disbursement（核發）

- Milestone 狀態：`pending → eligible → ready → submitted_for_payment → paid`。
- `evaluateDisbursementGate`：`auto_paid_on_review = false`。
- 追蹤任務可設 `blocks_disbursement`；開啟時阻擋 `ready`／送件撥付。

## Collections

`hk_disbursement_plans` · `hk_disbursement_milestones` · `hk_disbursements` · `hk_living_allowance_rules`

## UI

管理端 `/admin/funding`（讀取 CF admin APIs；需 service account）。
