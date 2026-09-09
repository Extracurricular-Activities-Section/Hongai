# Design System

弘愛築夢申請管理系統 — UI 設計語言與元件規範。

> 定位：**Modern SaaS / CRM Workspace**。專業、資訊密度高、可長時間操作。
> 本文件描述「怎麼長」，不涉及業務邏輯；商業規則見 `APPLICATION-WORKFLOW.md`、`FORM-ENGINE.md`。

---

## 1. 設計原則

| 原則 | 說明 |
| --- | --- |
| 內容優先 | 版面服務資料。不用裝飾性漸層、光暈、玻璃擬態撐場面。 |
| 一個重點色 | 螢光萊姆只給「現在該做的那一件事」。其餘一律中性灰階。 |
| 密度可讀 | 後台採高密度表格；學生端放寬行距，降低填表壓力。 |
| 狀態明確 | 每個非同步區域都要有 loading / empty / error 三態，不留白畫面。 |
| 語意先於樣式 | 先選對 HTML 元素與 ARIA，再談視覺。 |

### 禁止事項

- 紫藍漸層、霓虹、賽博龐克、玻璃擬態、大面積模糊。
- Bootstrap／Material 預設外觀。
- 圖庫照片、裝飾性插圖。
- 用顏色作為唯一的狀態訊號（一律搭配文字標籤）。

---

## 2. Design Tokens

單一來源：`src/styles/tokens.css`（Tailwind v4 `@theme`）。所有色票、字級、圓角、陰影都必須從 token 取用，禁止在元件內寫死 hex。

### 2.1 表面（Surface）

| Token | 值 | 用途 |
| --- | --- | --- |
| `bg` | `#f6f6f3` | 應用外殼背景（暖白） |
| `surface` | `#ffffff` | 卡片、表格、面板 |
| `surface-muted` | `#f1f1ec` | 次級區塊、表頭、hover |
| `surface-sunken` | `#eaeae4` | 內凹區、icon 按鈕 hover |
| `surface-strong` | `#16181a` | 深色 ink 面板（Admin sidebar、品牌欄） |
| `surface-strong-muted` | `#24272a` | ink 面板上的次級表面 |

### 2.2 文字

| Token | 值 | 用途 |
| --- | --- | --- |
| `foreground` / `text-primary` | `#14171a` | 主文字 |
| `subtle` / `text-secondary` | `#565b61` | 說明文字 |
| `muted-foreground` | `#676d74` | Meta、標籤 |
| `ink-foreground` | `#f7f8f5` | 深色面板上的主文字 |
| `ink-subtle` | `#a7adb3` | 深色面板上的次要文字 |

### 2.3 邊框

`border`（`#e3e3dd`）為預設分隔線；`border-strong`（`#cbcbc2`）用於輸入框與 hover；`ink-border`（`#33373b`）用於深色面板。

### 2.4 Accent（萊姆）

| Token | 值 | 用途 |
| --- | --- | --- |
| `accent` | `#b7f45b` | 主要 CTA 底色、active nav 指示 |
| `accent-hover` | `#a9ea46` | CTA hover |
| `accent-soft` | `#edfbd4` | 選取列底色、目前步驟底色 |
| `accent-strong` | `#5f8f14` | **文字／icon／focus ring**（`#b7f45b` 對白底不符 AA，文字一律用此值） |
| `accent-foreground` | `#13201c` | 萊姆底上的文字 |

**使用配額**：一個畫面最多一處萊姆填色。允許位置 — 主要 CTA、目前導覽項、選取狀態、目前步驟、focus ring、關鍵數字。

### 2.5 語意色

`success` / `warning` / `danger` / `info` 各有 `-soft`（底）與 `-border`（框）。深色前景全部通過 WCAG AA（≥ 4.5:1 於對應 soft 底）。

### 2.6 字級

| Token | Size / Line-height | 用途 |
| --- | --- | --- |
| `text-display` | 36px / 1.15 | 品牌欄、Hero |
| `text-page` | 28px / 1.25 | 頁面 H1 |
| `text-section` | 20px / 1.35 | 區段 H2 |
| `text-card` | 16px / 1.45 | 卡片 H3 |
| `text-sm` | 14px | 內文 |
| `text-meta` | 13px | 標籤、時間、輔助說明 |
| `text-metric` | 32px / 1.05 | 指標數字 |

字體堆疊：`Inter, Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui`。數字一律加 `.tabular`（`font-variant-numeric: tabular-nums`）以對齊金額與日期。

### 2.7 圓角、陰影、動態

- 圓角：`sm 6px` / `md 10px` / `lg 14px` / `xl 18px` / `pill`（按鈕、Badge、Avatar）。
- 陰影：只有三階 `xs / sm / md`。卡片預設 `xs`，浮層才用 `md`。
- 動態：預設 180ms `cubic-bezier(0.25, 1, 0.5, 1)`。只動 `opacity` / `transform` / `color`。
- 層級：`sticky 20` / `dropdown 30` / `overlay 40` / `modal 50` / `toast 60`。

---

## 3. UI Primitives（`src/components/ui/`）

