# PocketBase Hooks → Cloudflare Migration Matrix

**Architecture (canonical):**

```text
Browser → Cloudflare Worker /api/hk/* → PocketBase Data API (/api/collections/hk_*, /api/files/*)
```

**Hard rule:** PocketBase **主機不得部署**弘愛築夢 business `pb_hooks`。  
`pb_hooks/` 僅保留在 **repo** 作為語意參考／移植來源，直到 Cloudflare replacement 完成後才允許刪除。

**Remove gate（三者皆須）：**

1. Cloudflare Replacement = `complete`
2. Frontend Switched = `yes`
3. Tested = `pass`

| Legend | Meaning |
| --- | --- |
| `none` | 尚無 CF 實作 |
| `stub` | 僅有骨架／ack，無業務語意 |
| `partial` | 部分 native（或僅 proxy／純計算 helper） |
| `complete` | CF 完整承載原 hook 責任 |
| `proxy-only` | Worker 轉發至 PB `/api/hk/*`（**依賴 hooks → 正式架構禁止用於 production PB**） |

---

## Summary

| Metric | Count |
| --- | --- |
| Hook entry files (`.pb.js` + libs) | 27 JS（含 helpers／config） |
| Cloudflare Replacement = complete | **0**（業務領域） |
| Can Remove = yes | **0** |
| Frontend still calling `/api/hk/*` expecting hook semantics | **幾乎全部 feature API** |

---

## Matrix

| Hook | Current Responsibility | Cloudflare Replacement | Frontend Switched | Tested | Can Remove |
| --- | --- | --- | --- | --- | --- |
| `hk_auth.pb.js` | Student register／login／logout；lockout 5／15；token | `partial` — `auth-student.ts` **仍 proxy 到 PB `/api/hk/auth/*`**（無 hooks 則失敗） | `pending`（可經 `VITE_HK_API_BASE_URL`，但仍依賴 hook 語意） | no | **No** |
| `hk_staff_auth.pb.js` | Staff auth request guard（`onRecordAuthRequest`） | `partial` — `auth-staff.ts` 用 **PB collection auth-with-password**（非 hook route）；hook 內額外 guard **未移植** | `partial`（CF login 路徑可選） | no | **No** |
| `hk_student_profile.pb.js` | `/api/hk/student/me`、profile update | `none`（僅可能被 gateway proxy） | no | no | **No** |
| `hk_periods.pb.js` | current-period、period-profile、categories start／copy、history、admin periods／categories／students | `none` | no | no | **No** |
| `hk_forms.pb.js` | workspace、submission save／complete／copy-previous、history、admin forms list／preview | `none` | no | no | **No** |
| `hk_form_engine.js` | Form validation／engine helpers（被 forms hooks 使用） | `none` | n/a（lib） | no | **No** |
| `hk_form_seed.js` | Form seed helpers | `none` | n/a | no | **No** |
| `hk_form_builder.pb.js` | draft／schema／publish versions | `none` | no | no | **No** |
| `hk_form_builder_lib.js` | Builder lib | `none` | n/a | no | **No** |
| `hk_applications.pb.js` | submit、mine、admin list／action／assign／funding、staff／departments／assignments… | `none` | no | no | **No** |
| `hk_application_workflow.js` | 狀態機／workflow helpers | `none` | n/a | no | **No** |
| `hk_application_guards.js` | 權限／IDOR guards | `none` | n/a | no | **No** |
| `hk_funding_config.js` | Funding config helpers | `partial` — 僅有 **純計算** `rules/funding.ts` + annual-summary route；**無** create／preview／persist API | no | no | **No** |
| `hk_attachments.pb.js` | 安全上傳／下載／刪除 | `none`（files proxy ≠ 業務規則） | no | no | **No** |
| `hk_attachment_security.js` | MIME／size／掃描相關 | `none` | n/a | no | **No** |
| `hk_signed_documents.pb.js` | 簽署文件上傳／依申請查詢 | `none` | no | no | **No** |
| `hk_pdf.pb.js` | generate／download／verify／admin documents／revoke | `none`（sidecar 評估文件有；orchestration 未進 CF） | no | no | **No** |
| `hk_pdf_config.js` | PDF config | `none` | n/a | no | **No** |
| `hk_follow_up.pb.js` | 學生／管理追蹤任務、templates、category templates、ensure tasks | `none` | no | no | **No** |
| `hk_follow_up_lib.js` | Follow-up lib | `none` | n/a | no | **No** |
| `hk_notifications.pb.js` | 學生／管理通知、templates、mail status、dashboard、internal schedule／process | `stub` — `internal-jobs.ts` cron／queue **ack only** | no | no | **No** |
| `hk_notification_service.js` | emit／queue／reminders | `stub` | n/a | no | **No** |
| `hk_notification_render.js` | 安全模板渲染 | `none` | n/a | no | **No** |
| `hk_mail_provider.js` | Mail provider | `none` | n/a | no | **No** |
| `hk_notification_templates_seed.js` | 範本／reminder seed（hook 側） | `none`（migrations seed ≠ runtime emit） | n/a | no | **No** |
| `hk_identity_reset.pb.js` | public identity-reset、admin list／status、unlock | `none` | no | no | **No** |
| `hk_helpers.js` | 共用 helpers | `none`（部分概念散落 CF lib） | n/a | no | **No** |

