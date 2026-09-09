# Security Architecture

弘愛築夢申請管理系統安全架構（更新至 Phase 10）。

## 1. System Actors

| Actor | 資料模型 |
| --- | --- |
| Student | `hk_students`（Auth）+ `hk_student_profiles` |
| Staff | `hk_staff_users`（`is_staff=true`） |
| Admin | `hk_staff_users`（`is_admin=true`） |

Staff / Admin 不互斥。**Admin 是系統管理員，不是 PocketBase Superuser。**

## 2. Collection Namespace Isolation

- 本專案只建立 / 操作 `hk_*` Collections。
- Production 既有 `students` / `users` / `teachers` **不得**修改、刪除、變更 API Rule。

## 3. Trust Boundaries

1. Browser ↔ Cloudflare（HTTPS）
2. Frontend ↔ PocketBase：**API Rules + trusted hooks 是真正 authorization boundary**
3. Custom routes under `/api/hk/*` 為 trusted server-side
4. Superuser 僅限受控管理環境；前端永不持有 Superuser token
5. Migration 只允許 `hk_*`

## 4. Student Auth

- UI：學號 + 身分證後四碼
- Server：`POST /api/hk/auth/login` 驗證後以 `$apis.recordAuthResponse` 發正式 Auth Token
- 內部 password：`setRandomPassword()`，永不回傳、不以 last4 當 password
- Lockout：5 次失敗 → 15 分鐘
- Account lockout 已實作；**Production IP Rate Limit = Cloudflare TODO**

## 5. Session Strategy

| Store | Key | Storage |
| --- | --- | --- |
| Student | `hk_student_auth` | **sessionStorage** |
| Staff | `hk_staff_auth` | **sessionStorage** |

SPA token 無法變成 HttpOnly cookie（需未來 Cloudflare/BFF）。XSS 風險需持續防制。

## 6. Ownership & Period / Form / Application Authorization

- Record ID 不是 permission。
- Period Profile / Category Entry / Form Submission：session student id + period 雙重限制。
- Form save/complete：allowlist field codes；送件後凍結，僅 `returned_for_edit`（+ override）可改。
- Application：學生僅自己的案件；Staff 經 `canStaffAccessApplication`；Admin 全讀。
- Funding totals / status：server state machine + server sum。
- Admin 不可直接改學生 answers。

## 7. Sensitive Data

- `identity_number` 存於 `hk_student_profiles`（plaintext）。
- Period Profile：`application_identity_types`、`qualification_note`、bank note 屬敏感／半敏感。
- 案件列表遮罩；Detail（有權限）完整顯示。
- Review `internal_note` 不回學生 endpoint。
- Audit metadata **禁止**完整身分證、credential、答案全文。
- **at-rest encryption = Infrastructure Security TODO**。

## 8. Identity Reset

- `POST /api/hk/identity-reset`（非 public collection create）
- 統一回應，anti-enumeration

## 9. Audit Log（Phase 4–7）

- Period / Form / PDF 既有事件
- Application：`APPLICATION_*` / `ELIGIBILITY_*` / `SUPPLEMENT_REQUESTED` / `FUNDING_DECISION_*`
- Staff/Dept：`STAFF_USER_*` / `DEPARTMENT_ASSIGNMENT_UPDATED`
- metadata 禁止 password / token / 完整身分證 / PDF bytes / 答案全文

## 10. Remaining Security TODO

- Production schema/hooks apply + runtime verification（**READY_FOR_MANUAL_MIGRATION**；**NOT LIVE**）
- IP Rate Limit（Cloudflare）— **NOT CONFIGURED**
- identity_number at-rest encryption — 見 `IDENTITY-AT-REST.md`
- Malware／virus scanning：not_configured
- pb_data + file storage backup + restore drill
- **Production Email Provider：NOT CONFIGURED**（或明確 `disabled`）
- Scheduler secret 輪替與 Cron 部署
- Branch protection／secret scanning（`GITHUB-SECURITY.md`）
