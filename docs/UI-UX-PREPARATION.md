# HAD UI/UX Redesign — Preparation Gate

**Date:** 2026-09-10  
**Status:** Preparation complete · **UI code changes NOT started** (awaiting best-fit model confirmation)

---

## 【UI/UX Model Assessment】

### Available Models

Cursor agent/subagent catalog known to this session (for routing / Task):

| Model | Notes |
| --- | --- |
| Claude Opus 5 (thinking-high) | Highest quality / long-context / UX reasoning |
| Claude Fable 5 (thinking-high) | Strong reasoning alternative |
| GPT-5.5 / GPT-5.6 | Strong general coding |
| Composer 2.5 Fast | Speed-oriented coding agent |
| Grok 4.5 / 4.6 | Fast alternatives |
| **Current chat agent** | **Composer / Auto router** |

Agent **cannot** switch the Cursor chat model via tools (`SwitchMode` only covers plan/agent modes, not model ID).

### Best-fit Model

**Claude Opus 5（thinking-high）**  
（Cursor UI 顯示名稱可能為 `Claude Opus` / `claude-opus-5-thinking-high`）

### Current Model

**Composer（Auto）**

### Why

本次任務優先序為：

Quality → Repository Understanding → Refactoring Stability → Frontend → UX Reasoning → Instruction Following → Speed

全站 Design System + IA + Student/Staff/Admin + Form Builder 的視覺判斷與回歸風險，需要最高等級的 UX reasoning 與長上下文穩定重構。Composer 適合實作速度，但在「成熟 SaaS 質感／避免 AI dashboard 感／跨 60+ 檔一致性」上，Opus-class 明顯更適配。

### Suitability

**MEDIUM**（相對 Best-fit）

因此：**停止 UI 修改**，請使用者切換模型後再繼續實作階段。

---

## 請將 Cursor 模型切換為：Claude Opus 5（thinking-high）

**原因：**

1. 全站 UI/UX 大幅重構，品質優先於速度  
2. 需同時理解大型 repo、保留 business logic、轉譯參考圖語言  
3. Form Builder / Application Detail / multi-surface consistency 需要穩定長上下文判斷  

切換後回覆「已切換，繼續 Redesign」，即可從 **Design Tokens 實作（第 8–9 階段）** 開始，不必重做 Skill 搜尋。

---

## Installed Skills / Rules Inspected

| Path | Status |
| --- | --- |
| `.cursor/rules/had-ui-ux.mdc` | Loaded — project primary UI rule |
| `.cursor/skills/ui-design-brain` | Approved |
| `.cursor/skills/web-design-guidelines` | Approved |
| `.cursor/skills/vercel-composition-patterns` | Approved |
| `.cursor/skills/accessibility-auditing` | Approved |
| `.cursor/skills/visual-qa-testing` | Approved |
| `docs/AGENT-SKILLS-RESEARCH.md` | Present |
| Personal `impeccable` | Available (product register) |
| `AGENTS.md` / `CLAUDE.md` | Absent in repo |
| Playwright skill | **Not installed** (rejected earlier) |

### Skill conflicts

| Potential conflict | Resolution |
| --- | --- |
| Reference images = dark CRM；Prompt §8 = warm off-white + lime | **Prompt + 轉譯**：亮色行政殼 + dark strong surface + lime accent（見 Reference Analysis） |
| ui-design-brain / impeccable 反過度圓角 vs 參考圖大 radius | Cards `16–20px`；pills 全圓；不過度 32px+ |
| 外部 Skill vs HAD security/architecture | HAD rules 優先；Skill 不得改 stack |

---

## 【Skill Usage Plan】

| Area | Skill | 用途 |
| --- | --- | --- |
| UI / Design System | `ui-design-brain` + `had-ui-ux.mdc` | Tokens、typography、component consistency、CRM→HAD 轉譯 |
| Product craft | personal `impeccable`（product register） | Product UI 質感、反 AI slop、密度與熟悉感 |
| React / Frontend | `vercel-composition-patterns` | 可重用元件拆分、compound patterns（不改業務邏輯） |
| Accessibility | `accessibility-auditing` | Keyboard / ARIA / focus / contrast 驗證 |
| Guideline audit | `web-design-guidelines` | 完成後 UI guideline 抽查 |
| Visual QA | `visual-qa-testing` | 改完後 375 / 1440 截圖與 console 檢查 |
| Testing / Playwright | **No approved skill required** | Playwright 未安裝；用 visual-qa + typecheck/lint/build |
| Form Builder DnD | **No approved skill required** | DnD skill 先前 REJECT；僅視覺層，行為不變；必要時查官方 dnd-kit docs |

### Priority

