# 弘愛築夢 — 第二輪獨立複核與可批准修改清單

| 項目 | 內容 |
| --- | --- |
| 日期 | 2026-11-25 |
| 依據 | [`docs/ACCEPTANCE-PRELAUNCH-2026-11-25.md`](./ACCEPTANCE-PRELAUNCH-2026-11-25.md)（線索，非背書） |
| GitHub／HEAD | `a0e9219`（`master` = `origin/master`） |
| 本機工作樹 | HEAD **之上**另有未提交修改（見下表）；**已保留、本輪未改任何程式／設定／DB** |
| 實際驗證版本 | 優先複核項皆標明 **HEAD** 與 **WT（工作樹）**；未標者為兩版相同 |
| 方法 | 程式碼複核、`git show`／`git diff`；**無**登入後實測、無 iPhone Safari、無正式站探測、無合成帳號 E2E |
| 本輪產出 | 複核結論 + **FIX-xx 清單**；**停下等你指定編號再改** |

### 未提交變更（WT only，不可拿來替 HEAD 背書）

| 檔案 | 與五項／優先複核關係 |
| --- | --- |
| `student-submit-panel.tsx` | 送件→列印（#2） |
| `dashboard-page.tsx`、`admin-read.ts`、`applications-page.tsx`、types／api | 等我處理＋queue（#5） |
| `home-page.tsx` | 兩卡互換（#3） |
| `admin-layout.tsx` | 側欄改名（#4） |
| `form_v1_definitions.js`、`patch-external-competition-unit.mjs`、`MASTER-REQUIREMENTS.md` | 生輔組文案（#1） |
| `student-flow.ts`、`category-form-page.tsx`、`current-page.tsx`、`forms/api` | 草稿覆蓋（非本輪三優先，仍未實測） |

**未改動（HEAD = WT）**：`auth-student.ts`、`admin-applications.ts`、attachments／signatures／pdf／csv／auth-staff 等授權核心。

---

## 1. 上線結論（第二輪）

### **暫不建議上線**（維持）

理由（複核後仍成立）：

1. **P0-1（HEAD=WT）** 公開註冊仍可覆寫既有學生密碼與身分／聯絡欄位 — **確認仍存在**。
2. **P0-2（HEAD=WT）** 承辦 list／summary／detail／action／funding／附件／簽名／PDF 下載均無類別 scope；僅 CSV 匯出與項目統計有 — **確認仍存在**。「能看」與「能改」在現況幾乎同為「任一 staff 全庫」。
3. **核心流程登入後實測仍缺** → 依規則不得判流程通過。
4. GO-LIVE BLOCKER／mail／排程／備份等上線準備 — **未驗證完成**（文件仍多未勾）。

五項近期修改：**僅存在於 WT**（除紙本課指組文案 HEAD 已有）。不可說「GitHub a0e9219 已具備送件列印／等我處理合併／首頁對調／側欄改名／seed 生輔組」。

### 最先該改的三項（建議批准順序）

1. **FIX-01** ← P0-1 註冊不得動既有帳號  
2. **FIX-02** ← P0-2 承辦案件伺服器端 scope（讀／寫分開套用）  
3. **FIX-04** ← #2 送件列印改釘 `application.id`（僅 WT 有導航；HEAD 尚無此功能）

（**FIX-03**「等我處理＋待核定權限」依賴 **CONFIRM-01** 核定權定義，建議與 FIX-02 一併設計。）

### 仍缺的證據

- 隔離環境合成帳號：註冊／登入／填表／送件／列印／退補件／簽核／核定／通知  
- 雙梯次同 category 實測  
- Live／staging 已發布表單是否顯示「學務處生輔組」  
- iPhone Safari；固定環境效能數字  
- 正式 mail／cron／PDF／備份還原簽署  

---

## 2. 第一輪發現複核狀態

圖例：**確認仍存在**｜**目前版本已修正**｜**未能重現**｜**原判斷撤回**｜**證據不足**｜**僅 WT 適用**｜**僅 HEAD 適用**

