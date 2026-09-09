# 弘愛築夢 HK Namespace + Cloudflare Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Using skill:** `writing-plans`  
> **Status:** REPO IMPLEMENTATION SUBSTANTIALLY COMPLETE — Production deploy / PB host migrate / hooks retirement **NOT EXECUTED**.  
> **Completion report:** `docs/INTEGRATION-COMPLETION-REPORT.md`

**Goal:** 在不砍既有 UI／功能的前提下，將業務邏輯遷移至 Cloudflare、PocketBase 降為 `hk_*` 資料層，並補強正式業務規則與雙產品入口。

**Architecture:** Browser → Cloudflare (Auth Gateway + `/api/hk/*` + Queues/Cron) → PocketBase (`hk_*` + Rules + Service Account, no Superuser runtime) → optional PDF Service. `pb_hooks` 漸進退休，禁止 Big Bang 刪除。

**Tech Stack:** React 19 + Vite + TS（雙 entry）、Cloudflare Workers + Queues + Cron、PocketBase、既有 Design System、pdf-lib sidecar（或評估 Worker）。

**Canonical specs:** `docs/MASTER-REQUIREMENTS.md` · `docs/CURRENT-ARCHITECTURE-AUDIT.md`

---

## File / package map（目標結構）

| Path | Responsibility |
| --- | --- |
| `workers/hk-api/`（新建） | Cloudflare API Worker：auth、業務路由、PB client（service account） |
| `workers/hk-api/wrangler.jsonc` | Bindings：secrets、queues、cron、optional R2 |
| `src/apply/` + `src/manage/` 或 `apps/student`/`apps/manage`（選定一種） | 雙前端 entry；共用 `src/shared/` |
| `src/shared/api/hk-client.ts` | Browser → CF only |
| `pb_migrations/` | `hk_*` schema；若需則 `had→hk` forward |
| `pb_hooks/` | 過渡期保留；標記 deprecated；最終退出 runtime |
| `docs/*` | 架構／業務／威脅模型文件 |
| `.cursor/rules/had-ui-ux.mdc` | 修訂：允許受控架構遷移；UI 仍禁止亂砍 |

---

## Phase gate 總覽（對應需求 Phase 99）

| Gate | Name | Exit criteria |
| --- | --- | --- |
| G0 | Audit + Plan | 本文件經使用者確認 |
| G1 | `hk` schema prep | migrations 以 `hk_*` 為準；存在性探測完成 |
| G2 | CF foundation | Worker hello + secrets + PB service login（local） |
| G3 | Read APIs | 唯讀代理通過 typecheck／smoke |
| G4 | Auth Gateway | 學生／職員登入經 CF；lockout；無 last4 in logs |
| G5 | Forms／Submission | autosave／complete／publish 經 CF |
| G6 | Application／Review | 狀態機＋routing 經 CF |
| G7 | Funding／Disburse／Reward | 新 schema + API + UI 適配 |
| G8 | Attachments／PDF | 保護下載；private≠verify |
| G9 | Notifications／Queue／Cron | CF Queue + Cron |
| G10 | Frontend switch | 雙 entry；CSP 不再直連 PB |
| G11 | E2E matrix | 測試文件＋可跑 local smoke |
| G12 | Retire hooks | 無依賴後停用／移除 runtime hooks |

**禁止跨越 G12 在 G4 未過時刪 hooks。**

---

### Task 0: User approval checkpoint

- [ ] **Step 0.1:** 使用者確認本計畫（可附修改意見）
- [ ] **Step 0.2:** 確認 `db.keson.pro` 是否已有任何 `hk_*` collection／資料（是／否／未知）
- [ ] **Step 0.3:** 確認是否有 PB 主機檔案權限部署 migrations（是／否）

**Stop:** 未確認前不得開始 Task 1 以外的程式修改。

---

### Task 1: Policy open questions stub + rule update

**Files:**
- Create: `docs/POLICY-OPEN-QUESTIONS.md`
- Modify: `.cursor/rules/had-ui-ux.mdc`（允許架構遷移波次；保留 UI／安全底線）
- Create: `docs/AGENT-SKILLS-CLOUDFLARE.md`（記錄已安裝 CF skills）

