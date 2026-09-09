# Form Engine

弘愛築夢 Dynamic Form Engine（Phase 5）

## 目標

讓學生在最新開放梯次、確認 Period Profile 後，於 9 大申請項目填寫**專屬內容**（不含共用基本資料），支援草稿、完成、歷史唯讀、上一期答案複製，並產出可供第 6 段 PDF 使用的 snapshot。

## Schema

- `had_forms`：一 Category 一主要 Form
- `had_form_versions`：draft / published / retired；**published 視為 immutable**
- `had_form_sections` / `had_form_fields` / `had_form_field_options` / `had_form_rules`
- 學生端只讀自己 Submission 所需的 published/version schema（via trusted API）

## Versioning

- 新建 Submission 鎖定當下 `current_published_version`
- Admin 改表單應 clone 新 draft version 再 publish（架構已預留；完整 Builder 第 10 段）
- 已有答案的舊 version 不得被覆寫破壞歷史

## Answers / Draft / Complete

- `had_form_submissions`：`draft` | `completed`（無審核狀態）
- `had_form_answers`：JSON value，依 field schema 驗證
- Autosave：debounce、允許缺 required；截止後拒絕
- Complete：全量 required + rules + date range + computed；建立 snapshot

## Snapshot

`had_form_submission_versions.snapshot` 含：

- formVersion
- answers / computed
- studentProfileSnapshot（遮罩身分證）
- periodProfileSnapshot
- category
- timestamps

供第 6 段 PDF 直接使用（snapshot 需含完整學生基本資料與 period／answers）。

## Copy Previous

- 依 field code 對應；`copy_previous=false` 跳過
- 跨 version 相容型別才複製；不相容略過
- 使用**目前** form version，不 reference 舊 submission

## Computed Fields

Declarative only：`sum` / `date_diff_days` / `date_diff_months`  
**禁止** `eval` / `new Function`

## Security

- ownership：session student id
- period：current editable（server time）
- mass assignment：只接受 schema active field codes
- XSS：純文字 rendering，無 `dangerouslySetInnerHTML`
- Staff 全校 submission：第 7 段再開放

## History

`/student/history/:periodId/category/:categoryCode`  
readonly + 最新有效 submission version

## Admin

- `/admin/forms`：列表、版本、published preview、開啟 Builder
- `/admin/forms/:formId/builder`：Phase 10 Form Builder（draft／autosave／publish）
- 詳見 `docs/FORM-BUILDER-TEST-PLAN.md`
