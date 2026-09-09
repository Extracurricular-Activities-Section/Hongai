# 專案規格（PROJECT SPEC）

中文名稱：弘愛築夢申請管理系統  
英文名稱：Hong Ai Dream Application Management System  
Repository：`hong-ai-dream-system`

## 資料模型

- 全部 Collection 使用 `had_` 前綴，與共用 PocketBase 實例上其他系統隔離。
- **禁止**使用 / 修改 production 既有 `students` / `users` / `teachers`。
- Student 與 StudentProfile 分離：`had_students`（Auth）+ `had_student_profiles`（含完整 identity_number）。
- Staff/Admin 共用：`had_staff_users`（`is_staff` / `is_admin` 不互斥）。
- Department 多對多：`had_staff_departments`。

## 學生認證

- 首次註冊建立 Auth + Profile（server-side `/api/had/auth/register`）。
- 登入：學號 + 身分證後四碼（`/api/had/auth/login`）。
- 不使用 Email OTP / 學生自訂密碼。
- 內部 Auth password 為不可預測 random secret，永不回傳前端。
- Lockout：連續 5 次失敗鎖定 15 分鐘。
- Session：sessionStorage（分學生 / 後台兩套 AuthStore）。

## 申請梯次規則（Phase 4）

學生登入後**不可**自由選擇任意歷年梯次填寫。

1. 系統找出最新可見梯次（`active=true` 且 `status != draft`）。
2. 唯有同時滿足以下條件者可填寫（Current Editable Period）：
   - `active = true`
   - `status = open`
   - **server time** `>= start_at` 且 `<= end_at`
3. 其他舊梯次：只能查看歷史紀錄（唯讀）。
4. `scheduled`：可顯示即將開放資訊，不可填寫、不可建立 Period Profile / Category Entry。
5. `closed` / `archived`：不可新增或修改。
6. `draft`：學生端不可見。
7. 無開放梯次：只能看歷史；無歷史則顯示目前沒有可申請內容與歷史紀錄。
8. 即使 `status` 仍為 `open`，若 server now > `end_at`，學生仍不可編輯（不依賴 cron 自動改狀態）。
9. 任何時間學生只能有一個最新可填寫梯次；Admin 建立/更新時禁止 overlapping open periods。
10. 已有 Period Profile 或 Category Entry 的梯次禁止 Hard Delete（改 `active=false` 或 `archived`）。

### 預留擴充

- **Per-student extension**：經 Application `edit_override_until`（退回修改時設定）正式實作；非全局改 Period。
- **歷史 Form Detail**：顯示該 period 的**最新有效 submission version**（Phase 5 已實作版本 snapshot）。

## 共用資料 vs 每梯次 Snapshot

**StudentProfile（長期共用）**

- 姓名、學號、完整身分證、性別、部別、制別、科系、電話、LINE ID、Email 等。
- 註冊時建立；進入 9 大項目時不得再要求重填這些欄位。

**PeriodStudentProfile（該梯次 snapshot）**

- 年級、特殊身分（多選 code）、障礙級距、弱勢級距、曾否申請、銀行狀態、資格說明。
- 第一次建立可自 `student_profiles` 帶入 grade / bank 等。
- 確認後寫入 snapshot；之後歷史頁使用 snapshot，不受共用資料後續變更影響。
- 特殊身分僅供承辦審核參考，**不做自動核准裁決**。

## 上一期套用（Copy-on-create）

- `findPreviousPeriod()` 依 `academic_year` / `semester` / `start_at` / `sort_order` 找最近正式梯次。
- 套用必須 **Copy Snapshot** 成新 record，不可 relation 到舊 Profile。
- `has_applied_before` 由系統依歷史計算，不可由學生改為否。
- Category Entry 套用建立新 entry；**Form Answer 複製**由 Phase 5 `copy-previous` 完成（Copy-on-create，跨 version 依 field code 相容複製）。