- [ ] **Step 1.1:** 列出說明會歧義項（弱勢第六級等）為 `needs_policy_confirmation`
- [ ] **Step 1.2:** 修訂 UI rule：禁止「為 UI 改 PB」≠禁止「本正式遷移任務」
- [ ] **Step 1.3:** Commit only when user asks

---

### Task 2: Detect hk_* presence（read-only）

**Files:**
- Create: `scripts/detect-had-namespace.mjs`（optional；只讀 list collections）

- [ ] **Step 2.1:** 若有可控 PB URL + 非 Superuser 探測帳號：列出是否存在 `hk_`／`hk_` 前綴
- [ ] **Step 2.2:** 寫入 `docs/MIGRATION-HAD-TO-HK.md` 決策：`GREENFIELD_HK` vs `FORWARD_HK_TO_HK`
- [ ] **Step 2.3:** **不得**對 production 寫入

---

### Task 3: Schema — rename strategy to `hk_*`

**Files:**
- Modify or replace: `pb_migrations/1736500001_*.js` … `0008_*.js`（語意性更名，非盲目 replace）
- Modify: `src/lib/pocketbase/collections.ts` → `HK_COLLECTIONS`
- Create: forward migration **only if** Task 2 = FORWARD

- [ ] **Step 3.1:** GREENFIELD：未部署檔改為建立 `hk_*`；更新所有內部字串／indexes／relations
- [ ] **Step 3.2:** FORWARD：新增 migration「複製／搬遷 had→hk」保留 id；禁止 drop had 直到驗證
- [ ] **Step 3.3:** `npm run migrate:check`
- [ ] **Step 3.4:** 補齊 `hk_reminder_rules` 於前端 constants

---

### Task 4: New business collections

**Files:**
- Create: `pb_migrations/<ts>_create_hk_policy_and_finance.js`（名稱依慣例）
- Create: `pb_migrations/<ts>_create_hk_counselors_faq.js`
- Create: `pb_migrations/<ts>_create_hk_service_accounts.js`

Collections at minimum:
- `hk_service_accounts`
- `hk_category_rules`（versioned）
- `hk_living_allowance_rules`
- `hk_reward_rules` / `hk_rewards`
- `hk_disbursement_plans` / `hk_disbursement_milestones` / `hk_disbursements`
- `hk_counselors` / `hk_department_counselors`
- FAQ／policy content collection

- [ ] **Step 4.1:** 欄位／indexes／deny-by-default rules（僅 service + 必要角色）
- [ ] **Step 4.2:** Seed 四部門＋類別指派＋聯絡（非 React hardcode）
- [ ] **Step 4.3:** Seed funding annual 150000；living brackets；不明級距 `needs_policy_confirmation=true`
- [ ] **Step 4.4:** `migrate:check`

---

### Task 5: Cloudflare Worker foundation

**Files:**
- Create: `workers/hk-api/src/index.ts`
- Create: `workers/hk-api/wrangler.jsonc`
- Create: `workers/hk-api/package.json`（或 monorepo scripts）
- Modify: root `package.json` scripts：`worker:dev`、`worker:typecheck`
- Modify: `.env.example` → `HK_*`（無 secret 用 `VITE_`）

Skills to load: `.cursor/skills/cloudflare` · `wrangler` · `workers-best-practices`

- [ ] **Step 5.1:** `GET /api/hk/health` local
- [ ] **Step 5.2:** PB client with **service account** token from secrets（not Superuser）
- [ ] **Step 5.3:** Guard: refuse non-`hk_` collection names in data access layer
- [ ] **Step 5.4:** CORS allowlist：`HK_STUDENT_APP_URL`、`HK_MANAGE_APP_URL`

---

### Task 6: Port Auth Gateway（students）

**Files:**
- Create: `workers/hk-api/src/routes/auth-student.ts`
- Port logic from: `pb_hooks/hk_auth.pb.js`（語意移植，非整檔貼上）
- Modify frontend: `src/features/auth/student/api.ts` → call CF

