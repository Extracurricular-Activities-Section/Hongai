# 弘愛築夢助學金系統 — 上線前驗收報告

| 項目 | 內容 |
| --- | --- |
| 日期 | 2026-11-25 |
| 分支 | `master`（追蹤 `origin/master`） |
| HEAD commit | `a0e9219` — `feat: ship backlog for validation, stats, e-sign, reports, and outreach` |
| 工作樹 | **有未提交變更**（保留未動）；主要影響五項 UX 與草稿覆蓋／`student-flow`／dashboard／sidebar／home／submit／seeds |
| 驗收方式 | 靜態程式碼＋文件對照；本機 `typecheck`／`lint`（僅 warning）／`migrate:check`／`security:secrets`／`attachment:smoke` |
| 未執行 | 正式網址掃描；正式寄信；正式 DB migration；push／部署；真實學生資料；iPhone Safari 實機；登入後端到端角色走查（無隔離假帳號就緒） |
| 自動化測試 | **無** vitest／jest／playwright／cypress；僅 smoke／preflight 腳本與測試計畫文件 |

---

## 1. 上線結論

### **暫不建議上線**

阻擋原因（任一即可擋）：

1. **專案自我宣告仍為 NOT LIVE**，`docs/GO-LIVE-CHECKLIST.md` 的 BLOCKER 多項未勾（備份還原、正式 CORS／mail／PDF／排程、資安窗口等）。
2. **核心角色流程未以隔離環境完整實測**（學生註冊→填表→送件→老師簽核→承辦→核定→通知）。依驗收規則：**核心流程未實測不得判定通過**。
3. **P0 資安**：公開註冊可覆寫既有學生並重設密碼；承辦案件讀寫／核定／附件未套用單位 scope（CSV 有、詳情沒有）。
4. **輔導老師無獨立登入角色**；電子簽與紙本「課指組」並存，校方最終流程仍有待確認項（見政策開放問題），本輪不自行裁定。

若僅論「五項近期修改」的程式層對齊：多數可過，但 #2／#5 為 PARTIAL，且 live PocketBase 已發布表單文案 **未驗證**。

---

## 2. 盤點摘要

### 2.1 產品與入口

- 學生：**弘愛築夢申請系統**（`apply.html`）
- 管理：**弘愛築夢管理系統**（`manage.html`）
- 路由權威：`src/app/router/index.tsx`
- 業務閘道：Cloudflare Worker `hongai` → PocketBase `hk_*`（service account）

### 2.2 角色（實作）

| 口語 | 系統 | 說明 |
| --- | --- | --- |
| 學生 | `hk_students` | 學號 + 身分證後四碼 |
| 承辦 | `hk_staff_users`（`is_staff`） | Manage 登入 |
| 管理員 | 同 collection（`is_admin`） | 可與 staff 並存 |
| 輔導老師 | **非登入角色** | `hk_counselors`／紙本或 staff 代標 `teacher_signed`／電子簽面板 | **待確認**與校方是否要老師帳號 |

### 2.3 申請狀態（Worker 權威）

`draft` → `submitted` → `teacher_signed` → `eligibility_review` → `under_review` →（`supplement_required`｜`returned_for_edit`）→ `approved`｜`rejected` → `funding_pending` → `funding_decided` → `closed`

轉換表：`workers/hk-api/src/lib/application-workflow.ts`；說明：`docs/APPLICATION-WORKFLOW.md`。

### 2.4 校方規則 Confirmed vs 待確認

- Confirmed（規劃鎖定）：`docs/MASTER-REQUIREMENTS.md`、`APPLICATION-WORKFLOW.md`、`ACADEMIC-YEAR-RULES.md` 等。
- **待確認（不自行決定）**：`docs/POLICY-OPEN-QUESTIONS.md` P-01～P-10（第六級金額、學年末 hard block、海外額度、生活補助互斥、獎勵觸發、正式網域、Cookie、Staff 發布預設等）。
- 老師電子簽 vs 紙本送課指組：系統兩者皆有路徑；**最終以校方規則為準，本輪標待確認**。

---

## 3. 五項近期修改驗收

