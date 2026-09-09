# Current Architecture Audit

弘愛築夢 — 現行 Repository 架構盤點（唯讀 Audit，2026-09-10）。

> **Method：** 實際閱讀 `docs/`、`src/`、`pb_hooks/`、`pb_migrations/`、`pdf-engine/`、`wrangler.jsonc`、`package.json`、`.env.example`；**不得先猜**。  
> **Production status：** NOT LIVE；Migration：**READY_FOR_MANUAL_MIGRATION**；多數 runtime：**NOT VERIFIED**。

---

## 1. 現有功能（Phase 1–10）

| 領域 | 狀態（code） | Runtime |
| --- | --- | --- |
| Student auth（學號+後四碼） | 已實作（`/api/hk/auth/*`） | NOT VERIFIED on prod |
| Staff/Admin auth | PB 原生 `authWithPassword` + `onRecordAuthRequest` | NOT VERIFIED |
| Period / categories / history | 已實作 | NOT VERIFIED |
| Dynamic Form Engine + versions | 已實作 | NOT VERIFIED |
| Form Builder（draft／publish） | 已實作 | NOT VERIFIED |
| PDF generate／download／verify | hooks + `pdf-engine` sidecar | PDF prod NOT CONFIGURED |
| Application workflow + funding decision | 已實作 | NOT VERIFIED |
| Attachments + signed documents | 已實作 | NOT VERIFIED |
| Follow-up tasks／templates | 已實作 | NOT VERIFIED |
| Notifications + mail provider stub | 已實作；mail NOT CONFIGURED | NOT VERIFIED |
| UI/UX Redesign（SaaS／CRM） | 已完成於前端 | 瀏覽器實測受限 |

---

## 2. Routes（Frontend）

### Public
- `/` 學生登入 · `/register` · `/help`
- `/admin/login`（獨立於 PublicLayout）
- `/verify/:token` 公開 PDF 驗證

### Student（guard → StudentLayout）
- `/student` · `profile` · `current` · `current/confirm` · `current/category/:code`
- `tasks` · `tasks/:id` · `notifications` · `settings/notifications`
- `history` · `history/:periodId` · `history/:periodId/category/:code`

### Admin（guard → AdminLayout）
- `/admin` dashboard · `applications` · `applications/:id`
- `tasks` · `follow-up-templates` · `notifications` · `notifications/templates`
- `users` · `departments` · `periods` · `forms` · `forms/:id/builder`
- `documents` · `students` · `identity-reset`

**現況：** 單 SPA、路徑分隔；**不是**雙 subdomain／雙 bundle。

---

## 3. Collections（`hk_*`）

Migration 建立 **44** 個 `hk_*`（見 `pb_migrations/1736500001`–`0007`；`0008` 僅 enum patch）。

前端 `HK_COLLECTIONS`：**43** 鍵（**缺** `hk_reminder_rules`，hooks helpers 有引用）。

**尚不存在（相對最新需求）**

- `hk_service_accounts`／Service Account
- `hk_category_rules`（政策版）
- `hk_living_allowance_rules`
- `hk_reward_rules`／`hk_rewards`
- `hk_disbursement_plans`／`milestones`／`disbursements`
- `hk_counselors`／`hk_department_counselors`
- FAQ／政策內容 collection
- Academic-year progress 專用結構（目前僅能由 entries／applications 推導）

**hk_* 是否已在 `db.keson.pro`：** 文件標 **NOT EXECUTED**／READY_FOR_MANUAL_MIGRATION → Audit **無法證實** production 已有資料。遷移策略須先做存在性探測（見 Implementation Plan）。

---

## 4. API（現行）

幾乎所有業務經 PocketBase：

`{VITE_POCKETBASE_URL}/api/hk/...`

主要群組：`auth`、`student/*`、`forms/*`、`admin/forms/*`、`applications/*`、`pdf/*`、`attachments/*`、`signed-documents/*`、`follow-up/*`、`notifications/*`、`internal/notifications/*`。

Staff 登入例外：PB 原生 collection auth（非 `/api/hk/auth`）。

---

## 5. pb_hooks（27 JS）

| 類型 | 檔案數 | 角色 |
| --- | --- | --- |
| `*.pb.js` 路由／auth hook | ~15 | `routerAdd`／`onRecordAuthRequest` |
| 函式庫 | ~12 | workflow、funding config、form engine、mail、security |

**這是現行 Application／Business Logic Layer。** Cloudflare 上**沒有**對等實作。

---

## 6. Cloudflare code（現行）

| 項目 | 現況 |
| --- | --- |
| `wrangler.jsonc` | Pages only：`pages_build_output_dir: "dist"`；無 Worker `main` |
| `functions/` / `workers/` | **不存在** |
| `public/_headers` | CSP；`connect-src` 含 `https://db.keson.pro` |
| `public/_redirects` | SPA fallback（格式需再核對 Pages 相容性） |
| package.json | **無** wrangler dependency／deploy script |

**結論：** Cloudflare = **靜態前端託管意圖**；業務 API **不在** CF。

---

## 7. 現有 UI

- Design tokens：`src/styles/tokens.css`
- Common：PageHeader、Metric、DataTable、Stepper、ContextPanel、Field、AuthCard…
- Layout：深色 Admin rail、學生水平 nav、Public 左右分割
- Docs：`DESIGN-SYSTEM.md`、`UX-FLOWS.md`、`UI-UX-CHANGELOG.md`
- 產品名 UI 仍見「弘愛築夢申請管理系統」+ 英文副標（Public／Admin login）

**尚缺 UI（相對新需求）**

- 學年度 0/2 進度、核發／獎勵區塊、學生案件全流程 stepper 擴充
- Manage／Apply 雙入口分離
- Counselor／FAQ 管理與展示
- Category Policy Settings（與 Builder 分離）
- Funding 年度累計／已核發／待核發

