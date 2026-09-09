# PDF Architecture

弘愛築夢正式 PDF（Phase 6）

## Source Snapshot

正式 PDF **只**使用 `had_form_submission_versions.snapshot`：

- studentProfileSnapshot（含完整身分證，僅存於 snapshot）
- periodProfileSnapshot
- formVersion / schema
- answers / computed
- category / period
- timestamps

禁止用「目前 profile」即時拼裝歷史 PDF。

## Generation

- PocketBase hooks（Goja）負責授權、編號、token、supersede、存檔
- 實際繪製由 **pdf-lib** 引擎（`pdf-engine/`）執行
- 本機：`npm run pdf:service`（`HAD_PDF_SERVICE_URL`）
- 正式環境建議：同一引擎打包為 Cloudflare Worker（純 JS，無 Chromium）

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

- 檔案存 `had_pdf_documents.file`（非 public static）
- 下載經 `/api/had/pdf/:id/download` + ownership / admin
- SHA-256 存 `file_sha256`

## Approval Blocks

集中 config：`pdf-engine/config.js` + `pb_hooks/had_pdf_config.js`  
依 category 顯示系輔導老師／指導老師／系助等紙本簽核區。

## Font Strategy

- `PDF_FONT_PATH` 指向授權中文字型（建議 Noto Sans TC）
- 本機可暫用系統字型（如微軟正黑體）
- **勿**隨意 commit 未授權字型檔
- Production 部署前確認授權與可部署性

## Cloudflare / PocketBase

- Hooks 無法直接 `require('pdf-lib')`（Goja）
- 因此採用 hooks → trusted PDF service / Worker
- 避免 Puppeteer/Chromium（Workers 不相容）
