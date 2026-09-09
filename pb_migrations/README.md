# PocketBase Migrations

本目錄存放 HAD（Hong Ai Dream）schema migrations。

## 硬性規則

- **只**操作 `had_*` Collections
- **禁止** delete / alter / recreate：`students`、`users`、`teachers` 或其他非 `had_` Collection
- **禁止** destructive database reset
- 同名 `had_*` 已存在時：跳過、不覆蓋

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `1736500001_create_foundation_collections.js` | 建立全部 `had_*` 基礎 Collections（含 Auth `had_students`） |

## 套用

需受控 PocketBase 執行環境；**不要**直接對 production `db.keson.pro` 盲目套用。  
不要從未驗證來源下載不明 binary。

```bash
npm run migrate:check
```

僅語法 + namespace 安全檢查，不會連線資料庫。
