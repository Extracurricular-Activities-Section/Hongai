# Form Builder Test Plan

Phase 10 — Admin Form Builder 靜態／手動驗證清單。

> **Runtime：NOT RUNTIME VERIFIED**  
> 未在已套用 migration + hooks 的環境實際操作前，勿勾選為通過。  
> **Production：NOT LIVE** — 本清單不代表已上線驗證。

## Access & List

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 1 | Admin 開啟 `/admin/forms` | 顯示 9 大申請項目表單主檔與目前 published version | ☐ |
| 2 | 非 Admin Staff 開啟 forms／builder | UI 拒絕或 API `403`（`requireAdminAuth`） | ☐ |
| 3 | 學生呼叫 `/api/had/admin/forms/*` | `401`／`403` | ☐ |

## Draft lifecycle

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 4 | 「開啟 Builder」無既有 draft | 自 `current_published_version` clone 新 draft | ☐ |
| 5 | 再次開啟 Builder（已有 draft） | 載入既有 draft，不自動覆寫 | ☐ |
| 6 | 指定 `?from=<versionId>` 重建 draft | 以該版本 schema 覆寫／重建 draft | ☐ |

## Canvas / Palette

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 7 | Palette 新增各 field type | 畫布出現欄位；code 自動產生且唯一 | ☐ |
| 8 | 拖曳欄位重新排序 | `sort_order` 更新；autosave 後重整仍正確 | ☐ |
| 9 | 新增／重排區塊（section） | 區塊標題／代碼可編；順序持久化 | ☐ |
| 10 | 複製欄位 | 產生新 code；不與既有衝突 | ☐ |

## Settings

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 11 | 編輯 label／help／required／pdf_visible／copy_previous | 設定寫入 draft schema | ☐ |
| 12 | select／radio／multiselect 選項 | 至少一 active option；可增刪排序 | ☐ |
| 13 | computed／repeat_group／file／monthly_plan config | 對應設定面板可編；缺設定時驗證擋下 | ☐ |
| 14 | 條件規則（visibility／required 等） | 指向有效 field code；preview 行為正確 | ☐ |

## Autosave / History / Preview

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 15 | 編輯後 debounce autosave | 狀態「已儲存」；重新整理後內容仍在 | ☐ |
| 16 | Undo／Redo | 可還原畫布變更；不造成無限 autosave 迴圈 | ☐ |
| 17 | Preview modal | 以 `DynamicFormRenderer` 唯讀／試填渲染目前 draft | ☐ |

## Validation & Publish

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 18 | 空白區塊標題／無效 code／重複 code | client 顯示 error；publish 被擋 | ☐ |
| 19 | 無 section 的 draft 發布 | server `400`（至少一個區塊） | ☐ |
| 20 | 合法 draft 發布成功 | version → `published`；舊 published → `retired`；`current_published_version` 更新 | ☐ |
| 21 | 對 published／retired 執行 PUT schema | `400`（immutable） | ☐ |

## Student impact & Audit

| # | Case | Expected | Status |
| --- | --- | --- | --- |
| 22 | 發布後新建學生 submission | 鎖定**新** published version | ☐ |
| 23 | 發布前已存在的 submission | 仍綁定舊 `form_version`；歷史不被覆寫 | ☐ |
| 24 | 跨 version `copy-previous` | 依 field code 相容複製；不相容略過 | ☐ |
| 25 | Audit | `form_draft_created`／`form_draft_saved`／`form_version_published` 寫入；metadata 無 secrets／完整身分證 | ☐ |
| 26 | XSS | label／help／option 以純文字渲染；無 `dangerouslySetInnerHTML` 注入 | ☐ |

## Notes

- Playwright／自動化：**OPTIONAL**（見 `docs/E2E-TEST-PLAN.md`）。
- 本計畫通過 ≠ Production go-live。