React 19，無 `forwardRef`；`ref` 直接當 prop 傳遞。

| 元件 | 重點 |
| --- | --- |
| `button` | 變體 `default / brand / secondary / outline / ghost / danger / danger-outline / link`；尺寸 `sm / default / lg / icon-sm / icon / icon-lg`。全部 pill 形；`brand` 為萊姆主 CTA，一畫面一個。 |
| `input` / `textarea` / `select` | 統一 40px 高、`border-strong` 邊框、focus 時邊框轉 `accent-strong` 並顯示 ring。 |
| `card` | `surface` 底 + `border` + `shadow-xs`。含 `CardHeader / CardTitle / CardDescription / CardContent / CardFooter`。 |
| `badge` | `tone`：`neutral / outline / progress / attention / positive / critical / brand / ink`。附 `Badge.Dot` 供狀態點使用。 |
| `dialog` | Radix 封裝，內建 focus trap、Esc 關閉、`DialogTitle` 必填。 |
| `tabs` | 手寫 WAI-ARIA tabs（roving tabindex、方向鍵切換）。 |
| `skeleton` | 含 `SkeletonList / SkeletonTable / SkeletonMetrics`。 |
| `sheet` | 行動版導覽抽屜。 |
| `label` / `separator` | 已改用 token。 |

---

## 4. 共用元件（`src/components/common/`）

| 元件 | 用途 |
| --- | --- |
| `PageHeader` / `SectionHeader` | 統一頁首：eyebrow、標題、描述、右側動作、返回連結。 |
| `Metric` / `MetricRow` | 指標數字卡；可掛連結成為可點擊入口。 |
| `EmptyState` / `ErrorState` / `InlineNotice` | 三態回饋。`InlineNotice` 有 `info / attention / positive / critical`。 |
| `PageSkeleton` / `PageLoader` | 頁內載入骨架／全頁等待（auth 還原時使用）。 |
| `FilterBar` / `SearchInput` / `FilterSelect` | 列表頁篩選列。 |
| `DataTable` / `Th` / `Td` / `LinkRow` / `Pagination` | 後台高密度表格，整列可點。 |
| `ProcessStepper` / `StepRail` | 水平流程指示／左側區段導覽。 |
| `Timeline` | 歷程紀錄。 |
| `ContextPanel` / `ContextCard` / `ContextRow` | 詳情頁右欄 30% 脈絡區。 |
| `StickyActionBar` | 表單底部固定操作列，整合 `SaveIndicator`。 |
| `SaveIndicator` | 自動儲存狀態（idle / saving / saved / error），`aria-live="polite"`。 |
| `Field` / `useFieldProps` | 表單欄位外框：label、必填標記、說明、錯誤，自動接好 `htmlFor` / `aria-describedby` / `aria-invalid`。 |
| `AuthCard` / `AuthLink` | 公開頁登入卡片。 |
| `TaskCard` / `AttentionRow` | 任務卡與「需要你處理」列。 |
| `AmountDisplay` | 金額格式化（tabular）。 |

### 狀態色映射

`src/lib/status/tone.ts` 是狀態 → `BadgeTone` 的唯一對照表，涵蓋 `applicationStatusTone` / `eligibilityStatusTone` / `followUpStatusTone` / `periodStateTone`。新增狀態時只改這一處。

---

## 5. Layout

| Layout | 結構 |
| --- | --- |
| `AdminLayout` | 左側 240px 深色 ink rail（分組 IA：工作區 / 案件 / 設定），active 項以萊姆指示；右側內容 + 頂部 header。行動版收進 `Sheet`。 |
| `StudentLayout` | 桌機水平主導覽（5 項）+ header；行動版漢堡收進 `Sheet`。 |
| `PublicLayout` | 左右分割：左側 ink 品牌欄，右側內容；行動版退化為精簡 header。 |

`/admin/login` 為獨立路由，不套 `PublicLayout`。

---

## 6. 無障礙基準

- 所有互動元素可鍵盤到達，focus ring 使用 `accent-strong`，禁止移除且不補。
- Icon-only 按鈕必須有 `aria-label`。
- 表單欄位一律經由 `Field`，確保 label 關聯與錯誤播報。
- Dialog 必有 `DialogTitle`；Tabs 遵循 WAI-ARIA。
- 非同步狀態變化（自動儲存、載入）以 `aria-live="polite"` 播報。
- 內文對比 ≥ 4.5:1，大字 ≥ 3:1。萊姆填色只搭配 `accent-foreground`。
- 狀態不只用顏色表示，必附文字。

---

## 7. 新增畫面檢查表

1. 用 `PageHeader` 起頭，不要自己刻 H1。
2. 非同步區塊三態齊全（`PageSkeleton` / `EmptyState` / `ErrorState`）。
3. 顏色全部走 token；沒有裸 hex、沒有 `text-red-700` 這類 Tailwind 預設色。
4. 一個畫面只有一顆 `variant="brand"` 按鈕。
5. Icon-only 按鈕有 `aria-label`。
6. 數字欄位加 `.tabular`。
7. 跑 `npm run typecheck`、`npm run lint`、`npm run build`。
