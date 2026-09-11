# PDF Architecture

弘愛築夢正式 PDF（Phase 6）

## Source Snapshot

正式 PDF **只**使用 `hk_form_submission_versions.snapshot`：

- studentProfileSnapshot（含完整身分證，僅存於 snapshot）
- periodProfileSnapshot
- formVersion / schema
- answers / computed
- category / period
- timestamps

禁止用「目前 profile」即時拼裝歷史 PDF。

## Generation

- Cloudflare Worker `hk-api` 負責授權、編號、token、supersede、存檔（不再部署 PB business hooks）
- 實際繪製由 **pdf-lib** 引擎（`pdf-engine/`）執行
- 正式環境：**Cloudflare Containers**（`workers/hk-pdf`）— 見 `docs/PDF-CONTAINER.md`
- 勿在 `hk-api` Worker 內嵌中文字型產檔

## Versioning

- 同一 submission 可有 PDF V1 / V2 / …
- 僅一份 `status=valid`
- 新 PDF 成功後舊 valid → `superseded` + `superseded_by`
- 失敗時不先作廢舊版

## Document Number

`HAD-{year}{semester}-{SHORT}-{serial}`  
例：`HAD-1151-LANG-000123`  
由 server `generateDocumentNumber()` 產生，不含身分證。

## QR Verification

- `/verify/:token` 公開頁
- 只顯示有效／已取代／已撤銷與非 PII metadata
- **不下載 PDF、不顯示姓名學號身分證**

## File Security

- 檔案存 `hk_pdf_documents.file`（非 public static）
- 下載經 `/api/hk/pdf/:id/download` + ownership / admin
- SHA-256 存 `file_sha256`

## Approval Blocks

集中 config：`pdf-engine/config.js` + `pb_hooks/hk_pdf_config.js`  
依 category 顯示系輔導老師／指導老師／系助等紙本簽核區。

## Font Strategy

- **中文：標楷體**（`PDF_FONT_CJK_PATH`，Windows 預設 `kaiu.ttf`）
- **英文／數字：Times New Roman**（`PDF_FONT_LATIN_PATH`，Windows 預設 `times.ttf`）
- 混排：同一行依字元切換字型（見 `pdf-engine/generate.js`）
- Container：未提供專有字型時用 AR PL KaitiM + Liberation Serif 近似；可把 `kaiu.ttf`／`times.ttf` 放進 `pdf-engine/fonts/`（勿 commit 未授權檔）
- **勿**隨意 commit 未授權字型檔

## Cloudflare / PocketBase

- 產檔：`workers/hk-pdf` Container 跑 `pdf-engine`（見 `docs/PDF-CONTAINER.md`）
- 調度／存檔：`hk-api` → PocketBase；避免 Puppeteer／Chromium
