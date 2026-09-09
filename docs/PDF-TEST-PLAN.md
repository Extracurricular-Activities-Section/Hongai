# PDF Test Plan

**狀態：NOT RUNTIME VERIFIED**（完整 generate/download 需 PocketBase + PDF service）

本機已可執行：`npm run pdf:smoke`（假資料 snapshot，輸出至 `test-output/`，不 commit）

## Generation

| # | 案例 | 預期 |
| --- | --- | --- |
| 1 | completed submission | 成功 |
| 2 | draft | 拒絕 |
| 3 | Student A / B IDOR | 拒絕 |
| 4 | missing snapshot | 拒絕 |
| 5 | invalid snapshot | 拒絕 |
| 6 | current period | 允許 |
| 7 | expired period | 拒絕新產生 |
| 8 | duplicate generate | 產生新版本 |

## Version

| # | 案例 | 預期 |
| --- | --- | --- |
| 9–14 | V1→edit→V2；V1 superseded；失敗保留 V1 | 符合規格 |

## Layout / Smoke

| # | 案例 | 預期 |
| --- | --- | --- |
| 15–22 | 中文、長文、repeat、月份、currency、空值、分頁、簽核區 | smoke PDF 可開 |

## Verification / Security

| # | 案例 | 預期 |
| --- | --- | --- |
| 23–32 | token 狀態、PII 不洩漏、下載授權、SHA256 | 符合規格 |
