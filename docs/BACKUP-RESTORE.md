# Backup & Restore

PocketBase 資料與檔案備份／還原方針。

> **Status：NOT CONFIGURED** — 本文件描述應做什麼，**不宣稱** production 已排程備份或已通過還原演練。

## What to back up

| Path / asset | Contents |
| --- | --- |
| `pb_data/`（整目錄） | SQLite DB、設定、migration 歷史 |
| `pb_data/storage/`（或等效 file storage） | 附件、PDF 檔等 |
| Hooks／migrations 部署版本 | Git tag／release commit |
| Server env 清單（密文另存 secret manager） | 變數名與輪替紀錄，**非**明文 commit |

**不要**只備份 DB 而忽略 storage files（附件／PDF 會遺失）。

## Backup practices（建議）

1. 變更 schema／hooks／migration **之前**強制完整 backup（gate）。
2. 定期排程（例如每日）+ 異地複本。
3. 保留多代（至少 7 日；重大變更前額外快照）。
4. 備份檔加密與存取控制（含身分證等敏感資料）。
5. 記錄：時間、主機、執行人、路徑、checksum。

## Restore

1. 停止寫入流量（維護模式／停 PB）。
2. 以備份覆寫 `pb_data`（含 storage）。
3. 確認 hooks 版本與備份時代相容。
4. 啟動 PocketBase；檢查 health 與抽樣記錄。
5. 驗證附件下載與 PDF 檔可開。
6. 記錄還原結果。

**Rollback after bad migration = restore from backup**（見 `POCKETBASE-MIGRATION-RUNBOOK.md`）。不要依賴「反向 migrate 自動完美還原資料」。

## Restore test requirement

上線前至少一次 **還原演練**：

- [ ] 在非 production（或隔離複本）從 backup 還原
- [ ] 確認關鍵 collection 列數／抽樣學生 profile
- [ ] 確認 storage 檔案可讀
- [ ] 記錄演練日期與結果

未完成演練 → Go-Live **BLOCKER**。

## Explicit honesty

| Claim | Allowed? |
| --- | --- |
| 「文件已定義備份範圍」 | Yes |
| 「production 已設定自動備份」 | **No**（除非維運另行證明） |
| 「已通過還原測試」 | **No** until checkbox signed |