## 9 大申請項目與表單（Phase 5）

- 主檔：`had_application_categories`（migration seed）。
- 入口：`had_student_category_entries`（`not_started` | `draft`）。
- Dynamic Form：`had_forms` / versions / sections / fields / options / rules。
- Submission：`draft` | `completed`；完成時寫入含 Profile snapshot 的 submission version。
- 共用資料不進 9 張表單；PDF 於第 6 段合併 StudentProfile + PeriodProfile + Form Submission。
- 歷史 Form Detail 顯示該 period 最新有效 submission version。
- `min_application_count` 預設 2，規則 `warning_only`。

## 完整身分證

- 存在 `had_student_profiles.identity_number`。
- Student 可看自己；Staff 可看**有權限案件**完整身分證（列表遮罩）；Admin 可看全部。
- 列表預設遮罩；at-rest encryption 仍為 Infrastructure TODO。

## 安全預設

- API Rules deny-by-default；複雜 period / server-time 邏輯走 trusted hooks。
- Profile / Period Profile 更新走 allowlist endpoint。
- Audit 僅 trusted hooks 寫入。
- Admin ≠ PocketBase Superuser。

## 正式 PDF（Phase 6）

- 來源：`had_form_submission_versions.snapshot`（含完整身分證於 snapshot，client API 不回傳）
- Collection：`had_pdf_documents`（versioning / SHA-256 / verification_token）
- 產生需 current editable period（或 returned_for_edit + edit_override）；截止後僅下載既有 PDF（無 override）
- 公開 `/verify/:token` 不洩漏 PII、不提供下載
- 紙本簽核區依 category PDF config；電子簽／上傳已簽檔第 8 段

## 正式案件與審核（Phase 7）

- Submission 與 Application 分離；送件 `POST /api/had/applications/submit`
- State machine：資格審核／待補件／退回修改／通過／不通過／核定
- Staff scope：assignment + department；核定版本歷史；年度累計
- 詳見 `docs/APPLICATION-WORKFLOW.md`

## 附件與後續任務（Phase 8）

- `had_attachments` protected upload/download；file field 存 attachment IDs
- 已簽文件／`signature_upload_mode`；補件附件與 submissions
- Follow-up templates／tasks／reviews；`requires_review`；derived overdue
- 詳見 `docs/ATTACHMENT-ARCHITECTURE.md`、`docs/FOLLOW-UP-ARCHITECTURE.md`

## 通知與 Email（Phase 9）

- 站內通知 + Email Delivery 分離；`emitNotificationEvent` 集中觸發
- Templates／Queue／Retry／Scheduler／Preferences
- Production mail provider **未配置**；development 可模擬；亦可 `disabled` → `skipped_provider_disabled`
- 詳見 `docs/NOTIFICATION-ARCHITECTURE.md`、`docs/EMAIL-ARCHITECTURE.md`、`docs/MAIL-PROVIDER-SETUP.md`

## Form Builder 與上線準備（Phase 10）

- Admin Form Builder：draft clone／autosave／preview／publish；published immutable；舊版 retired
- 部署模型：Cloudflare Pages（SPA）+ **獨立** PocketBase + PDF sidecar + scheduler cron（**禁止** PB on Workers）
- 文件：部署、環境變數、go-live、backup／migration runbook、runtime matrix、identity at-rest 選項
- **Production NOT LIVE**；migration 狀態 **READY_FOR_MANUAL_MIGRATION**（備份閘門後人工套用）
- 詳見 `docs/DEPLOYMENT.md`、`docs/GO-LIVE-CHECKLIST.md`、`docs/RUNTIME-VERIFICATION-MATRIX.md`

## 開發進度

- 已完成：Phase 1～**10**（程式與上線準備文件；≠ 已上線）
- 阻塞／待人工：production backup、migration apply、mail／cron／PDF sidecar 配置、runtime 驗證