| # | 需求 | 判定 | 方法 | 證據摘要 |
| --- | --- | --- | --- | --- |
| 1 | 黃標／承辦文案「學務處生輔組」；紙本「課指組（H101）」保留 | **PASS（code／seed）**／**UNVERIFIED（已發布 DB）** | 靜態 | Seed：`pb_migrations/seeds/form_v1_definitions.js:490-491`；紙本：`student-paper-panel.tsx:34-35`、`application-print-document.tsx:307-308` 仍為課指組（H101）。Live form 需人工確認是否已 republish／patch。 |
| 2 | 正式送件成功→該案列印預覽；草稿／失敗不跳 | **PARTIAL** | 靜態 | 成功：`student-submit-panel.tsx:136-146` navigate print；失敗 catch 不導；草稿離開不進 print。`onSubmitted` 的 list refresh 失敗不擋導向（符合「後端已收件仍開預覽」）。風險：print 以 `categoryCode` 開目前梯次 workspace，path 無 application id；`load()` 跨梯次同 category fallback 可能錯案（同檔 ~55-59）。雙梯次同類別：**未實測**。 |
| 3 | 首頁兩卡只互換 | **PASS** | 靜態 | `home-page.tsx:240-253`：目前核定總額 → 待處理任務；其餘卡不動。 |
| 4 | 側欄「經濟與文化不利學生」；路由／權限不變 | **PASS** | 靜態 | `admin-layout.tsx:172-178`：`/admin/notifications/outreach`、`show: isAdmin`。通知中心內按鈕文案仍可能寫「經濟不利生…」（非側欄，PARTIAL 文案一致）。 |
| 5 | 待核定併入「等我處理」；四態+老師已簽核；核定權／範圍過濾 | **PARTIAL** | 靜態 | 獨立待核定卡已移除；`dashboard-page.tsx:21-26,90-94` 與 `admin-read.ts:52-58` 同源含 `funding_pending`＋四態（含 `teacher_signed`），狀態互斥不重複計。**未**依「有核定權限／承辦範圍」過濾 `funding_pending`；list／summary 亦未套 `authorizedCategoryCodes`。下方另有「待核發」連到 `funding_decided` 易混淆（P2）。 |

---

## 4. 角色／流程覆蓋表

圖例：✅ 通過｜❌ 失敗｜⚠️ PARTIAL｜➖ 未實作／非角色｜🔍 未驗證（需隔離環境實測）｜❓ 待校方確認

### 4.1 學生端

| 流程 | 預期 | 實際／證據 | 判定 |
| --- | --- | --- | --- |
| 首次註冊 | 新學號建立；已存在不可被陌生人接管 | 同學號可 update 含 `password`=`identityLast4`（`auth-student.ts:166-201`） | ❌ P0 |
| 登入 | 學號+後四碼；失敗有清楚訊息 | Worker 登入路徑；**無 lockout 遞增** | ⚠️／🔍 |
| 登入協助／身分重設 | 公開申請＋admin 處理 | 路由與 API 存在 | 🔍 |
| 首頁待辦／指標 | 可懂；兩卡位置已換 | 指標卡靜態 OK | ⚠️ 位置 PASS；內容 🔍 |
| 選類別／填表／草稿 | 可存可續；防連點；斷線可懂 | debounce 存檔 OK；「完成填寫」無 busy（`category-form-page`）；無離線專用文案 | ⚠️ |
| 附件 | 類型／大小限制前後端一致 | 預設 10MB smoke OK；form 欄位 max 可與 Worker 脫鉤 | ⚠️ |
| 送件→列印 | 成功進 print；失敗不跳 | 程式 PARTIAL（見五項#2） | ⚠️／🔍 |
| 申請歷史／通知／退補件 | 清單正確、可回覆 | 路由與 API 存在 | 🔍 |
| 草稿覆蓋最新表單 | 可重填 | 本輪有 reset-overwrite／UI；**未以真帳號回歸** | 🔍 |

### 4.2 老師／後台

| 流程 | 預期 | 實際／證據 | 判定 |
| --- | --- | --- | --- |
| 老師登入簽核 | 若校方要老師帳號 | **無老師 login**；staff 標記或電子簽面板 | ❓／➖ |
| 紙本流程 | 列印簽名送課指組 | 文案保留課指組（H101） | ⚠️ 文案有；實測 🔍 |
| 電子簽 | 與紙本一致或明確分流 | Canvas 簽名存 `workflow_json`；任意 staff 可取圖 | ❓＋⚠️ 資安 |
| 承辦審核／退補件／核定 | 僅範圍內案件；交接清單正確 | 狀態機有；**scope 未套 detail／action／funding** | ❌ P0／🔍 |
| 等我處理清單 | 與卡片數字一致；待核定有權才見 | 狀態集合一致；權限過濾缺 | ⚠️ |
| 經濟與文化不利／批次通知 | Admin；影響範圍清楚 | Outreach adminOnly＋audit；**未實測寄送**（禁止正式寄） | 🔍 |
| CSV 匯入匯出 | 範圍正確 | Export 有 scope；與 UI list 不一致 | ⚠️ |
| 統計 | 正確 | category funding stats 有 scope | 🔍 |
| 身分重設 | Admin／稽核 | API＋audit 有 | 🔍 |

### 4.3 裝置／UX／效能

