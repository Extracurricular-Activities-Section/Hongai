# Identity at Rest

完整身分證字號（`had_student_profiles.identity_number`）與 submission snapshot 內之身分資料，目前依 **存取控制**（API Rules／hooks／列表遮罩）保護。  
應用層／磁碟加密仍為 **Infrastructure TODO → NOT CONFIGURED**。

> 本文件比較選項，**建議不要在沒有 KMS／金鑰治理下倉促上線自管加解密**。

## Option A — Volume / disk encryption

**做法**：主機磁碟、volume、或資料庫檔案層全盤加密（雲端 managed disk encryption、LUKS、雲厂商 CMEK 等）。

| Pros | Cons |
| --- | --- |
| 實作相對單純；對應用透明 | 進程被入侵後，記憶體／執行中 PB 仍可見明文 |
| 適合防「硬碟失竊／快照外流」 | 不防應用層越權讀取 |
| 可搭配雲端 KMS／平台金鑰輪替 | 需維運成熟度 |

**適用**：最低基礎設施基線；應與既有 PB 主機 hardening 一起做。

## Option B — Application-level AES-GCM

**做法**：寫入前 AES-GCM 加密 `identity_number`（及必要時 snapshot 欄位）；讀取時以 server key 解密；金鑰來自 env／KMS。

| Pros | Cons |
| --- | --- |
| 即使 DB 檔外洩，密文較難直接讀 | 金鑰管理、輪替、遺失＝資料不可用 |
| 可欄位級控制 | 搜尋／唯一性／migration／報表複雜度大增 |
| | 錯誤實作風險高（IV reuse、key in Git、雙重加密混亂） |
| | snapshot／PDF／audit 路徑都要一致處理 |

**若沒有 KMS（或等效秘密管理）與輪替演練：不建議急著做 Option B。**

## Recommendation

1. **先做 Option A**（volume／managed disk encryption）作為 production 基線。
2. Option B 僅在具備以下條件後規劃：
   - 雲端 KMS／HSM 或同等級
   - 金鑰輪替與緊急作廢 runbook
   - 明確加密欄位清單與 migration 計畫
   - 測試環境可驗證加解密與效能
3. 無論 A／B：維持列表遮罩、最小權限、audit 不記完整身分證、backup 加密。

## Status

| Item | Status |
| --- | --- |
| Access control + masking | 程式已實作（仍須 runtime 驗證） |
| Option A volume encryption | **NOT CONFIGURED** |
| Option B AES-GCM | **NOT CONFIGURED**（刻意未搶先實作） |
| KMS integration | **NOT CONFIGURED** |
