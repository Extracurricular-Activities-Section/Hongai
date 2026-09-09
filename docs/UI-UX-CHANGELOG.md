# UI/UX Changelog

弘愛築夢申請管理系統 — 全站介面重構紀錄。

> 範圍：**只有前端呈現層**。PocketBase schema、`pb_hooks`、API rules、驗證語意、工作流程狀態機、權限判斷一律未更動。
> 設計規範見 `DESIGN-SYSTEM.md`，流程見 `UX-FLOWS.md`，改版前問題清單見 `UI-UX-AUDIT.md`。

---

## 本次重構（Modern SaaS / CRM Workspace）

### 新增

**Design Tokens**

- `src/styles/tokens.css` — 色彩、字級、圓角、陰影、動態、層級的單一來源（Tailwind v4 `@theme`）。暖白外殼 + 白色表面 + 近黑 ink 面板 + 單一萊姆重點色。
- `src/index.css` — 匯入 tokens、設定 antialiasing、字體堆疊與全域 focus 樣式。

**UI Primitives**（`src/components/ui/`）

- 新增 `badge`、`skeleton`、`dialog`（Radix）、`tabs`（WAI-ARIA）。
- `dialog` 取代原本自製的 modal，補上 focus trap 與 Esc 關閉。

**共用元件**（`src/components/common/`）

- `page-header`、`metric`、`states`（`EmptyState` / `ErrorState` / `InlineNotice` / `PageSkeleton` / `PageLoader`）、`filter-bar`、`data-table`、`process-stepper`、`timeline`、`context-panel`、`sticky-action-bar`、`save-indicator`、`field`、`auth-card`、`task-card`、`amount-display`、`index.ts`。

**其他**

- `src/lib/status/tone.ts` — 狀態 → Badge tone 的唯一對照表。

### 變更

**Primitives**

- `button` — 改 pill 形，新增 `brand`（萊姆主 CTA）、`danger`、`danger-outline`、`ghost`、`link` 變體與 `icon-sm` / `icon` / `icon-lg` 尺寸。
- `input` — 統一高度與 focus 行為，新增 `Textarea`、`Select`。
- `card`、`label`、`separator`、`sheet` — 全面改用 token。

**Layout**

- `admin-layout` — 深色 ink sidebar，導覽依「工作區 / 案件 / 設定」分組，active 項以萊姆指示。
- `student-layout` — 主導覽精簡為 5 項，歷史申請併入「我的資料」。
- `public-layout` — 左右分割（品牌欄 + 內容），行動版退化為精簡 header。
- `placeholder-page` — 改用 `EmptyState`。
- `error-boundary` — 重新設計，提供重新載入與返回首頁兩個出口。
- `app/router/index.tsx` — `/admin/login` 移出 `PublicLayout` 成為獨立路由；Form Builder 的 Suspense fallback 改用骨架。

**學生端**

- 首頁 — 本期梯次 Hero、指標列、「需要你處理」清單。
- 本期申請 — 類別卡片重排，修正原本 stretched link 與按鈕點擊區重疊的問題。
- 填表工作區 — 頂部狀態列 + 左側區段導覽 + 固定寬度表單 + 底部固定操作列 + 自動儲存指示。
- `dynamic-form-renderer` — 改走 `Field`，補上 label 關聯、`aria-describedby`、`aria-invalid`；checkbox / radio / textarea 樣式統一。
- `student-pdf-panel` — 以 `ProcessStepper` 攤平「填寫 → 產生 → 簽名 → 送交」流程，舊版本收進可展開區塊。
- `secure-file-upload` — 虛線投放區、檔案清單 icon 操作、原地預覽。
- 通知、追蹤任務、歷史、登入、註冊、登入協助、404 — 套用新版元件與狀態規範。

**後台**

- 儀表板 — 改為行動導向，指標可點擊帶入已篩選的列表。
- 申請案件列表 — `FilterBar` + 高密度 `DataTable` + 整列可點 + 分頁。
- 案件詳情 — 70/30 分欄，主區用 Tabs，右欄 `ContextPanel` 放摘要、歷程與情境動作。
- 追蹤任務、通知中心 — 套用 `FilterBar` 與 `TaskCard`。
- `confirm-dialog` — 改用 Radix `Dialog`。

**Form Builder**（視覺與無障礙，拖曳行為未動）

- 頁面 — 滿版高度三欄；新增工具型 topbar（返回、名稱／版本、儲存狀態 Badge、復原／重做、預覽、發布）；小螢幕改顯示 `EmptyState` 並保留預覽入口。
- `canvas` — icon 按鈕取代文字按鈕（拖曳、上下移、複製、刪除），hover / focus 顯現，全部具 `aria-label`；選取狀態以 accent 標示。
- `palette` — 卡片式欄位型別清單。
- `settings-panel` — 面板化外框，標題顯示目前選取對象；未選取時給明確引導。
- `preview-modal` — 改用 Radix `Dialog`，桌機／手機寬度切換改為具 `aria-pressed` 的 icon 按鈕。

**全站一致性清理**

- 移除散落的 Tailwind 預設色（`text-red-700`、`text-emerald-800`、`text-amber-700/800`），改用 `danger` / `success` / `warning` token。
- 頁面 H1 統一為 `text-page font-semibold text-foreground`。
- 純文字「載入中…」改為 `PageSkeleton`。
- 原生 `<select>` / `<textarea>` 的 inline class 統一為與 `Input` 一致的樣式。
- Auth guard 的等待畫面改用 `PageLoader`。

### 未變更（明確保留）

- PocketBase collections、`pb_hooks`、`pb_migrations`、API rules。
- 認證、授權、路由守衛的判斷邏輯。
- 表單引擎的驗證規則、條件規則、computed fields。
- 申請工作流程狀態機與所有狀態轉換條件。
- PDF 產生、附件安全檢查、通知寄送的行為。
- 相依套件清單（未新增任何 dependency）。

---

## 驗證

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run lint` | 通過（僅既有 warning，見 `LINT-WARNINGS.md`） |
| `npm run build` | 通過 |
| `npm run dev` | 正常啟動 |

**未執行**：瀏覽器自動化視覺 QA 與 aria snapshot 稽核 — 此環境未提供瀏覽器工具。無障礙改動採原始碼層級落實（語意標籤、`aria-label`、`aria-live`、focus 管理、對比計算），建議上線前於瀏覽器補一次實測。