---

## 8. 已完成但未 Runtime Verified

見 `RUNTIME-VERIFICATION-MATRIX.md`：Form Builder、hooks on prod PB、CORS／TLS、mail disabled 行為等 **NOT VERIFIED**；Pages／PB hosting／WAF／PDF sidecar／scheduler／backup／Playwright 等 **NOT CONFIGURED**／**NOT EXECUTED**。

---

## 9. 與最新需求之衝突

| # | 現行 | 最新需求 | 嚴重度 |
| --- | --- | --- | --- |
| A1 | Browser → PB `/api/hk/*` | Browser → CF → PB | **架構對立** |
| A2 | Business logic in `pb_hooks` | Logic in Cloudflare Workers | **架構對立** |
| A3 | Namespace `had` | Namespace `hk` | 全倉 rename／migration |
| A4 | sessionStorage tokens | Prefer HttpOnly cookies | Auth 遷移 |
| A5 | 單 SPA `/student`+`/admin` | 雙 subdomain + 雙 entry | Frontend split |
| A6 | Docs／rules：PB hooks = auth boundary；禁止改 PB 架構做 UI | 本次**明確要求**改架構 | 需更新 `.cursor/rules/had-ui-ux.mdc` 等 |
| A7 | Funding = decision + items | + Disbursement + Reward + annual 150k rule engine | Schema／API／UI |
| A8 | Eligibility 偏 profile 欄位 | 正式 Eligibility Rule + 身分類型枚舉 | 業務補強 |
| A9 | 無 academic-year 2-item 規則 | 學年至少 2 項（單學期不 block） | 新規則 |
| A10 | 無 counselor model | `hk_counselors*` | Schema／PDF／UI |
| A11 | 承辦聯絡可能不足／非完整 seed | 四單位完整 seed（不可 React hardcode） | Seed／API |
| A12 | PDF verify 與 download 同體系 | Private doc link ≠ public verify | API／UX 分離強化 |
| A13 | CSP 允許 browser→PB | Browser 只連 CF | CSP／CORS 重寫 |
| A14 | Runtime 可能用 Superuser 作業 | Service Account only | 營運模型 |
| A15 | UI 英文副標 | 僅正式繁中產品名 | 小改但全站 |

---

## 10. 需要 Migration 的地方

1. **Namespace：** `hk_*` → `hk_*`（collections、indexes、relations、hooks 路徑、前端 constants、env、docs、tests）  
2. **新建 collections：** service accounts、category rules、living allowance、rewards、disbursements、counselors、FAQ／policy  
3. **既有欄位補強：** follow-up `blocks_disbursement`、applications 年度／核發摘要欄、staff form permissions  
4. **Forward data migration：** 僅當探測到環境已有 `hk_*`  
5. **API 表面：** `/api/had` → CF `/api/hk`；前端 client 全面改打 CF  
6. **Auth／session store**  
7. **Seed：** 四部門、類別指派、聯絡人、初始 funding／living rules（不明項標記）  
8. **文件／規則／威脅模型** 對齊新 trust boundary  

---

## 11. Skills／Rules 盤點（Phase 0）

### 已安裝且與本次相關

| Skill / Rule | 用途 |
| --- | --- |
| `.cursor/rules/had-ui-ux.mdc` | UI 約束（**部分與本次架構遷移衝突**，實作前需修訂） |
| `ui-design-brain` / `web-design-guidelines` / `accessibility-auditing` / `visual-qa-testing` | UI 適配與回歸 |
| `vercel-composition-patterns` | React 元件 API |
| `writing-plans`（superpowers） | Implementation Plan |

### 本次新搜尋與安裝（Cloudflare）

| Candidate | Source | Q | S | C | Conflict | Action |
| --- | --- | --- | --- | --- | --- | --- |
| `cloudflare` | [cloudflare/skills](https://github.com/cloudflare/skills) | PASS | PASS（官方 markdown） | PASS | NONE | **Installed** → `.cursor/skills/cloudflare/` |
| `wrangler` | 同上 | PASS | PASS | PASS | NONE | **Installed** → `.cursor/skills/wrangler/` |
| `workers-best-practices` | 同上 | PASS | PASS | PASS | NONE | **Installed** → `.cursor/skills/workers-best-practices/` |
| `agents-sdk` | 同上 | PASS | PASS | FAIL（AI Agents／DO 非本系統核心） | N/A | **Not installed** |
| 第三方 cloudflare-workers mirror | 非官方 | — | — | — | 風險 | **Rejected** |

`AGENTS.md`／根目錄 `CLAUDE.md`：**不存在**（僅 composition-patterns 內有 AGENTS.md）。

---

## 12. Model assessment

| Item | Result |
| --- | --- |
| Task | Large-repo architecture refactor + TS Workers backend + PB data layer + frontend regression |
| Current agent | Cursor Auto／Composer 路由代理 |
| Fit | **可做 Audit／Plan／分段實作**；極長波次建議人工切換至高推理模型（例如 Claude Opus 等級）以提高跨檔一致性 |
| Auto-switch | 本環境**無法**保證自行切到「最佳」專用模型 |
| Recommendation | Audit／Plan 可用目前模型；**實作 Phase 3+（Workers + Auth Gateway）**建議切換高能力模型後再繼續 |

---

## 13. Audit 結論（一句話）

現行系統是 **成熟的 PocketBase-hooks 後端 + Vite SPA（含完整 UI Redesign）**；Cloudflare 僅靜態 Pages 意圖。最新需求要求 **翻轉 trust boundary 至 Cloudflare**，並補強學年度／補助／核發／獎勵／輔導老師等業務規則——屬**受控多階段遷移**，不是小幅修補。