| 原 ID／項 | 複核狀態 | 版本 | 預期 | 實際＋證據 | 方法 |
| --- | --- | --- | --- | --- | --- |
| P0-1 註冊覆寫 | **確認仍存在** | HEAD=WT | 重複註冊不動密碼／身分／聯絡 | `existing` 時 `update(...profileFields)` 含 `password`／`identity_*`／姓名電話等（`auth-student.ts:166-201`） | 程式碼 |
| P0-2 承辦 scope | **確認仍存在** | HEAD=WT | 各 surface 有範圍 | 見 §3.2 矩陣；`authorizedCategoryCodes` 僅 csv＋stats | 程式碼 |
| #5 等我處理合併 | **僅 WT**：合併有；權限過濾 **確認仍缺**。**HEAD**：獨立待核定卡仍在，卡連到僅 `submitted` | 分版 | 四態＋有權待核定；卡＝清單 | WT：`AWAITING_ME_STATUSES` 含 5 態，無 funding 權／scope；HEAD 無 queue | diff＋程式碼 |
| #2 送件列印 | **僅 WT 部分達成**；釘 id **確認仍缺**。HEAD **無**自動列印 | 分版 | 釘剛送案件 id；失敗／草稿不跳 | WT navigate 僅 category；API 有 `application.id` 未用；失敗／草稿不導 print | diff＋程式碼 |
| #3 首頁兩卡 | **僅 WT 已對調**；HEAD 舊順序 | 分版 | 只互換 | WT diff 僅交換兩 Metric 區塊 | diff |
| #4 側欄改名 | **僅 WT 已改**；路由／`isAdmin` **確認不變** | 分版 | label 改、權限不變 | `admin-layout.tsx` 僅 label；route `/admin/notifications/outreach` | diff |
| #1 生輔組＋課指組 | Seed／docs **僅 WT**；紙本 H101 **HEAD=WT 保留**；已發布表單 **證據不足** | 分版 | 顯示生輔組；紙本課指組 | seed help_text；print 組件仍課指組；DB **未驗證** | 程式碼 |
| P1-1 lockout | **確認仍存在** | HEAD=WT | 登入失敗鎖定 | login 無 failed_login 遞增；僅註冊清零 | 程式碼 |
| P1-2 login 洩漏 | **確認仍存在** | HEAD=WT | 脫敏 | `studentAuthWithLast4` 原樣回傳 PB auth JSON | 程式碼 |
| P1-3 簽名影像 | **確認仍存在** | HEAD=WT | 最小化暴露 | staff GET 簽名無 category scope（上輪證據；本輪未改檔） | 程式碼（證據不足→部分重讀路由存在） |
| P1-4 錯誤訊息 | **確認仍存在**（模式仍在） | HEAD=WT | 對外固定文案 | register 等仍回 `err.message` | 程式碼 |
| P1-5 .env.example | **確認仍存在** | HEAD=WT | 無弱預設 | `HK_PDF_SERVICE_SECRET=hk-dev-pdf-secret` 等 | 設定 |
| P1-6 identity_hash | **確認仍存在** | HEAD=WT | salted／加密 | 註冊仍 `sha256Hex(identityNumber)` | 程式碼 |
| P1-7 mail body | **證據不足→傾向仍存在** | HEAD=WT | 本輪未逐行重讀 deliveryToPlain | 上輪線索；檔未在 WT diff | 需再讀／標證據不足 |
| 完成填寫連點 | **確認仍存在** | HEAD≈WT（表單頁有 WT 覆蓋 UI，complete 仍無 busy） | 防連點 | `handleComplete` 按鈕無 disabled busy | 程式碼 |
| 核心 E2E／Safari／效能數字 | **證據不足／未驗證** | — | 實測 | 本輪仍無隔離帳號 | — |
| GO-LIVE／mail／cron | **未驗證** | — | 清單勾完 | 文件未勾；未連正式設定 | 文件 |

### 新發現（第一輪未單獨成項或需拆開）

| 編號線索 | 內容 |
| --- | --- |
| N1 | **系統無 `can_decide_funding`**；「有核定權限」在程式中不存在，現況＝任一 staff 可核定（超額覆寫才要 admin）。須 **CONFIRM-01** 後才能實作 FIX-03。 |
| N2 | HEAD 儀表板「等我處理」**計 4 態、連結僅 `status=submitted`**（不一致）；WT 已改為 `queue=awaiting_me` 對齊 5 態。 |
| N3 | 通知中心按鈕仍寫「經濟不利生通知」（`notifications-page.tsx:129`，HEAD=WT）— 與側欄 WT 文案不一致；P2 文案。 |
| N4 | Print／workspace **永遠綁目前開放梯次**；歷史梯次同 category 若誤開 print URL，會看到 open period 案件而非歷史案。 |

---

## 3. 三項優先複核詳述