| 項目 | 判定 | 說明 |
| --- | --- | --- |
| 桌機瀏覽器核心流程 | 🔍 | 本輪未登入走完 |
| 手機尺寸（模擬） | 🔍 | 靜態：學生／管理 layout 有 RWD；Form Builder 刻意 ≥1024 |
| **iPhone Safari** | 🔍 **未做** | 依要求照實標註 |
| 鍵盤／焦點／對比 | 🔍 | 未跑 accessibility 實測；Design System／Radix 存在 |
| 列印截字切頁 | ⚠️／🔍 | 有 `@page`／avoid-break；長字無 wrap；實機未測 |
| 效能量測 | 🔍 | **無數字**：未在固定環境量首頁／清單／上傳／送件預覽。靜態氣味：dashboard 三次 follow-up list |
| 破壞性情境（漏填、重整、慢網、重複點擊） | ⚠️ | 送件 busy OK；完成填寫可連點；離線無專用訊息 |

### 4.4 本機指令結果（證據）

| 指令 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run lint` | 通過（多為 React Compiler／fast-refresh **warning**） |
| `npm run migrate:check` | OK（2 檔；未連 PB） |
| `npm run security:secrets` | `ok: true`，findings 空 |
| `npm run attachment:smoke` | `ok: true` |

---

## 5. 資安與個資（靜態）

> 僅程式／設定審查；無攻擊腳本、無正式探測。

### P0（阻擋）

| ID | 影響 | 證據 | 建議修法 | 回歸條件 |
| --- | --- | --- | --- | --- |
| P0-1 | 匿名可用同學號註冊覆寫密碼→帳號接管 | `auth-student.ts:166-201`（`profileFields` 含 password） | 已存在則拒絕或驗證 identity_hash；**禁止**覆寫 password | 已註冊＋錯身分→失敗且密碼不變 |
| P0-2 | 任意 staff 跨單位讀寫／核定／附件／簽名 | `authorizedCategoryCodes` 僅 CSV；detail／funding／attachments 僅 `requireStaff` | 統一 `assertStaffCanAccessApplication` | 非授權 category→403／404；CSV 與 list 件數一致 |

### P1（上線前應修）

| ID | 摘要 |
| --- | --- |
| P1-1 | 學生密碼＝末四碼；Worker 登入無 lockout |
| P1-2 | Login／register 回應可能帶 `identity_hash`／`identity_last4` |
| P1-3 | 簽名 PNG data URL 存 workflow；staff 可取完整影像 |
| P1-4 | 錯誤常回傳 upstream `Error.message` |
| P1-5 | `.env.example` 弱開發 secret 預設（誤用風險） |
| P1-6 | `identity_hash` 無鹽 SHA-256；`identity_encrypted` 未寫 |
| P1-7 | 郵件 delivery 詳情對一般 staff 暴露正文／收件者 |

### P2（後續）

Logout 無伺服器撤銷；`/api/collections/*` proxy 殘留面；audit best-effort；通知 contains 過濾等。

### 相對良好

附件 magic／類型封鎖、擋裸 `/api/files`、CSV export scope、outreach adminOnly＋audit、identity-reset 公開端不洩是否存在、CORS allowlist、secrets scan 通過。

---

## 6. 優先修三項（建議下一輪實作順序）

1. **P0-1 註冊覆寫／密碼重設** — 阻擋帳號安全。
2. **P0-2 承辦案件資料範圍**（list／detail／action／funding／attachments／signatures／PDF 一致）。
3. **五項 #5 補齊**：`funding_pending` 僅對可核定者計入「等我處理」；並與 scope 對齊；同時在 **staging** 用假帳號跑通學生送件→列印與雙梯次同類別案例。

---

## 7. 尚未驗證範圍（不可寫成通過）

- 任何需登入的端到端：註冊、填表、送件、列印預覽、退補件、通知、老師簽核、承辦全流程、核定、身分重設、outreach 寄送。
- iPhone Safari／實機列印與鍵盤遮擋。
- 效能數字（首頁、清單分頁、上傳、送件後預覽）。
- Live PocketBase 已發布表單是否已是「學務處生輔組」。
- Production mail／cron／PDF sidecar／WAF／備份還原演練。
- Playwright／E2E 自動化（尚未建置）。
- 政策開放問題 P-01～P-10 的校方定案。

---

## 8. 方法論聲明

| 類型 | 本報告用法 |
| --- | --- |
| 靜態審查 | 路由、狀態機、五項 diff、資安、UX 韌性 |
| 本機指令 | typecheck／lint／migrate:check／secrets／attachment smoke |
| 實測（登入後） | **未執行** — 標 🔍 |
| 待確認 | 老師角色、電子簽 vs 紙本最終規則、政策 P-01～P-10 |

**未提交變更已保留，本輪未改功能碼、未 push、未部署、未動正式資料。**
)
