# Master Requirements

弘愛築夢申請／管理平台 — 最新需求統整（整合規格）。

> **Status：** SPEC LOCKED FOR PLANNING（2026-09-10）  
> **Source：** 使用者正式指令（全系統需求統整 + Cloudflare 架構遷移）  
> **原則：** 不是重做系統；保留既有 Phase 1–10 功能與 UI/UX Redesign；只補規則、遷移架構、適配 UI。  
> **Production：** 不得自行宣稱上線；以 Runtime Verification + Policy Open Questions 判定。

---

## 0. 產品命名

| 入口 | 正式中文名稱 | URL（環境變數） |
| --- | --- | --- |
| 學生端 | **弘愛築夢申請系統** | `HK_STUDENT_APP_URL`（例：`apply.example.edu.tw`） |
| 管理端 | **弘愛築夢管理系統** | `HK_MANAGE_APP_URL`（例：`manage.example.edu.tw`） |

- UI **不要**英文副標題（禁止「Hong Ai Dream Application Management System」）。
- `hk` 僅為 **程式 namespace**，不是產品行銷名稱。

---

## 1. 目標架構

```text
Browser
  ├─ 弘愛築夢申請系統 (STUDENT_APP_URL)
  └─ 弘愛築夢管理系統 (MANAGE_APP_URL)
        │
        ▼
Cloudflare（Application / Business Logic）
  ├─ API Worker
  ├─ Auth Gateway
  ├─ Queues / Cron
  ├─ Rate Limit / WAF / Secrets
  └─ （評估）PDF Worker 或獨立 PDF Service
        │
        ▼
PocketBase（Data Persistence）
  ├─ hk_* collections / files / relations / indexes
  ├─ API Rules + Service Account（非 Superuser）
  └─ 不再承載弘愛築夢 business pb_hooks
```

**硬規則**

1. Browser **不**直連 PocketBase CRUD；只呼叫 Cloudflare `/api/hk/*`。
2. Cloudflare Runtime **不**持有 PocketBase Superuser。
3. Service Account **只能**操作 `hk_*`；拒絕 `students` / `users` / `teachers` 等非 `hk_`。
4. `pb_hooks` **不得**在 replacement 未完成前刪除；採漸進退休。
5. **禁止** production migration / deploy / git push（除非另有明示）。

---

## 2. Namespace

| 舊 | 新 |
| --- | --- |
| `hk_*` collections | `hk_*` |
| `/api/hk/*` | `/api/hk/*` |
| `HK_*` env | `HK_*` |
| session keys `hk_*_auth` | `hk_*_auth`（或 Cookie 遷移後移除） |

若環境**尚未**正式存在 `hk_*` records → 未部署 migrations 直接改寫為 `hk_*`。  
若已存在 → Forward migration（保留 IDs／relations／files／history）；**禁止 Delete**。

---

## 3. 角色與入口

| Actor | 入口 | 權限摘要 |
| --- | --- | --- |
| Student | 申請系統 | 註冊／登入、資格、本期、九大項目、PDF、簽核送件、補件、核定／核發進度、任務、通知、歷史、FAQ |
| Staff | 管理系統 | 本單位／指派 Scope 內案件；表單 Draft（可選 publish 權） |
| Admin | 管理系統 | 全部單位／案件／規則／帳號／FAQ／稽核；正式 Publish 預設權 |

學生**不得**見 Form Builder、Draft、Admin routes、內部審核備註。

---

## 4. Auth / Session

- 學生：學號 + 身分證後四碼 → **Cloudflare Auth Gateway**。
- 鎖定：5 次失敗 → 15 分鐘；搭配 CF Rate Limit。
- 禁止儲存／log：raw last4、password、完整身分證、auth token。
- Session：**優先** Secure HttpOnly SameSite Cookie；若遷移過大則相容方案，禁止無測試硬切。
- Staff／Admin：經 Manage Auth Gateway；細權限 server-side。

---

## 5. 表單

- 承辦／Admin 在管理系統建立 Draft → Builder → Preview → Publish → 綁定梯次／項目。
- 學生**只**用 Published Version；進行中 submission **釘住**版本。
- Form 與 Period 分離（可跨學期共用同一 Published Version）。
- 權限：`can_manage_forms`／`can_publish_forms`（Staff 預設僅 Draft；Admin 預設 Publish）。

---

## 6. 九大項目（stable codes）

| # | 名稱 | Internal code（沿用既有） |
| --- | --- | --- |
| 1 | 課業學習 | `academic_learning` |
| 2 | 專業證照 | `professional_certification` |
| 3 | 就業增能 | `career_enhancement` |
| 4 | 校外競賽 | `external_competition` |
| 5 | 外語檢定 | `language_certification` |
| 6 | 共通職能 | `common_competency` |
| 7 | 跨域學習 | `cross_domain_learning` |
| 8 | 海外研修 | `overseas_study` |
| 9 | 其他 | `other` |

規則進入 `hk_category_rules`（Eligibility／Funding／Disbursement／Follow-up／Reward／Signature／Evidence），**禁止**只活在 Form fields 或 React hardcode。

