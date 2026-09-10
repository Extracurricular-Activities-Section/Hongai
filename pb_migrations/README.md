# PocketBase Migrations

本目錄存放 Hongai greenfield PocketBase schema migrations。

PocketBase 只當資料庫與檔案儲存層；弘愛築夢 business API、權限流程、表單驗證、審核狀態機、通知排程都由 Cloudflare Worker 承載。

## 硬性規則

- **只**操作 `hk_*` Collections
- Active schema 只建立六張 collection：`hk_students`、`hk_staff_users`、`hk_forms`、`hk_applications`、`hk_settings`、`hk_events`
- **禁止** delete / alter / recreate：`students`、`users`、`teachers` 或其他非 `hk_` Collection
- **禁止** destructive database reset
- 同名 `hk_*` 已存在時：跳過、不覆蓋
- **禁止**把 `pb_hooks/` 部署到 PocketBase 主機

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `1736500001_create_six_collection_data_layer.js` | 建立六張 greenfield data-layer collections |

## 六張 Collection 用途

| Collection | 用途 |
| --- | --- |
| `hk_students` | 學生 auth、登入鎖定、學生個資與通知偏好 |
| `hk_staff_users` | 承辦、管理員、服務帳號與承辦單位資料 |
| `hk_forms` | 所有表單範本、版本與 `schema_json`，不綁死九大表單 |
| `hk_applications` | 申請案、填答、審核/補件/任務/檔案/PDF/核定/核發 JSON |
| `hk_settings` | 申請期間、分類、政策、通知模板、FAQ、輔導老師與系統設定 |
| `hk_events` | 通知、email log、audit log、auth/system/scheduler events |

## 套用

需受控 PocketBase 執行環境；**不要**直接對 production `db.keson.pro` 盲目套用。  
不要從未驗證來源下載不明 binary。

```bash
npm run migrate:check
```

僅語法 + namespace 安全檢查，不會連線資料庫。