1. 本次正式 UI/UX 指令  
2. 既有 Business Architecture  
3. Security Architecture  
4. HAD Project Rules (`had-ui-ux.mdc`)  
5. 已審核外部 Skills  

---

## Preparation Gate Checklist

- [x] Best-fit model confirmed (Claude Opus 5 thinking-high)
- [ ] Current model appropriate — **NO → waiting for user switch**
- [x] Installed Skills inspected
- [x] Skill Usage Plan created
- [x] Project UI Rule loaded
- [x] No Skill conflict (resolved by translation rules)
- [x] Existing architecture reviewed (see `docs/UI-UX-AUDIT.md`)
- [x] Reference analysis recorded (below + audit)
- [ ] UI implementation — **blocked until model switch**

---

## 【Reference Design Analysis】

來源優先：**(1) 使用者附圖 ×3 (2) 本 Prompt (3) Behance HubSpot CRM gallery（可達但以附圖為準）**

### 從附圖萃取的 Design Language（禁止 1:1 複製品牌／資產）

| Dimension | Observation | HAD 轉譯 |
| --- | --- | --- |
| Layout | 左側窄 icon rail + 主工作區 + 右側 context panel | Admin：分組 sidebar + 主區；Detail：70/30 workspace |
| Grid | 模組化橫向 section；卡片節奏清楚 | Section + Metric + Priority list + Category grid |
| Sidebar | 極簡 icon rail | 保留文字分組 IA（行政系統可讀性優先），active 用 accent |
| Header | Schedule pill / KPI 列 | Student：問候 + 梯次；Admin：工作摘要 metrics |
| Page margin | 呼吸感強 | Desktop 24–32px；內容寬度約束 |
| Content width | CRM 全寬 workspace | Form 720–840px；List/Detail 全寬 workspace |
| Card ratio | 大圓角深色卡 | 亮色 surface 卡 + 關鍵 active 用 accent / strong surface |
| Radius | 高圓角、pill filters | Cards md–lg；filters/buttons pill；避免過度可愛 |
| Border / Shadow | 細邊、克制陰影 | soft border 為主；shadow xs/sm 僅 elevate panel |
| Typography | 大標題 + 大數字 KPI + 小 meta | Display/Page/Section/Body/Meta/Metric 階層（§10） |
| Data density | 高密度但可掃描 | 表格 breathable；卡片資訊固定欄位 |
| Whitespace | 區塊間距充足 | 8px scale；section gap 一致 |
| Primary action | 白 pill CTA / lime active card | Lime accent CTA；每區一個 primary |
| Secondary | 圓形 icon actions | outline / ghost / icon button |
| Search / Filters | Pill filter row | FilterBar + SearchInput 共用元件 |
| Badges / tags | Pill + 色點 | StatusBadge 統一；來源/標籤用 muted pill |
| Tables | 參考偏 card list | Admin List：高密度 table，整列可點 |
| Dashboard metrics | 大數字 + 小變化徽章 | Large number + label；同色系，非彩虹卡 |
| Detail workspace | 右側 Summary panel | ContextPanel：進度、金額、承辦、actions |
| Tabs | 分區資訊 | Detail tabs；Builder inspector tabs |
| Icons | 細線 lucide 風格 | **僅 lucide-react** |
| Accent | Bright lime / acid green | `#B7F45B` 系，僅 CTA / selected / focus / 重要 metric |
| Neutrals | Near-black bg in refs | **HAD：warm off-white bg + white surface + near-black text + dark strong surface**（§8） |
| Hover / Selected | White pill selected；lime active | Selected = accent soft / accent；focus ring = accent |
| Empty | 參考圖較少 | Icon + 說明 + CTA |
| Hierarchy | Action-first（今日任務／排程） | 「需要你的處理」優先於靜態資料 |

### Behance note

Gallery 標題確認為 HubSpot CRM SaaS UX/UI；實際視覺以附圖為準。不複製 HubSpot logo、文案、照片、原始 layout。

### Design Direction（鎖定）

**Modern SaaS Administrative CRM Workspace（亮色殼 + Lime Accent + Dark Strong Surfaces）**

- Clean / Structured / Focused / Efficient / Professional / Premium / Calm  
- 不是舊校務系統、不是 SurveyCake 換皮、不是預設 Admin Template、不是全站暗黑複製  

---

## Impeccable note

已執行 impeccable context：`NO_PRODUCT_MD`。本次為既有產品 redesign（product register），**不阻塞**；可選稍後 `$impeccable init`。

A newer Impeccable (v4.3.1) is available. Update now? It runs `npx impeccable update`.（請回覆是否更新；不論是否更新，切換模型後都可繼續 Redesign。）
