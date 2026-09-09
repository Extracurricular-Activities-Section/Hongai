# Application Workflow Test Plan

Phase 7 — 靜態／手動驗證清單。  
**Runtime：NOT RUNTIME VERIFIED**（未對正式 PocketBase 端到端執行前，勿宣稱通過）。

## Generation / Submit

| # | Case | Expected |
| --- | --- | --- |
| 1 | completed + valid PDF → submit | 建立 Application `submitted` |
| 2 | draft submit | 拒絕 |
| 3 | no valid PDF | 拒絕 |
| 4 | Student A submit B's submission | 403 |
| 5 | duplicate submit（已有非 returned 案件） | 拒絕 |
| 6 | signature_upload_mode=required | 拒絕並提示上傳 |

## Eligibility / Review

| # | Case | Expected |
| --- | --- | --- |
| 7 | submitted → start_eligibility_review | eligibility_review |
| 8 | qualify | under_review + qualified |
| 9 | disqualify + reason | rejected + disqualified |
| 10 | request_supplement | supplement_required + request row |
| 11 | return_for_edit + reason + override | returned_for_edit |
| 12 | edit override after period end | 學生可改表／產 PDF |
| 13 | resubmit same application | status submitted；version/pdf 更新 |
| 14 | approve → begin_funding | approved → funding_pending |
| 15 | reject + reason | rejected |
| 17 | illegal transition | 400 |

## Funding

| # | Case | Expected |
| --- | --- | --- |
| 16 | funding extract | items 來自 snapshot |
| F1 | approved ≤ requested | OK |
| F2 | negative / over requested | 拒絕 |
| F3 | total = sum | server 計算 |
| F4 | V1 final | funding_decided |
| F5 | V2 revise + change_reason | V1 superseded |
| F6 | student latest result | 見核定金額；無 internal_note |
| F7 | annual summary | 同年度累計顯示 |

## Staff Scope

| # | Case | Expected |
| --- | --- | --- |
| S1 | Staff A / Dept X 對 Application X | 可讀 |
| S2 | Application Y 無 assignment | 不可讀 |
| S3 | direct staff assignment | 可讀 |
| S4 | Admin | 全部 |
| S5 | Student 打 backoffice API | 401/403 |
| S6 | Staff 搜尋學號繞 scope | 仍不可見 |

## Freeze

| # | Case | Expected |
| --- | --- | --- |
| Z1 | submitted 後 save form | 鎖定 |
| Z2 | returned_for_edit | 可編輯 |
| Z3 | Staff 改 answers | 無 API／拒絕 |

## Verification notes

- `npm run typecheck` / `lint` / `build` / `migrate:check` / `npm audit`
- PocketBase + hooks 需另行 runtime 驗證後更新本文件狀態