### Cloudflare-native（非 hook 替代完成項；列此避免混淆）

| CF module | Status | Notes |
| --- | --- | --- |
| `GET /api/hk/health` | complete | 無對應 hook |
| `POST /api/hk/rules/academic-year/progress` | complete（計算） | 非完整 period 業務 |
| `POST /api/hk/rules/funding/annual-summary` | complete（計算） | 非 funding CRUD |
| `POST /api/hk/rules/eligibility/evaluate` 等 | complete（計算） | 未接入申請工作流 |
| `GET/POST /api/hk/admin/policy/*`、`funding/*`、`faq` | partial | service account 讀寫政策／FAQ；**非**原 hooks 全量 |
| `POST /api/hk/auth/staff/login` | partial | PB auth collection；非 Superuser |
| Gateway `proxyToPocketBase` for `/api/hk/*` | **違規過渡** | 正式 PB **無 hooks** 時此路徑會 404；必須改為 CF-native |

---

## Frontend dependency classification

### A. `new PocketBase(...)`（SDK）

| Location | Role | Target |
| --- | --- | --- |
| `src/lib/pocketbase/client.ts` | `studentPb`／`staffPb`；base URL 可指 Worker 或 PB | 逐步改為 **僅 AuthStore／token**，資料呼叫走 `hkApiSend`／apiClient；**禁止** browser 直連敏感 `collections` CRUD |

### B. Feature APIs still on `/api/hk/*` via `*.send`（語意 = hooks）

| Feature path | Status |
| --- | --- |
| `src/features/auth/student/*` | 部分 `hkApiSend`；login 仍期望 hook／proxy |
| `src/features/auth/backoffice/*` | CF staff login optional；其餘 SDK |
| `src/features/periods/api/*` | **hook-dependent** |
| `src/features/forms/api/*` | **hook-dependent** |
| `src/features/form-builder/api/*` | **hook-dependent** |
| `src/features/applications/api/*` | **hook-dependent** |
| `src/features/attachments/api/*` | **hook-dependent** |
| `src/features/signed-documents/api/*` | **hook-dependent** |
| `src/features/follow-up/api/*` | **hook-dependent** |
| `src/features/notifications/api/*` | **hook-dependent** |
| `src/features/admin/api/identity-reset*` | **hook-dependent** |
| `src/features/policy/api/*` | CF-native admin（需 service account） |
| `src/features/faq/api/*` | CF-native |

### C. Direct PocketBase collection usage

搜尋並汰換任何 browser → `pb.collection('hk_...')` 的敏感寫入；正式架構僅允許經 Cloudflare。

---

## PocketBase 主機部署（對照）

| Sync | Allowed? |
| --- | --- |
| `pb_migrations/` | **Yes** |
| `pb_hooks/` | **No** |

詳見本檔配套說明與 `docs/POCKETBASE-DATA-LAYER.md`。

---

## Next implementation order（建議）

1. 停用／移除 Worker 對 PB `/api/hk/*` 的 **business proxy**（改 501 + migration note），避免誤以為 hooks 仍是 runtime。  
2. 依領域移植：Auth → Periods／Profile → Forms／Builder → Applications／Funding → Attachments／PDF → Follow-up → Notifications／Queue／Cron。  
3. Frontend 一律 `apiClient` → CF；通過後才勾 `Frontend Switched`／`Tested`／`Can Remove`。

**Production Deploy：本波不做。**
