# E2E Test Plan

端到端流程驗證計畫（手動為主）。

> **Playwright：OPTIONAL** — 本 repo 未強制依賴；若新增自動化，只針對 local／staging。  
> **禁止**對 production 執行破壞性或大量 E2E（**NOT RUN vs production**）。  
> 整體 Runtime：**NOT RUNTIME VERIFIED** until executed in a controlled environment.

## Student flows

| ID | Flow | Expected |
| --- | --- | --- |
| S1 | 註冊 → 登入（學號 + 身分證後四碼） | 取得 session；錯誤次數觸發 lockout |
| S2 | 無開放梯次 | 僅歷史或空狀態說明 |
| S3 | 開放梯次 → Period Profile 確認 | snapshot 建立；共用資料不進 9 表 |
| S4 | 填寫表單 draft／autosave／complete | 驗證規則生效；snapshot 產生 |
| S5 | copy-previous | 相容欄位複製 |
| S6 | 產 PDF → 送件 | Application 建立；凍結編輯 |
| S7 | 退回修改 + override | 可再編／再產 PDF／再送 |
| S8 | 站內通知可讀 | 與業務事件一致 |
| S9 | `/verify/:token` | 無 PII、無下載 |

## Admin / Staff flows

| ID | Flow | Expected |
| --- | --- | --- |
| A1 | Staff 僅見授權範圍案件 | scope 正確 |
| A2 | 資格審核／補件／核定 | 狀態機合法轉換 |
| A3 | Admin Form Builder draft → publish | 新 version；舊 retired；學生新案用新版 |
| A4 | 非 Admin 開 Builder API | 403 |
| A5 | 附件 trusted download | 無權限拒絕 |
| A6 | Follow-up 任務與逾期 | derived overdue 合理 |
| A7 | 通知排程 endpoints | 需 `X-HAD-Scheduler-Secret` |

## Security flows

| ID | Flow | Expected |
| --- | --- | --- |
| X1 | 學生 A 存取 B 的 submission／application | 拒絕 |
| X2 | Mass assignment 改 status／identity | 忽略或 400 |
| X3 | Mail／scheduler secrets 不出現在前端 bundle | `security:secrets`／人工檢查 |
| X4 | 公開 verify／靜態資源不洩漏個資 | 抽樣 |
| X5 | XSS 於表單 label／通知內容 | 純文字／安全渲染 |

## Execution log（template）

| Date | Environment | Suite | Result | Operator |
| --- | --- | --- | --- | --- |
| | local / staging | | NOT EXECUTED | |

## Automation note

若導入 Playwright：

- 使用獨立測試 PB／seed
- CI 對 staging secrets 走 OIDC／masked env
- **Never** 預設 `baseURL` 指向 production