### 3.1 FIX 目標對照：既有學生帳號保護（P0-1）

| | |
| --- | --- |
| 驗收條件 | 重複註冊不改密碼、身分、聯絡；復原走獨立且有身分驗證流程 |
| HEAD | **不合格** — 同學號走 update＋password |
| WT | **同 HEAD**（`auth-student.ts` 無 dirty） |
| 既有防護 | 身分證格式檢查；**無**「已存在則拒絕」；**無**比對 `identity_hash` 後才允許更新 |
| 身分重設 | 公開 `POST /api/hk/identity-reset` 建 pending 事件、統一回覆、**不直接改密碼**（`identity-reset.ts:140-205`）— 復原路徑獨立，但與註冊覆寫並存時仍可被註冊繞過 |
| 登入後實測 | **未驗證** |

→ 對應 **FIX-01**。

### 3.2 承辦權限 vs「等我處理」（P0-2、#5）

**授權矩陣（HEAD = WT，除非註明）** — 「能看」與「能改」分開：

| Surface | 能看（Read） | 能改（Write／Action） | Category scope？ |
| --- | --- | --- | --- |
| 申請 LIST | 任一 staff，全庫非 draft | — | **無** |
| SUMMARY／儀表板計數 | 任一 staff，全庫 | — | **無** |
| DETAIL | 任一 staff，任意案 | — | **無** |
| Workflow ACTION | — | 任一 staff（狀態機限制） | **無** |
| Funding | preview／核定：任一 staff；超額覆寫 admin | 同左 | **無** |
| 附件下載／列表 | 任一 staff 任意申請 | staff 上傳限 supplement 等規則 | **無** |
| 簽名 GET | 任一 staff | — | **無** |
| PDF 下載 | 任一 staff；產生僅學生；總表／撤銷 admin | 分項 | **無** |
| CSV 匯出 | staff＋**有** scope | 匯入 adminOnly | **有（匯出）** |
| 項目補助統計 | admin 全／staff 指派類別 | — | **有** |

**等我處理（#5）**

| | HEAD | WT |
| --- | --- | --- |
| 四態含 teacher_signed | 有（獨立於待核定） | 有，並加 funding_pending |
| 待核定併入卡片 | 否（獨立卡） | 是 |
| 僅「有核定權＋範圍內」計待核定 | 無此旗標；未濾 | **仍無** |
| 卡數字 ↔ 清單 | **不一致**（卡 4／連 submitted） | 狀態集合一致（皆 5 態、皆全庫）；**仍無** scope → 與「承辦範圍」預期不符 |
| 重複計件 | 狀態互斥，加總不重複 | 同 |

→ **FIX-02**（scope 讀寫）＋ **FIX-03**（等我處理待核定規則，需 CONFIRM-01）＋ HEAD 若上線未含 WT 則另需合併 WT 的 queue UI。

### 3.3 送件後列印正確案件（#2）

| 情境 | HEAD | WT | 判定 |
| --- | --- | --- | --- |
| 送件成功自動列印 | 無 navigate | `.../category/:code/print` | WT 有導向；**未釘 application id** |
| 已收件但清單 refresh 失敗 | N/A | `onSubmitted` 不 await；有 category 仍 navigate | **程式碼：PASS（不擋預覽）**；登入實測 **未驗證** |
| 兩梯次相同類別 | — | print／workspace = **open period** + category only | **FAIL／風險**（靜態）；實測 **未驗證** |
| 導航識別 | — | category 字串；API 回傳之 `id` **未用** | **FAIL**（相對驗收條件） |
| 存草稿／送件失敗 | 不進 print | 不進 print | **PASS**（程式碼） |

→ **FIX-04**（僅當採用 WT 送件導向時必做；若只部署 HEAD 則無此功能、亦無此 bug，但也不滿足「送件開列印」需求）。

---

## 4. 其餘五項／流程／UX／資安／上線（摘要）

| 主題 | 結論 |
| --- | --- |
| #1 文案 | WT seed＝生輔組；紙本 H101 兩版保留；**已發布表單未驗證** |
| #3 #4 | **僅 WT**；HEAD 無 |
| 老師帳號／電子簽取代紙本／P-01～P-10 | **待確認**（CONFIRM-02～），不改規則 |
| 核心流程 E2E | **未驗證**（缺隔離帳號） |
| UX：完成填寫連點、離線文案、列印 wrap | 靜態問題仍在 → FIX-08 等 |
| 效能 | **未量測** — 不作缺陷背書 |
| iPhone Safari | **未驗證**（未模擬亦未實機） |
| 資安 P1／P2、GO-LIVE | 見 FIX／未驗證表 |

