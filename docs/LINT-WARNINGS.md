# Lint Warning Inventory（Phase 10）

本專案 `npm run lint` 目前有 **warnings、無 errors**。

| 類型 | 原因 | 風險 | 是否可接受 |
| --- | --- | --- | --- |
| `react(incompatible-library)` on RHF pages | React Compiler 與 react-hook-form 不相容提示 | Compiler 跳過 memoization；功能正常 | 可接受（框架已知） |
| `react(only-export-components)` auth context / router lazy | Context 與 hook 同檔匯出；lazy 常數 | Fast Refresh 限制 | 可接受 |
| `react(set-state-in-effect)` 多頁 | 資料 fetch 後 setState | 額外 render；非安全問題 | 可接受（資料載入模式） |
| `react(preserve-manual-memoization)` current-page | useMemo deps 推斷差異 | 可能多算一次 | 可接受 |

**Blocking error：0**