- [ ] **Step 6.1:** register／login／logout／me via CF
- [ ] **Step 6.2:** lockout 5／15；rate limit
- [ ] **Step 6.3:** no last4／identity in logs
- [ ] **Step 6.4:** Cookie session spike **or** documented compatible token path
- [ ] **Step 6.5:** Local smoke；hooks route仍保留直到 G10

---

### Task 7: Port Auth Gateway（staff）

**Files:**
- Create: `workers/hk-api/src/routes/auth-staff.ts`
- Port: `hk_staff_auth.pb.js` behavior

- [ ] **Step 7.1:** staff login via CF（wrap PB auth or custom）
- [ ] **Step 7.2:** `is_staff`／`is_admin`／`active`／`can_manage_forms`／`can_publish_forms`
- [ ] **Step 7.3:** Frontend admin login → CF

---

### Task 8: Read-only domain ports

Port in order（each keeps PB hooks until frontend switched）:

1. periods／categories／history  
2. forms workspace preview  
3. applications list／detail（read）  
4. notifications list  
5. follow-up tasks read  

- [ ] **Step 8.1:** CF routes mirror `/api/hk/...`
- [ ] **Step 8.2:** Feature-flag or env `HK_API_BASE_URL` 切換前端
- [ ] **Step 8.3:** typecheck

---

### Task 9: Write paths — forms／applications

- [ ] **Step 9.1:** submission save／complete／copy-previous
- [ ] **Step 9.2:** form builder draft／schema／publish（權限）
- [ ] **Step 9.3:** application submit／actions／assign／supplement
- [ ] **Step 9.4:** Batch／atomic strategy documented in `POCKETBASE-DATA-LAYER.md`
- [ ] **Step 9.5:** Category auto-routing from assignments

---

### Task 10: Business rules engines

**Files:**
- Create: `workers/hk-api/src/rules/eligibility.ts`
- Create: `workers/hk-api/src/rules/academic-year.ts`
- Create: `workers/hk-api/src/rules/funding.ts`
- Create: `workers/hk-api/src/rules/disbursement.ts`
- Create: `workers/hk-api/src/rules/rewards.ts`
- Create: `docs/BUSINESS-RULES.md`

- [ ] **Step 10.1:** Eligibility formal check + period snapshot
- [ ] **Step 10.2:** Academic year 2-item progress（warn, no single-term hard block）
- [ ] **Step 10.3:** Annual 150k server calc for funding UI
- [ ] **Step 10.4:** Per-category caps／hours／stages from `hk_category_rules`
- [ ] **Step 10.5:** Living allowance lookup；unknown → open question
- [ ] **Step 10.6:** Grant ≠ Reward models
- [ ] **Step 10.7:** Disbursement milestones + follow-up blocks
- [ ] **Step 10.8:** Payment states ≠ auto-paid on review

---

### Task 11: Attachments／PDF／verify

- [ ] **Step 11.1:** Upload／download via CF（PB file storage）
- [ ] **Step 11.2:** PDF orchestration； evaluate Worker vs sidecar（doc decision）
- [ ] **Step 11.3:** Private `/doc/:token` vs public `/verify/:token`
- [ ] **Step 11.4:** Signed document gate before submit when required

---

### Task 12: Notifications → Queue + Cron

- [ ] **Step 12.1:** Emit after business success（no rollback on mail fail）
- [ ] **Step 12.2:** CF Queue consumer for email
- [ ] **Step 12.3:** CF Cron for reminders／overdue／retry
- [ ] **Step 12.4:** Retire PB internal notification HTTP triggers when stable

---

### Task 13: Frontend dual entry + naming

**Files:**
- Vite multi-page input：`apply.html`／`manage.html`（或同等）
- Shared layouts／tokens／common components
- Rename UI strings per MASTER-REQUIREMENTS

