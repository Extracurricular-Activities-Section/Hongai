# UI / UX Audit — 弘愛築夢申請管理系統

**Date:** 2026-09-10  
**Scope:** Presentation / IA / visual consistency only  
**Out of scope:** PocketBase schema, auth, workflow, funding/PDF business rules  

## Current Pages

### Public
- `/` 學生登入
- `/register` 註冊
- `/help` 說明
- `/admin/login` 後台登入
- `/verify/:token` 公開驗證

### Student (`/student/*`)
- 首頁、共用資料、目前申請、確認、分類表單
- 追蹤任務 / 任務詳情
- 通知 / 通知設定
- 歷史申請 / 歷史詳情 / 歷史表單

### Admin (`/admin/*`)
- 儀表板、案件列表/詳情、任務、追蹤範本
- 通知中心/範本、帳號、單位、梯次、表單、Form Builder、正式文件
- 學生資料、身分重設

## Current Components

### Layout
- `PublicLayout`, `StudentLayout`, `AdminLayout`
- Admin：flat sidebar（約 12+ 同層項目）
- Student：頂部橫向 nav + 手機 Sheet

### UI primitives (`src/components/ui`)
- button, card, input, label, separator, sheet  
- 缺：統一 PageHeader / EmptyState / Skeleton / FilterBar / ContextPanel / ProcessStepper 等

### Feature UI
- `StatusBadge`, `ConfirmDialog`, `ApplicationStatusCard`, `StudentSubmitPanel`
- `DynamicFormRenderer`, Form Builder (`palette` / `canvas` / `settings-panel` / `preview-modal`)
- `NotificationList`, `SecureFileUpload`, `StudentPdfPanel`

### Tokens (`src/index.css`)
- Tailwind v4 `@theme` + shadcn-like CSS variables
- 低彩度灰階「校務正式風」：`--primary: #334155`，**無** lime accent、無完整 semantic success/warning/danger soft tokens
- Font：`Noto Sans TC` + system；未明確含 Inter 於 stack（Prompt 要求補上）

## Duplicate Components / Patterns

- 多處手寫 `<h1 className="text-2xl font-semibold">` + muted 說明，無 PageHeader
- Loading：大量 `載入中…` 文字，非 Skeleton
- Error：`text-red-700` 散落，非統一 ErrorState
- Status 樣式：`status-labels.ts` 已有 mapping，但 badge 仍偏 ad-hoc amber/emerald，未對齊新 Design System
- Admin Dashboard：多張同構 Card grid（彩虹感風險低但仍為 template metrics）

## Inconsistent Styles

| Area | Issue |
| --- | --- |
| Radius | shadcn 預設 rounded-md；與目標 pill/CRM soft radius 不一致 |
| Primary | Slate 灰主色，非 lime accent |
| Density | Student `max-w-6xl` 居中；Admin 全寬；Form 未強制 720–840 |
| Nav active | muted accent bg，無高對比 selected |
| Buttons | outline 過多；primary CTA 不明顯 |
| Application detail | 長頁單欄堆疊（~1000 lines UI），缺 tabs + right context panel |

## UX Problems

1. 學生首頁偏「資料摘要」而非「現在要做什麼」workspace  
2. 缺少「需要你的處理」priority list 作為第一動作區  
3. 表單流程步驟感弱（無清晰 process stepper：填寫→PDF→紙本→送件）  
4. Autosave 回饋可能干擾（需改 header 狀態，而非每存必 toast）  
5. Admin Dashboard 狀態卡多，但「今日優先處理」行動清單弱  
6. 案件 Detail 資訊過載、操作按鈕可能同時過多  
7. Form Builder 仍偏工具雛形，非產品級三欄工具感  

## Navigation Problems

### Admin
- 側欄項目同層過多（儀表板、案件、任務、範本、通知×2、帳號、單位、梯次、表單、文件、學生、身分重設）
- 未分組：工作區 / 申請管理 / 行政管理 / 通知 / 系統

### Student
- 可用但文案偏系統（「學生首頁」「共用資料」）
- 個人資料在主導覽；Prompt 建議改 Account Menu
- 「歷史申請」可保留但 IA 應對齊：首頁 / 我的申請 / 後續任務 / 歷史 / 通知

## Form Problems

- Dynamic engine 邏輯完整，UX 缺：左 section nav + 右 focused form
- 缺 sticky action bar、統一 FormFieldShell、確認頁 Summary Blocks
- Repeat/monthly 仍可能偏傳統 table 感（需視覺重構，不改 schema）

## Admin Problems

- Dashboard ≠ Staff Workbench（缺 priority queue）
- Applications list 缺 CRM FilterBar 語言
- Detail 無 70/30 Context Panel（進度、金額、承辦、狀態化 actions）
- Funding / eligibility 偏表單操作，非 Financial / Eligibility Summary

## Student Problems

- Home 未強調 Current Period hero + metrics + 9 categories 統一卡
- 任務 / 通知視覺語言未統一 TaskCard / Activity Feed

## Responsive Problems

- Student 有 Sheet nav，但 workspace 卡片密度未針對 375 優化
- Admin 手機可用 Sheet，但 Detail / Builder 未宣告桌面建議
- Builder 無「建議使用桌面版」明確 empty/guard UI

## Accessibility Problems

- 多處純文字 loading，無 status live region 策略
- Focus ring 使用 `--ring: #64748b`，非 accent
- Icon buttons 部分有 aria-label（好），需全站一致性檢查
- Form errors / dialog focus 需在重構後用 `accessibility-auditing` 驗證
- `prefers-reduced-motion` 未見系統級處理

## Redesign Priorities

### P0 — Foundation
1. Design tokens（含 lime accent、semantic soft colors、radius/shadow/spacing）
2. Reusable primitives：PageHeader, StatusBadge 擴充, Metric, Empty/Error/Skeleton, FilterBar, ContextPanel, ProcessStepper, StickyActionBar
3. Admin IA 分組 sidebar + Student nav 精簡

### P1 — Core journeys
4. Student Home / Current Period / Categories / Form workspace / PDF-paper-submit stepper  
5. Admin Dashboard workbench + Applications list/detail + Funding/Eligibility summaries  
6. Tasks + Notifications visual language  

### P2 — Tools & polish
7. Form Builder chrome（topbar / palette / canvas / inspector tabs）  
8. Login split layouts  
9. RWD + a11y + visual QA + consistency pass  

## Architecture Notes (must preserve)

- Routes / guards / feature APIs remain  
- `APPLICATION_STATUS_LABELS` 等 mapping **擴充呈現**，不改狀態機  
- Form Builder DnD **視覺 only**  
- No PocketBase / auth / funding / PDF logic changes  

## Next step

等待 Cursor 模型切換為 **Claude Opus 5（thinking-high）** 後，依 `docs/UI-UX-PREPARATION.md` 進入 Design Tokens + 元件層實作。