---

## 5. 可逐項批准的修改清單（FIX-xx）

> 批准後再改；未列出的不要做。同一根因已合併。

### P0 — 阻擋上線

#### FIX-01｜P0｜← P0-1 註冊不得覆寫既有帳號
- **理由**：公開註冊可重設密碼並改身分／聯絡 → 帳號接管。
- **影響**：全體學生帳號；匿名攻擊面。
- **證據**：`workers/hk-api/src/routes/auth-student.ts:166-201`（HEAD=WT）。
- **建議改法**：`existing` 時 **禁止** update password／identity／聯絡；回 409 或導向身分重設；若允許「本人補登」須先驗證 `identity_hash`（或等價）且仍不隨意改密。涉及：`auth-student.ts`；必要時註冊頁錯誤文案。
- **驗收**：① 已註冊學號＋錯誤身分 → 失敗、密碼與資料不變 ② 已註冊＋正確身分 → 不建立第二帳、不改密（或明確政策）③ 新學號可註冊 ④ 復原僅經 identity-reset＋admin 流程。

#### FIX-02｜P0｜← P0-2 承辦案件伺服器端資料範圍
- **理由**：LIST／DETAIL／ACTION／FUNDING／附件／簽名／PDF 下載無 category scope；與 CSV／統計不一致。
- **影響**：所有 staff；跨單位個資與審核／核定。
- **證據**：§3.2；`authorizedCategoryCodes` 僅 `admin-applications-csv.ts`、`category-funding-stats.ts`。
- **建議改法**：抽出 `assertStaffCanAccessApplication`；**讀**與**寫**皆檢查（admin 豁免）。套用 list filter、summary、detail、action、funding、attachments、signatures、pdf download。涉及：`admin-read.ts`、`admin-applications.ts`、`attachments.ts`、`signatures.ts`、`pdf.ts`、stats helper。
- **驗收**：非授權 category → 403／404；授權可讀寫；admin 全開；CSV 與 UI list 件數在相同 filter 下一致。

#### FIX-03｜P0／P1｜← #5＋N1 等我處理之待核定規則（**依賴 CONFIRM-01**）
- **理由**：WT 已把所有 `funding_pending` 計入等我處理；無核定權旗標、無 scope。
- **影響**：儀表板與申請清單；承辦／管理員。
- **證據**：WT `dashboard-page.tsx:90-94`、`admin-read.ts:52-74`；`auth-staff.ts` 無 funding flag。
- **建議改法**：依 CONFIRM-01：新增權限旗標 **或** 定義「所有承辦範圍內 staff 皆可核定」。Summary＋`queue=awaiting_me`：**四態**對有審核範圍者計入；`funding_pending` **僅**對「可核定且範圍內」計入。卡片與 list `totalItems` 同源邏輯。
- **驗收**：無核定權者不含待核定件；有權者只見範圍內；卡數字＝清單總數；狀態不重複。

#### FIX-04｜P0／P1｜← #2 列印導航釘 application id（**WT 功能**）
- **理由**：驗收要求用提交結果的案件識別，非類別猜測。
- **影響**：學生送件後列印；雙梯次同 category。
- **證據**：WT `student-submit-panel.tsx:136-146`；print 頁僅 `categoryCode`；submit 回傳含 `id`。
- **建議改法**：navigate 帶 `application.id`（path 或 query）；print／workspace 優先依 id 載入該案（校驗歸屬學生），fallback 才用 category＋open period。涉及：router、print page、必要時 student-flow GET by id。
- **驗收**：① 送件成功開**該 id** ② refresh 失敗仍開對案 ③ 兩梯次同 category 不開錯 ④ 草稿／送件失敗不跳頁。

---

### P1 — 上線前應修

#### FIX-05｜P1｜← P1-1 學生登入 lockout
- 登入路徑實作 failed_login／locked_until；與 identity-reset unlock 對齊。`auth-student.ts`。
- **驗收**：N 次失敗鎖定；unlock 後可登；成功歸零。

#### FIX-06｜P1｜← P1-2 Login／Register 回應脫敏
- 經 `publicStudentRecord`（或等價）再回傳；勿原樣轉 PB auth JSON。
- **驗收**：login／register 無 `identity_hash`／加密欄。