- [ ] **Step 13.1:** Split bundles； shared UI preserved
- [ ] **Step 13.2:** Remove English product subtitles
- [ ] **Step 13.3:** Student home: academic year progress、核發／待辦
- [ ] **Step 13.4:** Manage dashboard: 待審／待核定／待核發（非 chart wall）
- [ ] **Step 13.5:** Application detail process stepper extension
- [ ] **Step 13.6:** Funding／Reward panels； department contact from API
- [ ] **Step 13.7:** FAQ page（CMS-backed）
- [ ] **Step 13.8:** Category Policy Settings **separate** from Form Builder canvas
- [ ] **Step 13.9:** visual QA + a11y on changed pages only
- [ ] **Step 13.10:** CSP：remove browser→PB `connect-src`

---

### Task 14: Security pass

- [ ] **Step 14.1:** Update `THREAT-MODEL.md`／`SECURITY-ARCHITECTURE.md`
- [ ] **Step 14.2:** IDOR／mass assignment tests on CF routes
- [ ] **Step 14.3:** Confirm no Superuser in Worker secrets samples
- [ ] **Step 14.4:** `npm run security:secrets`

---

### Task 15: Test matrix + E2E plans

**Files:**
- Update: `docs/E2E-TEST-PLAN.md`、`RUNTIME-VERIFICATION-MATRIX.md`
- Create: unit tests for rules engines where practical

- [ ] **Step 15.1:** Namespace／service account／CORS／auth／2-item／150k／disbursement／reward／routing cases
- [ ] **Step 15.2:** Staff scope E2E across four departments
- [ ] **Step 15.3:** Mark each row VERIFIED only with evidence

---

### Task 16: Retire pb_hooks

- [ ] **Step 16.1:** Inventory checklist：each hook → CF replacement ✅
- [ ] **Step 16.2:** Frontend zero calls to PB `/api/had` or `/api/hk` on PB host
- [ ] **Step 16.3:** Disable routerAdd in staging
- [ ] **Step 16.4:** Remove or archive hooks **last**

---

### Task 17: Documentation pack

Create／update as listed in MASTER-REQUIREMENTS §15:
`CLOUDFLARE-ARCHITECTURE.md`、`POCKETBASE-DATA-LAYER.md`、`AUTH-GATEWAY.md`、`ACADEMIC-YEAR-RULES.md`、`FUNDING-DISBURSEMENT.md`、`REWARD-SYSTEM.md`、`COUNSELOR-MODEL.md`、`DOMAIN-ARCHITECTURE.md`、`MIGRATION-HAD-TO-HK.md`、architecture diagram。

- [ ] **Step 17.1:** Docs match code
- [ ] **Step 17.2:** Final completion report template（需求第 102 階段）

---

## Verification commands（每 gate）

```bash
npm run typecheck
npm run lint
npm run build
npm run migrate:check
npm run security:secrets
# worker:
npm run worker:typecheck   # after Task 5
npm run worker:dev
```

**Never:** `git push` · production migrate · production CF deploy · production PB mutate · destructive git · real bulk email

---

## Risks（explicit）

1. **Transactionality：** PB 多筆寫入在 Worker 多次 HTTP 可能非原子 → 需 batch／補償策略。  
2. **PDF on Workers：** 字型記憶體可能不合格 → 預設保留 sidecar。  
3. **Shared PB host：** 其他系統 collections 必須隔離；service account deny 非 `hk_`。  
4. **Session cookie：** cross-subdomain 需仔細設 Domain／CSRF。  
5. **UI regression：** 只改適配面；用既有 design system。  
6. **Policy ambiguity：** 禁止猜測；走 open questions。

---

## Suggested first implementation slice（確認後）

1. Task 1–2（決策＋open questions）  
2. Task 3 GREENFIELD `hk_*` rename in undeployed migrations  
3. Task 5 Worker health + service account guard  
4. Task 6 Student auth via CF（並行保留 hooks）

---

## Approval

請回覆其一：

- **「確認計畫，開始實作」**（可附 Task 2 答案：hk_* 有／無／未知）  
- **「修改計畫：…」**  
- **「先只做文件／schema，不做 Worker」**