---

## 7. 四個承辦單位（Initial Seed — 非 hardcode UI）

| 單位 | 地點 | 聯絡窗口 | 分機 | 負責項目 |
| --- | --- | --- | --- | --- |
| 教務處教學發展組 | B205 | 曾孟涵 | 1288 | 課業學習 |
| 學務處職涯中心 | NB110 | 林宜玫 | 2207 | 專業證照、就業增能 |
| 學務處生活住宿組 | B107 | 余文明 | 1427 | 校外競賽 |
| 學務處課外活動指導組 | H101 | 鄭雅純 | 1502 | 外語檢定、共通職能、跨域學習、海外研修、其他 |

學生不可自選承辦；Category → Department → Assignment Queue（server）。

---

## 8. 資格與學年度

**Eligibility（至少）**

1. 中華民國國籍  
2. 本校在校學籍  
3. 指定經濟／文化不利或特殊身分類型之一（低收入戶、中低收入戶、身障／子女、特殊境遇、弱勢助學、原住民、懷孕、撫養未滿三歲、家庭突遭變故經審、其他特殊經審）

**Period snapshot：** `hk_period_student_profiles` — 歷史不因長期 profile 變更而改寫。

**Academic Year：** `minimum_categories_per_academic_year = 2`  
- 單學期可只送 1 項（**不** hard block）  
- UI 顯示「本學年度已完成 x / 2」

---

## 9. Funding / Reward / Disbursement

| 概念 | 規則 |
| --- | --- |
| 年度補助總額 | 原則 NT$ **150,000**／學生／學年（`hk_funding_rules`） |
| Grant vs Reward | **分開**（`approved_grant_amount` ≠ `reward_amount`） |
| Living allowance | `hk_living_allowance_rules`（級距見 BUSINESS-RULES；不明項標 `needs_policy_confirmation`） |
| Disbursement | `hk_disbursement_plans` / `milestones` / `disbursements`；狀態含 Eligible → Ready → Submitted for Payment → Paid／Failed |
| Follow-up 連動 | `blocks_disbursement` + `disbursement_milestone` |
| 禁止 | 成果通過就自動寫「已核發」（真匯款由承辦／財務更新） |

各 Category 補助上限／階段數／時數等 → 見實作計畫與 `docs/BUSINESS-RULES.md`（實作階段產出）。

---

## 10. PDF / 文件連結

| 連結 | 路徑概念 | 可見內容 |
| --- | --- | --- |
| Private Document | `/doc/{secure-token}` | 需登入；Preview／Download／Print |
| Public Verify（QR） | `/verify/{random-token}` | 僅有效性、文件編號、類別、版本、日期、Current／Superseded；**無** PII／全文／下載 |

PDF 用 immutable submission snapshot；QR 與 private link **必須分離**。

---

## 11. 系輔導老師

- Collections：`hk_counselors`、`hk_department_counselors`
- 第一版**可不**做 Counselor login
- 學生依系所顯示聯絡；PDF 簽核區帶入；承辦可確認簽章對象
- `signature_mode`：paper／electronic／hybrid（架構不寫死紙本）

---

## 12. UI/UX

- **禁止**整站從零重設計。
- 沿用既有 Design System（SaaS／CRM、tokens、common components）。
- 僅為新能力適配：學年度進度、核發／獎勵、雙入口、Counselor、FAQ、Department 聯絡、Dashboard 指標等。

---

## 13. Cloudflare 平台

允許：Workers、Queues、Cron Triggers、Secrets、Rate Limits、WAF、Bindings。  
PDF：Worker-compatible 且記憶體／字型合格才搬；否則保留獨立 PDF Service。

Mail：Provider abstraction；未設定則 Disabled，站內通知仍可用。業務成功**不因** Email 失敗 rollback。

---

## 14. 安全（摘要）

Defense in depth：CF Authorization + PocketBase Rules + DB constraints。  
CORS：Browser → 僅 CF origins；PB 不對 Browser 公開 `*`。  
附件：extension／MIME／magic／size／SHA-256／ownership／scope；無 public URL。  
Staff **不可**改學生原始答案（僅 Returned for Edit）。

---

## 15. 文件產出清單（本波與後續）

| Doc | 時機 |
| --- | --- |
| `MASTER-REQUIREMENTS.md` | 本波（本檔） |
| `CURRENT-ARCHITECTURE-AUDIT.md` | 本波 |
| `IMPLEMENTATION-PLAN-HK-CLOUDFLARE.md` | 本波（確認後才實作） |
| `BUSINESS-RULES.md` / `CLOUDFLARE-ARCHITECTURE.md` / `POCKETBASE-DATA-LAYER.md` / `AUTH-GATEWAY.md` / … | 實作波次 |
| `POLICY-OPEN-QUESTIONS.md` | 實作波次持續更新 |

---

## 16. 明確非目標（本波）

- 不砍現有 UI 重做  
- 不 Big Bang 刪 `pb_hooks`  
- 不 production migrate／deploy／push  
- 不猜測說明會歧義規則  
- 不把 PocketBase 跑在 Workers 上  