#### FIX-07｜P1｜← P1-3＋P0-2 簽名與附件讀取最小化
- 簽名／附件讀取套 FIX-02 scope；評估勿預設回傳完整 data URL。
- **驗收**：跨範圍 staff 不可取他單位簽名圖。

#### FIX-08｜P1｜完成填寫防連點＋網路失敗可懂文案
- `category-form-page.tsx`：`handleComplete` busy／disabled；可選離線／網路錯誤文案。
- **驗收**：連點不重複 complete；失敗有明確下一步。

#### FIX-09｜P1｜← P1-4 對外錯誤訊息收斂
- Worker 對外固定錯誤碼＋繁中；細節僅 log。
- **驗收**：刻意 PB 失敗不回 raw upstream。

#### FIX-10｜P1｜← P1-5／P1-6 密鑰範本與身分儲存
- `.env.example` 清空弱預設；identity hash 加鹽／HMAC 與遷移計畫（可分子項）。
- **驗收**：弱 secret 拒絕或文件強制 wrangler secret；新註冊 hash 不可裸 SHA256。

#### FIX-11｜P1｜← P1-7 郵件 delivery 正文權限（先重讀確認後再改）
- adminOnly 或遮罩 body／收件者。
- **驗收**：非 admin 無全文。

---

### P2 — 後續優化

#### FIX-12｜P2｜通知中心「經濟不利生通知」文案對齊側欄
- `notifications-page.tsx:129`。

#### FIX-13｜P2｜列印長字 overflow-wrap／切頁實機回歸
- print CSS；**需**桌機＋標註是否 iPhone 模擬。

#### FIX-14｜P2｜Logout 伺服器撤銷、proxy 收斂、audit 可靠度
- 合併上輪 P2；可拆 PR。

#### FIX-15｜P2｜Dashboard follow-up 三次 list 合併（效能氣味，非量測缺陷）
- 僅在有數字基線或明顯卡頓時升級優先度。

---

## 6. 已修或不需要改／待確認／未驗證

### 已對齊或不必當 bug 重開

| 項 | 說明 |
| --- | --- |
| 紙本「課指組（H101）」 | HEAD=WT 保留；**不要**改成生輔組（除非校方另指示） |
| 附件 magic／擋裸 files／secrets scan／CSV export 有 scope | 維持；FIX-02 是補齊其他 surface |
| 身分重設公開端不洩是否存在 | 流程方向正確；不能替代 FIX-01 |
| WT：草稿／送件失敗不進 print | 行為符合；仍要 FIX-04 釘 id |
| WT：等我處理狀態互斥不重複加總 | 邏輯 OK；缺權限／scope |
| typecheck／lint／smoke 通過 | **不**等於流程或資安通過 |

### 待你或校方確認（CONFIRM）

| ID | 問題 | 影響 FIX |
| --- | --- | --- |
| **CONFIRM-01** | 「核定權限」定義：全員 staff？新旗標？僅 admin？ | FIX-03 |
| **CONFIRM-02** | 輔導老師是否要獨立登入帳號 | 流程／角色 |
| **CONFIRM-03** | 電子簽能否取代紙本送課指組，或雙軌必做 | 文案／強制門檻 |
| **CONFIRM-04** | 已發布 PB 表單是否已改生輔組；是否批准跑 patch／重新發布 | #1 關閉條件 |
| **CONFIRM-05** | POLICY P-01～P-10 哪些本學期要硬編碼 | 業務規則 |
| **CONFIRM-06** | 本輪要部署的基準：只合入 WT 五項、或先修 P0 再部署 | 發布策略 |

### 未驗證及原因

| 範圍 | 原因 |
| --- | --- |
| 登入後全流程、雙梯次列印、退補件、通知實寄 | 無隔離合成帳號／禁止碰正式資料與真實通知 |
| iPhone Safari、鍵盤遮擋、列印實機 | 未執行；禁止把未跑當通過 |
| 效能數字 | 未固定裝置／資料量／網路量測 |
| Live form 文案、mail／cron／PDF／備份 | 未連正式設定；不上正式探測 |
| P1-7 本輪逐行 | 標證據不足；批准 FIX-11 前可先重讀一行 |

---

## 7. 停駐說明

- **未**改程式、設定、資料庫；**未** commit／push／部署。  
- 請回覆要做的編號（例如：`FIX-01, FIX-02, FIX-04` 與可選 CONFIRM 決定）。  
- 未點名的 FIX／CONFIRM 本代理**不會**自行實作。
)
